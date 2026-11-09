// Inbox: sample requests, contact messages, replies to the WhatsApp number and calls booked on the site,
// newest first. Pick one
// to see it whole, reply on WhatsApp or by email, mark it replied or closed, and turn a request into
// an order.
import { REQUEST_QUESTIONS } from '../../../../supabase/functions/_shared/forms';
import { whenShort } from '../../../../supabase/functions/_shared/booking';
import * as api from '../api';
import type { View } from '../app';
import { age, esc, failed, toast, when } from '../ui';
import { convertDialog } from './convert';

type Item = { kind: 'r'; r: api.Request } | { kind: 'm'; m: api.Message } | { kind: 'b'; b: api.Booking };
const KIND_NAME = { visit: 'Visit at the floor', phone: 'Phone call', online: 'Online meeting' } as const;
/** When a booked call is, in Cairo time. */
const callTime = (b: api.Booking) => whenShort(b.starts_at);
const TABS = [['new', 'New'], ['replied', 'Replied'], ['done', 'Done'], ['all', 'All']] as const;
type Tab = (typeof TABS)[number][0];

/** The view's choices, kept while the admin is open. */
const ui = { tab: 'new' as Tab, type: 'all' as 'all' | 'r' | 'm' | 'b' };

const rowOf = (i: Item) => i.kind === 'r' ? i.r : i.kind === 'm' ? i.m : i.b;
const status = (i: Item) => rowOf(i).status;
const created = (i: Item) => rowOf(i).created_at;
const key = (i: Item) => `${i.kind}/${rowOf(i).id}`;
const inTab = (i: Item, t: Tab) => t === 'all' || (t === 'new' ? status(i) === 'new' : t === 'replied' ? status(i) === 'replied' : ['converted', 'closed'].includes(status(i)));
const MARK: Record<string, [string, string]> = { new: ['mk-us', 'New, needs a reply'], replied: ['mk-client', 'Replied'], converted: ['mk-done', 'Became an order'], closed: ['mk-closed', 'Closed'] };

function contactOf(i: Item) {
  if (i.kind === 'b') return { typed: i.b.phone, email: i.b.email, whatsapp: i.b.whatsapp };
  const x = i.kind === 'r' ? i.r : i.m;
  return { typed: x.contact, email: x.email, whatsapp: x.whatsapp };
}

