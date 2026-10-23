// Track order: the client portal (phase 3). A person signs in with a 6-digit code sent to the email
// or WhatsApp number on their order (invite-only: staff add them), then sees their client's orders:
// where each is, the decision waiting on them, the stage photos and the approval log. Approve, Ask
// for changes and Request a photo go to checked database functions that write the log. Approving
// does not move the stage (docs/adr/0005): the order says so until staff move it on.
import type { Feature } from '../core/lifecycle';
import { $, byId, focusHeading, markInvalid, pad, ring, rm, toast, vib } from '../core/util';
import { STAGES } from '../../data/site';
import { bindPhoto, isLoaded } from '../shell/images';
import { humanToken } from '../core/turnstile';
import { readContact } from '../../../supabase/functions/_shared/forms';
import * as api from '../core/portal';

/** Which view is shown, the order open, the sign-in steps and what the server last sent. */
const portal = {
  view: (api.signedIn() ? 'orders' : 'login') as 'login' | 'orders' | 'order',
  data: null as api.Portal | null,
  /** the order open, by id (the data is replaced on every reload) */
  cur: null as number | null,
  codeStep: false,
  id: '',
  who: null as api.Who | null,
  code: '',
  tab: 'photos',
  /** the sign-in error line, kept when the page comes back, and the field it is about */
  err: '',
  bad: [] as string[],
  /** log rows added by the last reload (they keep their entrance animation) */
  fresh: 0,
  /** a call to the server is under way: the buttons wait */
  busy: false,
};
const LOGIN_LEAD = 'Sign in with the email or WhatsApp number on your order. You will see every order, its stage, the next decision, photos and the full approval log.';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const stage = (n: number) => STAGES[Math.min(Math.max(n, 1), 8) - 1];
const order = () => portal.data?.orders.find((o) => o.id === portal.cur) ?? null;
const stamp = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

/**
 * What the order needs from the client: the open decision; or the last one, answered at this stage
 * and not yet followed by a move (approved: waiting on Full Circle; changes asked: a revised version
 * is coming); or nothing.
 */
type Need = { kind: 'open' | 'approved' | 'changes'; d: api.Decision } | { kind: 'none' };
function need(o: api.Order): Need {
  const open = o.order_decisions.find((d) => d.status === 'open');
  if (open) return { kind: 'open', d: open };
  const answered = o.order_events.filter((e) => (e.kind === 'approved' || e.kind === 'changes_asked') && e.decision_id).sort((a, b) => b.id - a.id)[0];
  if (!answered || o.order_events.some((e) => e.kind === 'stage_moved' && e.id > answered.id)) return { kind: 'none' };
  const d = o.order_decisions.find((x) => x.id === answered.decision_id);
  return d ? { kind: answered.kind === 'approved' ? 'approved' : 'changes', d } : { kind: 'none' };
}
const needLine = (o: api.Order) => {
  const n = need(o);
  if (n.kind === 'open') return n.d.title;
  if (n.kind === 'approved') return 'Approved / waiting on us';
  if (n.kind === 'changes') return 'Changes asked / revision coming';
  return o.status === 'delivered' ? 'Delivered' : 'None / on track';
};

function logLine(e: api.LogEntry) {
  const at = (n: number | null) => n ? pad(n) + ' ' + stage(n).n : '';
  const title = e.title ?? 'Decision';
  switch (e.kind) {
    case 'order_opened': return 'Order opened / ' + at(e.stage);
    case 'decision_opened': return title + ' / sent to you';
    case 'approved': return title + ' / approved';
    case 'changes_asked': return title + ' / changes requested' + (e.note ? ': ' + e.note : '');
    case 'decision_withdrawn': return title + ' / withdrawn';
    case 'photo_asked': return 'Photo requested / ' + stage(e.stage ?? 1).n;
    case 'photo_added': return 'Photo added / ' + stage(e.stage ?? 1).n;
    case 'stage_moved': return 'Moved to ' + at(e.to_stage) + (e.note ? ' / ' + e.note : '');
  }
}
const logBy = (e: api.LogEntry) => e.side === 'staff' ? 'Full Circle' : e.actor_id && e.actor_id === api.me() ? 'You' : e.actor_label;

function tView(doc: Document) {
  const g = byId(doc), v = portal.view, o = order();
  g('tLogin').hidden = v !== 'login'; g('tOrders').hidden = v !== 'orders'; g('tOrder').hidden = v !== 'order';
  g('tTitle').textContent = v === 'login' ? 'Track your order.' : v === 'orders' ? 'Your orders.' : o!.code + '.';
  g('tLead').textContent = v === 'login' ? LOGIN_LEAD : v === 'orders' ? 'Every order, where it is, and what we need from you.' : o!.name + ' / ' + stage(o!.stage).n;
}

function renderLogin(doc: Document) {
  const g = byId(doc);
  g('tA').hidden = portal.codeStep; g('tB').hidden = !portal.codeStep;
  g('tStep').textContent = portal.codeStep ? 'Step 2 of 2' : 'Step 1 of 2'; g('tLoginH').textContent = portal.codeStep ? 'Enter the code' : 'Sign in';
  g<HTMLInputElement>('tId').value = portal.id; g<HTMLInputElement>('tCode').value = portal.code;
  g('tErr').textContent = portal.err; markInvalid(doc, ['tId', 'tCode'], portal.bad, 'tErr');
  for (const id of ['tSendCode', 'tVerify']) g<HTMLButtonElement>(id).disabled = portal.busy;
}

function renderList(doc: Document) {
  const g = byId(doc), d = portal.data;
  g('tWho').textContent = d?.brand ? 'Signed in / ' + d.brand : 'Signed in';
  g('tList').innerHTML = !d ? '<p class="mono dim" style="margin:0;padding:18px 0">Loading your orders</p>'
    : !d.orders.length ? '<p class="dim" style="margin:0;padding:18px 0">No orders on this account yet. Once we start one, it shows here.</p>'
    : d.orders.map((o) => `<button class="ord" data-o="${o.id}"><span class="code">${esc(o.code)}</span><span>${esc(o.name)}<br><span class="mono dim">${esc(o.summary ?? o.product)}</span></span><span class="mono">${pad(o.stage)} / ${stage(o.stage).n}</span><span class="mono ${need(o).kind === 'open' ? 'need' : 'dim'}">${esc(needLine(o))}</span><span class="arrow" aria-hidden="true">→</span></button>`).join('');
  g('tUpd').hidden = !d?.whatsapp;
  g<HTMLInputElement>('tUpdates').checked = !!d?.updates;
}

const photoTile = (p: api.Photo, k: number, instant: boolean) => {
  const url = portal.data!.urls[p.object_path], g = stage(p.stage);
  const img = url ? `<img src="${esc(url)}" alt="${esc(p.caption ?? '')}" class="fill${instant && isLoaded(url) ? ' ok' : ''}" loading="lazy" decoding="async">` : '';
  return `<div class="ph" style="--tone:radial-gradient(70% 60% at ${30 + (k % 3) * 20}% 40%,${g.tone},#1b1b18 72%)">${img}<div class="cap mono"><span>${g.s}</span><span>${k === 0 ? 'Latest' : ''}</span></div></div>`;
};

/** instant: a page coming back shows photos already seen without fading them in again */
function renderOrder(doc: Document, instant = false) {
  const o = order(); if (!o) return;
  const s = o.stage - 1, g = byId(doc), n = need(o);
  g('oArc').style.strokeDashoffset = String(100 - ((s + 0.5) / 8) * 100);
  const [x, y] = ring(200, 200, 150, (s + 0.5) / 8); g('oDot').setAttribute('cx', String(x)); g('oDot').setAttribute('cy', String(y));
  [...g('oLabels').children].forEach((t, k) => t.classList.toggle('done', k <= s));
  g('oNum').textContent = pad(o.stage); g('oSub').textContent = STAGES[s].n;
  g('oMeta').textContent = o.code + ' / ' + (o.summary ?? o.product); g('oName').textContent = o.name;
  const open = n.kind === 'open';
  g('tChip').classList.toggle('ok', open); g('tChipT').textContent = open ? 'Waiting on you' : o.status === 'delivered' ? 'Delivered' : 'On track';
  g('oDecision').classList.toggle('done', !open);
  g('oDecT').textContent = open ? 'Your decision' : n.kind === 'approved' ? 'Approved' : n.kind === 'changes' ? 'Changes asked' : 'Next decision';
  // the red dot means "needs you", so it shows only while a decision is waiting (as in the list)
  g('oDecT').classList.toggle('need', open); g('oDecT').classList.toggle('dim', !open);
  g('oDecH').textContent = n.kind === 'none' ? STAGES[s].ok : n.d.title;
  g('oDecP').textContent = open ? n.d.body ?? ''
    : n.kind === 'approved' ? 'Approved. Waiting on Full Circle to move the order on; we will message you when the next decision is ready.'
    : n.kind === 'changes' ? 'We are making the changes and will send a revised version for you to approve.'
    : 'Nothing needed from you right now. We will message you when the next decision is ready.';
  g('oDecBtns').hidden = !open;
  for (const id of ['oApprove', 'oChanges']) g<HTMLButtonElement>(id).disabled = portal.busy;
  const photos = [...o.stage_photos].sort((a, b) => b.id - a.id);
  g('oPhotos').innerHTML = photos.length ? photos.map((p, k) => photoTile(p, k, instant)).join('')
    : '<p class="dim" style="grid-column:1/-1;margin:0">No photos yet. We add them as the order moves through each stage.</p>';
  g<HTMLButtonElement>('oPhoto').disabled = portal.busy || o.photo_requests.some((r) => r.stage === o.stage && !r.answered_at);
  const specs = [...o.order_specs].sort((a, b) => a.position - b.position || a.key.localeCompare(b.key)).map((r) => [r.key, r.value]);
  if (o.qty && !specs.some(([k]) => k === 'Quantity')) specs.push(['Quantity', o.qty + ' pcs']);
  g('oSpecs').innerHTML = specs.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('');
  const log = [...o.order_events].sort((a, b) => b.id - a.id);
  g('oLog').innerHTML = log.map((e, k) => `<tr${k < portal.fresh ? ' class="new"' : ''}><td>${stamp(e.created_at)}</td><td>${esc(logLine(e))}</td><td>${esc(logBy(e))}</td></tr>`).join('');
}