export async function inboxView(v: View) {
  const [rq, ms, bk] = await Promise.all([api.requests(), api.messages(), api.bookings()]);
  const items: Item[] = [...rq.map((r): Item => ({ kind: 'r', r })), ...ms.map((m): Item => ({ kind: 'm', m })), ...bk.map((b): Item => ({ kind: 'b', b }))]
    .sort((a, b) => created(b).localeCompare(created(a)));
  const q = document.getElementById('q') as HTMLInputElement;
  const fresh = items.filter((i) => status(i) === 'new');

  const matches = (i: Item) => {
    const s = q.value.trim().toLowerCase();
    if (!s) return true;
    const x = i.kind === 'r' ? [i.r.code, i.r.brand, i.r.contact, i.r.product, i.r.note] : i.kind === 'm' ? [i.m.name, i.m.contact, i.m.text] : [i.b.name, i.b.brand, i.b.phone, i.b.email, i.b.note];
    return x.some((t) => t?.toLowerCase().includes(s));
  };
  const shown = () => items.filter((i) => inTab(i, ui.tab) && (ui.type === 'all' || i.kind === ui.type) && matches(i));
  const picked = () => {
    const [, kind, id] = v.parts; const it = items.find((i) => key(i) === `${kind}/${id}`);
    return it ?? shown()[0] ?? null;
  };

  function row(i: Item, on: boolean) {
    const [mark, word] = MARK[status(i)];
    const head = i.kind === 'r' ? `<span style="font-weight:500">${esc(i.r.brand)}</span><span class="mono t3">${esc(i.r.code)}</span>`
      : i.kind === 'm' ? `<span style="font-weight:500">${esc(i.m.name)}</span><span class="mono t3">${i.m.via === 'whatsapp' ? 'WhatsApp' : 'Message'}</span>`
      : `<span style="font-weight:500">${esc(i.b.brand)}</span><span class="mono t3">Booked call</span>`;
    const line = i.kind === 'r' ? [i.r.path, i.r.product, i.r.qty].filter(Boolean).join(' · ') : i.kind === 'm' ? i.m.text : `${KIND_NAME[i.b.kind]} · ${callTime(i.b)}`;
    return `<a class="li${on ? ' on' : ''}" href="#/inbox/${key(i)}" aria-current="${on}" style="grid-template-columns:minmax(0,1fr) auto">
<span style="display:flex;flex-direction:column;gap:4px;min-width:0"><span class="row" style="gap:8px">${head}</span>
<span class="t2" style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(line)}</span>
<span class="row" style="gap:6px;font-size:12px"><span class="mk ${mark}" aria-hidden="true"></span><span class="t3">${word}</span></span></span>
<span class="mono t3">${age(created(i))}</span></a>`;
  }

  function detail(i: Item | null) {
    if (!i) return '<div class="ch"><span><span class="kick">02 — Detail</span><h2 class="sc ct" style="margin-top:6px">Nothing to show</h2></span></div><div class="cb"><div class="empty">Nothing matches this view. Pick another tab, or clear the search.</div></div>';
    if (i.kind === 'b') return bookingDetail(i.b);
    const c = contactOf(i), st = status(i), [mark, word] = MARK[st];
    const wa = c.whatsapp ? `https://wa.me/${c.whatsapp.slice(1)}?text=${encodeURIComponent(i.kind === 'r' ? `Hello ${i.r.brand}, this is Full Circle about your sample request ${i.r.code}.` : `Hello ${i.m.name}, this is Full Circle, about your message${i.m.via === 'whatsapp' ? ' to our updates number' : ''}.`)}` : '';
    const mail = c.email ? `mailto:${c.email}?subject=${encodeURIComponent(i.kind === 'r' ? `Your sample request ${i.r.code} / Full Circle` : 'Your message to Full Circle')}` : '';
    const rows: [string, string][] = i.kind === 'r'
      ? [...REQUEST_QUESTIONS.map((qq): [string, string] => [qq.k === 'path' ? 'The brand is' : qq.summary, (i.r as unknown as Record<string, string | null>)[qq.k] ?? '—']),
        ...(i.r.also?.length ? [['Also wants', i.r.also.join(', ')] as [string, string]] : []),
        ['Contact', c.whatsapp ? `${c.whatsapp} on WhatsApp` : c.email ?? c.typed], ...(i.r.note ? [['Notes', i.r.note] as [string, string]] : []),
        ...(i.r.heard ? [['Heard of us on', i.r.heard] as [string, string]] : []), ...(i.r.sells ? [['Sells in', i.r.sells] as [string, string]] : []),
        ...(Object.keys(i.r.source ?? {}).length ? [['Came from', Object.entries(i.r.source).map(([k, x]) => `${k.replace('utm_', '')}: ${x}`).join(', ')] as [string, string]] : []),
        ['Received', when(i.r.created_at)]]
      : [['Contact', c.whatsapp ? `${c.whatsapp} on WhatsApp` : c.email ?? c.typed], ['Message', i.m.text], ['Received', when(i.m.created_at)]];
    const order = i.kind === 'r' ? i.r.orders[0] : undefined;
    return `<div class="ch"><span style="display:flex;flex-direction:column;gap:6px;min-width:0">
<span class="kick">02 — ${i.kind === 'r' ? 'Sample request' : i.m.via === 'whatsapp' ? 'WhatsApp reply' : 'Contact message'}</span>
<span class="row"><h2 class="sc ct">${esc(i.kind === 'r' ? i.r.brand : i.m.name)}</h2>${i.kind === 'r' ? `<span class="mono t3">${esc(i.r.code)}</span>` : ''}</span></span>
<span class="pillS"><span class="mk ${mark}" aria-hidden="true"></span>${word}</span></div>
<div class="cb">
<div class="row" role="group" aria-label="Actions">
${wa ? `<a class="pill${st === 'new' ? ' red' : ''}" href="${esc(wa)}" target="_blank" rel="noopener">Reply on WhatsApp</a>` : ''}
${mail ? `<a class="pill${st === 'new' && !wa ? ' red' : ''}" href="${esc(mail)}">Reply by email</a>` : ''}
${st === 'new' ? '<button type="button" class="pill" data-act="replied">Mark replied</button>' : ''}
${i.kind === 'r' && !order && st !== 'closed' ? '<button type="button" class="pill bone" data-act="convert">Convert to order</button>' : ''}
${order ? `<a class="pill" href="#/order/${order.id}">Open order ${esc(order.code)}</a>` : ''}
${st === 'closed' || (st === 'replied' && i.kind === 'm') ? '<button type="button" class="pill ghost" data-act="reopen">Reopen</button>' : ''}
${st === 'new' || st === 'replied' ? '<button type="button" class="pill ghost" data-act="close">Close</button>' : ''}
</div>
${!c.whatsapp && !c.email ? `<span class="hint">The number could not be read with its country. Check it before you reply: ${esc(c.typed)}</span>` : ''}
${i.kind === 'm' && i.m.via === 'whatsapp' ? '<span class="hint">Sent to the number that sends order updates. It told them the team answers from the main line: reply from there.</span>' : ''}
<div class="well" style="padding:4px 16px"><table class="tbl"><tbody>${rows.map(([k, x]) => `<tr><th scope="row" style="padding:12px 12px 12px 0;border-bottom:1px solid var(--bd);width:34%;vertical-align:top">${esc(k)}</th><td style="white-space:pre-wrap">${esc(x)}</td></tr>`).join('')}</tbody></table></div>
</div>`;
  }

  /** A booked call: staff confirm or follow up, then close it (a closed call frees its time on the site). */
  function bookingDetail(b: api.Booking) {
    const [mark, word] = MARK[b.status];
    const wa = b.whatsapp ? `https://wa.me/${b.whatsapp.slice(1)}?text=${encodeURIComponent(`Hello ${b.name}, this is Full Circle about your ${KIND_NAME[b.kind].toLowerCase()} on ${callTime(b)}.`)}` : '';
    const mail = `mailto:${b.email}?subject=${encodeURIComponent(`Your ${KIND_NAME[b.kind].toLowerCase()} with Full Circle`)}`;
    const rows: [string, string][] = [
      ['When', `${callTime(b)} (Cairo), 30 minutes`], ['How', KIND_NAME[b.kind]], ['Brand', b.brand], ['Name', b.name],
      ['WhatsApp', b.whatsapp ?? `${b.phone} (check the country code)`], ['Email', b.email],
      ...(b.meet_url ? [['Video link', b.meet_url] as [string, string]] : []), ...(b.note ? [['About', b.note] as [string, string]] : []),
      ...(Object.keys(b.source ?? {}).length ? [['Came from', Object.entries(b.source).map(([k, x]) => `${k.replace('utm_', '')}: ${x}`).join(', ')] as [string, string]] : []),
      ['Booked', when(b.created_at)],
    ];
    return `<div class="ch"><span style="display:flex;flex-direction:column;gap:6px;min-width:0">
<span class="kick">02 — Booked call</span>
<span class="row"><h2 class="sc ct">${esc(b.brand)}</h2><span class="mono t3">${esc(KIND_NAME[b.kind])}</span></span></span>
<span class="pillS"><span class="mk ${mark}" aria-hidden="true"></span>${word}</span></div>
<div class="cb">
<div class="row" role="group" aria-label="Actions">
${wa ? `<a class="pill${b.status === 'new' ? ' red' : ''}" href="${esc(wa)}" target="_blank" rel="noopener">Message on WhatsApp</a>` : ''}
<a class="pill${b.status === 'new' && !wa ? ' red' : ''}" href="${esc(mail)}">Email</a>
${b.meet_url ? `<a class="pill" href="${esc(b.meet_url)}" target="_blank" rel="noopener">Open the video link</a>` : ''}
${b.status === 'new' ? '<button type="button" class="pill" data-act="replied">Mark replied</button>' : ''}
${b.status === 'closed' ? '<button type="button" class="pill ghost" data-act="reopen">Reopen</button>' : '<button type="button" class="pill ghost" data-act="close">Close</button>'}
</div>
<span class="hint">${esc(b.name)} was emailed the invite; yours is in the email about it.${b.kind === 'online' && !b.meet_url ? ' Send them the video link on WhatsApp before the call.' : ''}</span>
<div class="well" style="padding:4px 16px"><table class="tbl"><tbody>${rows.map(([k, x]) => `<tr><th scope="row" style="padding:12px 12px 12px 0;border-bottom:1px solid var(--bd);width:34%;vertical-align:top">${esc(k)}</th><td style="white-space:pre-wrap">${esc(x)}</td></tr>`).join('')}</tbody></table></div>
</div>`;
  }

  function draw() {
    const list = shown(), it = picked();
    v.main.innerHTML = `<section class="mast"><div style="display:flex;flex-direction:column;gap:6px"><span class="kick">Requests and messages</span><h1 class="sc">Inbox</h1></div>
<p>${fresh.length ? `${fresh.length} ${fresh.length === 1 ? 'needs' : 'need'} a reply, oldest ${age(created(fresh[fresh.length - 1]))} ago.` : 'Nothing waits for a reply.'} Requests come from the site's form; messages from the contact page and replies to the WhatsApp updates; booked calls from Book a call.</p></section>
<div class="split">
<section class="card" aria-labelledby="q-h"><div class="ch"><span><span class="kick">01 — Queue</span><h2 id="q-h" class="sc ct" style="margin-top:6px">Requests and messages</h2></span></div>
<div class="cb">
<div class="seg" role="group" aria-label="Show">${TABS.map(([k, label]) => `<button type="button" data-tab="${k}" aria-pressed="${ui.tab === k}">${label}<span class="n">${items.filter((i) => inTab(i, k)).length}</span></button>`).join('')}</div>
<div class="row" role="group" aria-label="Type">${([['all', 'Any'], ['r', 'Requests'], ['m', 'Messages'], ['b', 'Calls']] as const).map(([k, label]) => `<button type="button" class="chip" data-type="${k}" aria-pressed="${ui.type === k}">${label}</button>`).join('')}</div>
<div style="display:flex;flex-direction:column;gap:2px">${list.map((i) => row(i, i === it)).join('') || '<div class="empty">Nothing here.</div>'}</div>
</div></section>
<section class="card hero" aria-live="polite" id="detail">${detail(it)}</section></div>`;
  }

  draw();
  // on a phone the detail sits under the list: a picked item scrolls to it
  if (v.parts[1] && matchMedia('(max-width: 860px)').matches) v.main.querySelector('#detail')?.scrollIntoView({ block: 'start' });
  q.addEventListener('input', draw, { signal: v.signal });
  v.main.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const tab = t.closest<HTMLElement>('[data-tab]'), type = t.closest<HTMLElement>('[data-type]'), act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (tab) { ui.tab = tab.dataset.tab as Tab; return draw(); }
    if (type) { ui.type = type.dataset.type as typeof ui.type; return draw(); }
    const it = picked(); if (!act || !it) return;
    if (act === 'convert' && it.kind === 'r') return convertDialog({ me: v.me, go: v.go, request: it.r });
    const next = act === 'replied' ? 'replied' : act === 'close' ? 'closed' : 'new';
    try {
      await api.setStatus(it.kind === 'r' ? 'requests' : it.kind === 'm' ? 'messages' : 'bookings', rowOf(it).id, next);
      if (it.kind === 'r') it.r.status = next; else if (it.kind === 'm') it.m.status = next as api.Message['status']; else it.b.status = next as api.Booking['status'];
      toast(next === 'replied' ? 'Marked replied' : next === 'closed' ? 'Closed' : 'Reopened');
      fresh.splice(0, fresh.length, ...items.filter((i) => status(i) === 'new'));
      draw(); v.counts();
    } catch (err) { failed(err); }
  }, { signal: v.signal });
}