function renderTabs(doc: Document) {
  // one tab stop for the row (arrow keys move between tabs), on the tab that is shown
  doc.querySelectorAll<HTMLElement>('.tabs2 [role=tab]').forEach((x) => { const on = x.dataset.tab === portal.tab; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
  doc.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => p.hidden = p.dataset.panel !== portal.tab);
}

function restore(doc: Document) {
  if (!doc.getElementById('tLogin')) return;
  if (portal.view === 'order' && !order()) portal.view = api.signedIn() ? 'orders' : 'login';
  renderLogin(doc);
  if (portal.view !== 'login') renderList(doc);
  if (order()) renderOrder(doc, true);
  renderTabs(doc);
  tView(doc);
}

export const trackFeature: Feature = {
  prepare: restore,
  mount(signal) {
    if (!document.getElementById('tLogin')) return;
    restore(document);
    const live = () => !signal.aborted;
    const bindPhotos = () => $('oPhotos').querySelectorAll<HTMLImageElement>('img').forEach(bindPhoto);
    const bindList = () => $('tList').querySelectorAll<HTMLElement>('.ord').forEach((b) => b.addEventListener('click', () => openOrder(+b.dataset.o!), { signal }));
    bindList(); bindPhotos();
    const busy = (on: boolean) => { portal.busy = on; if (live()) { renderLogin(document); if (order()) { for (const id of ['oApprove', 'oChanges']) $<HTMLButtonElement>(id).disabled = on; } } };

    /** Back to the sign-in, with a line saying why (the session ended). */
    const toLogin = (msg = '') => {
      api.signOut(); portal.data = null; portal.cur = null; portal.view = 'login'; portal.codeStep = false; portal.code = ''; portal.err = msg; portal.bad = [];
      if (!live()) return;
      renderLogin(document); tView(document); focusHeading($('tTitle'));
    };
    /**
     * Fetches everything again and redraws the view shown. Log rows that were not there before keep
     * their entrance. False when it could not (the reason is on screen).
     */
    async function reload() {
      const before = new Set(order()?.order_events.map((e) => e.id) ?? []);
      try {
        portal.data = await api.load();
      } catch (e) {
        if (e instanceof api.SignedOut) { toLogin(api.AUTH_ERRORS.signedOut); return false; }
        if (live()) toast('Could not reach Full Circle. Try again');
        return false;
      }
      const o = order();
      portal.fresh = o && before.size ? o.order_events.filter((e) => !before.has(e.id)).length : 0;
      if (portal.view === 'order' && !o) portal.view = 'orders';
      if (!live()) return true;
      renderList(document); bindList();
      if (o) { renderOrder(document); bindPhotos(); }
      tView(document);
      return true;
    }
    // each change of view puts focus on the page title, which names the new view
    const showList = () => { renderList(document); bindList(); portal.view = 'orders'; tView(document); focusHeading($('tTitle')); };
    function openOrder(id: number) {
      portal.cur = id; portal.fresh = 0; renderOrder(document); bindPhotos(); portal.view = 'order'; tView(document);
      scrollTo({ top: 0, behavior: rm ? 'auto' : 'smooth' }); focusHeading($('tTitle'));
    }
    // a session kept from an earlier visit: show its orders
    if (api.signedIn() && !portal.data) reload();

    /** Runs a client action, then shows the order as the server now has it. */
    async function act(fn: Parameters<typeof api.act>[0], args: object, done: string) {
      if (portal.busy) return false;
      vib(); busy(true);
      let problem;
      try { problem = await api.act(fn, args); } catch { busy(false); toLogin(api.AUTH_ERRORS.signedOut); return false; }
      if (problem) { busy(false); if (live()) toast(problem.error); await reload(); return false; }
      await reload(); busy(false);
      if (live()) { renderOrder(document); bindPhotos(); toast(done); }
      return true;
    }
    $('oApprove').addEventListener('click', async () => {
      const o = order(), n = o && need(o); if (!o || n?.kind !== 'open') return;
      // the buttons are gone; focus goes to the heading that replaced them
      if (await act('approve_decision', { p_decision: n.d.id }, o.code + ' / approved') && live()) focusHeading($('oDecH'));
    }, { signal });
    $('oChanges').addEventListener('click', async () => {
      const o = order(), n = o && need(o); if (!o || n?.kind !== 'open') return;
      if (await act('request_changes', { p_decision: n.d.id }, 'Changes sent to the team') && live()) focusHeading($('oDecH'));
    }, { signal });
    $('oPhoto').addEventListener('click', () => {
      const o = order(); if (!o) return;
      act('request_photo', { p_order: o.id }, 'Photo requested / floor notified');
    }, { signal });
    $('tUpdates').addEventListener('change', async (e) => {
      const box = e.target as HTMLInputElement, on = box.checked;
      box.disabled = true;
      let problem;
      try { problem = await api.setUpdates(on); } catch { toLogin(api.AUTH_ERRORS.signedOut); return; }
      box.disabled = false;
      if (problem) { box.checked = !on; toast(problem.error); return; }
      if (portal.data) portal.data.updates = on;
      toast(on ? 'Order updates on WhatsApp: on' : 'Order updates on WhatsApp: off');
    }, { signal });

    const tabs = [...document.querySelectorAll<HTMLElement>('.tabs2 [role=tab]')];
    tabs.forEach((t) => t.addEventListener('click', () => { portal.tab = t.dataset.tab!; renderTabs(document); }, { signal }));
    document.querySelector<HTMLElement>('.tabs2')!.addEventListener('keydown', (e) => {
      const i = tabs.findIndex((t) => t.dataset.tab === portal.tab);
      const to = ({ ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 } as Record<string, number>)[e.key];
      if (to === undefined) return;
      e.preventDefault(); const t = tabs[(to + tabs.length) % tabs.length]; portal.tab = t.dataset.tab!; renderTabs(document); t.focus();
    }, { signal });

    $('tId').addEventListener('input', (e) => { portal.id = (e.target as HTMLInputElement).value; }, { signal });
    $('tCode').addEventListener('input', (e) => { portal.code = (e.target as HTMLInputElement).value; }, { signal });
    // the error line is tied to the field it is about, which gets focus
    const setErr = (msg: string, field?: string) => {
      portal.err = msg; portal.bad = field ? [field] : [];
      if (!live()) return;
      $('tErr').textContent = msg; markInvalid(document, ['tId', 'tCode'], portal.bad, 'tErr');
      if (field) $(field).focus();
    };
    const send = async () => {
      if (portal.busy) return;
      const c = readContact(portal.id = $<HTMLInputElement>('tId').value);
      if (!c) return setErr(api.AUTH_ERRORS.id, 'tId');
      if (c.channel === 'whatsapp' && !c.whatsapp) return setErr(api.AUTH_ERRORS.country, 'tId');
      const who: api.Who = c.channel === 'email' ? { email: c.email } : { phone: c.whatsapp! };
      setErr(''); busy(true);
      let captcha: string;
      try { captcha = await humanToken($('tTs')); } catch { busy(false); return setErr(api.AUTH_ERRORS.robot); }
      const problem = await api.sendCode(who, captcha);
      busy(false);
      if (problem) return setErr(problem.error, 'tId');
      portal.who = who; portal.codeStep = true; portal.code = '';
      if (!live()) return;
      renderLogin(document); $('tCode').focus(); toast('Code sent');
    };
    $('tSendCode').addEventListener('click', send, { signal });
    $('tId').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); }, { signal });
    const verify = async () => {
      if (portal.busy || !portal.who) return;
      const code = $<HTMLInputElement>('tCode').value.trim();
      if (!/^\d{6}$/.test(code)) return setErr(api.AUTH_ERRORS.code, 'tCode');
      setErr(''); busy(true);
      const problem = await api.verifyCode(portal.who, code);
      if (problem) { busy(false); return setErr(problem.error, 'tCode'); }
      portal.codeStep = false; portal.code = ''; portal.data = null; portal.view = 'orders';
      busy(false);
      if (!live()) return;
      showList(); toast('Signed in');
      await reload();
    };
    $('tVerify').addEventListener('click', verify, { signal });
    $('tCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') verify(); }, { signal });
    const back = () => { portal.codeStep = false; portal.err = ''; portal.bad = []; renderLogin(document); };
    $('tBack').addEventListener('click', () => { back(); $('tId').focus(); }, { signal });
    $('tOut').addEventListener('click', () => toLogin(), { signal });
    $('tAll').addEventListener('click', showList, { signal });
  },
};

