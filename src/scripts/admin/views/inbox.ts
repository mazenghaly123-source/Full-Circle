// Inbox: sample requests and contact messages, newest first. Pick one to see it whole, reply on
// WhatsApp or by email, mark it replied or closed, and turn a request into an order.
import { REQUEST_QUESTIONS } from '../../../../supabase/functions/_shared/forms';
import * as api from '../api';
import type { View } from '../app';
import { age, esc, failed, toast, when } from '../ui';
import { convertDialog } from './convert';

type Item = { kind: 'r'; r: api.Request } | { kind: 'm'; m: api.Message };
const TABS = [['new', 'New'], ['replied', 'Replied'], ['done', 'Done'], ['all', 'All']] as const;
type Tab = (typeof TABS)[number][0];

/** The view's choices, kept while the admin is open. */
const ui = { tab: 'new' as Tab, type: 'all' as 'all' | 'r' | 'm' };

const status = (i: Item) => i.kind === 'r' ? i.r.status : i.m.status;
const created = (i: Item) => i.kind === 'r' ? i.r.created_at : i.m.created_at;
const key = (i: Item) => `${i.kind}/${i.kind === 'r' ? i.r.id : i.m.id}`;
const inTab = (i: Item, t: Tab) => t === 'all' || (t === 'new' ? status(i) === 'new' : t === 'replied' ? status(i) === 'replied' : ['converted', 'closed'].includes(status(i)));
const MARK: Record<string, [string, string]> = { new: ['mk-us', 'New, needs a reply'], replied: ['mk-client', 'Replied'], converted: ['mk-done', 'Became an order'], closed: ['mk-closed', 'Closed'] };

function contactOf(i: Item) {
  const x = i.kind === 'r' ? i.r : i.m;
  return { typed: x.contact, email: x.email, whatsapp: x.whatsapp };
}

export async function inboxView(v: View) {
  const [rq, ms] = await Promise.all([api.requests(), api.messages()]);
  const items: Item[] = [...rq.map((r): Item => ({ kind: 'r', r })), ...ms.map((m): Item => ({ kind: 'm', m }))]
    .sort((a, b) => created(b).localeCompare(created(a)));
  const q = document.getElementById('q') as HTMLInputElement;
  const fresh = items.filter((i) => status(i) === 'new');

  const matches = (i: Item) => {
    const s = q.value.trim().toLowerCase();
    if (!s) return true;
    const x = i.kind === 'r' ? [i.r.code, i.r.brand, i.r.contact, i.r.product, i.r.note] : [i.m.name, i.m.contact, i.m.text];
    return x.some((t) => t?.toLowerCase().includes(s));
  };
  const shown = () => items.filter((i) => inTab(i, ui.tab) && (ui.type === 'all' || i.kind === ui.type) && matches(i));
  const picked = () => {
    const [, kind, id] = v.parts; const it = items.find((i) => key(i) === `${kind}/${id}`);
    return it ?? shown()[0] ?? null;
  };

  function row(i: Item, on: boolean) {
    const [mark, word] = MARK[status(i)];
    const head = i.kind === 'r' ? `<span style="font-weight:500">${esc(i.r.brand)}</span><span class="mono t3">${esc(i.r.code)}</span>` : `<span style="font-weight:500">${esc(i.m.name)}</span><span class="mono t3">Message</span>`;
    const line = i.kind === 'r' ? [i.r.path, i.r.product, i.r.qty].filter(Boolean).join(' · ') : i.m.text;
    return `<a class="li${on ? ' on' : ''}" href="#/inbox/${key(i)}" aria-current="${on}" style="grid-template-columns:minmax(0,1fr) auto">
<span style="display:flex;flex-direction:column;gap:4px;min-width:0"><span class="row" style="gap:8px">${head}</span>
<span class="t2" style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(line)}</span>
<span class="row" style="gap:6px;font-size:12px"><span class="mk ${mark}" aria-hidden="true"></span><span class="t3">${word}</span></span></span>
<span class="mono t3">${age(created(i))}</span></a>`;
  }

  function detail(i: Item | null) {
    if (!i) return '<div class="ch"><span><span class="kick">02 — Detail</span><h2 class="sc ct" style="margin-top:6px">Nothing to show</h2></span></div><div class="cb"><div class="empty">Nothing matches this view. Pick another tab, or clear the search.</div></div>';
    const c = contactOf(i), st = status(i), [mark, word] = MARK[st];
    const wa = c.whatsapp ? `https://wa.me/${c.whatsapp.slice(1)}?text=${encodeURIComponent(i.kind === 'r' ? `Hello ${i.r.brand}, this is Full Circle about your sample request ${i.r.code}.` : `Hello ${i.m.name}, this is Full Circle, about your message.`)}` : '';
    const mail = c.email ? `mailto:${c.email}?subject=${encodeURIComponent(i.kind === 'r' ? `Your sample request ${i.r.code} / Full Circle` : 'Your message to Full Circle')}` : '';
    const rows: [string, string][] = i.kind === 'r'
      ? [...REQUEST_QUESTIONS.map((qq): [string, string] => [qq.k === 'path' ? 'The brand is' : qq.summary, (i.r as unknown as Record<string, string | null>)[qq.k] ?? '—']),
        ['Contact', c.whatsapp ? `${c.whatsapp} on WhatsApp` : c.email ?? c.typed], ...(i.r.note ? [['Notes', i.r.note] as [string, string]] : []),
        ...(Object.keys(i.r.source ?? {}).length ? [['Came from', Object.entries(i.r.source).map(([k, x]) => `${k.replace('utm_', '')}: ${x}`).join(', ')] as [string, string]] : []),
        ['Received', when(i.r.created_at)]]
      : [['Contact', c.whatsapp ? `${c.whatsapp} on WhatsApp` : c.email ?? c.typed], ['Message', i.m.text], ['Received', when(i.m.created_at)]];
    const order = i.kind === 'r' ? i.r.orders[0] : undefined;
    return `<div class="ch"><span style="display:flex;flex-direction:column;gap:6px;min-width:0">
<span class="kick">02 — ${i.kind === 'r' ? 'Sample request' : 'Contact message'}</span>
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
<div class="well" style="padding:4px 16px"><table class="tbl"><tbody>${rows.map(([k, x]) => `<tr><th scope="row" style="padding:12px 12px 12px 0;border-bottom:1px solid var(--bd);width:34%;vertical-align:top">${esc(k)}</th><td style="white-space:pre-wrap">${esc(x)}</td></tr>`).join('')}</tbody></table></div>
</div>`;
  }

  function draw() {
    const list = shown(), it = picked();
    v.main.innerHTML = `<section class="mast"><div style="display:flex;flex-direction:column;gap:6px"><span class="kick">Requests and messages</span><h1 class="sc">Inbox</h1></div>
<p>${fresh.length ? `${fresh.length} ${fresh.length === 1 ? 'needs' : 'need'} a reply, oldest ${age(created(fresh[fresh.length - 1]))} ago.` : 'Nothing waits for a reply.'} Requests come from the site's form; messages from the contact page.</p></section>
<div class="split">
<section class="card" aria-labelledby="q-h"><div class="ch"><span><span class="kick">01 — Queue</span><h2 id="q-h" class="sc ct" style="margin-top:6px">Requests and messages</h2></span></div>
<div class="cb">
<div class="seg" role="group" aria-label="Show">${TABS.map(([k, label]) => `<button type="button" data-tab="${k}" aria-pressed="${ui.tab === k}">${label}<span class="n">${items.filter((i) => inTab(i, k)).length}</span></button>`).join('')}</div>
<div class="row" role="group" aria-label="Type">${([['all', 'Both'], ['r', 'Requests'], ['m', 'Messages']] as const).map(([k, label]) => `<button type="button" class="chip" data-type="${k}" aria-pressed="${ui.type === k}">${label}</button>`).join('')}</div>
<div style="display:flex;flex-direction:column;gap:2px">${list.map((i) => row(i, i === it)).join('') || '<div class="empty">Nothing here.</div>'}</div>
</div></section>
<section class="card hero" aria-live="polite" id="detail">${detail(it)}</section></div>`;
  }

  draw();
  // on a phone the detail sits under the list: a picked item scrolls to it
  if (v.parts[1] && matchMedia('(max-width: 860px)').matches) document.getElementById('detail')!.scrollIntoView({ block: 'start' });
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
      await api.setStatus(it.kind === 'r' ? 'requests' : 'messages', it.kind === 'r' ? it.r.id : it.m.id, next);
      if (it.kind === 'r') it.r.status = next; else it.m.status = next as api.Message['status'];
      toast(next === 'replied' ? 'Marked replied' : next === 'closed' ? 'Closed' : 'Reopened');
      fresh.splice(0, fresh.length, ...items.filter((i) => status(i) === 'new'));
      draw(); v.counts();
    } catch (err) { failed(err); }
  }, { signal: v.signal });
}
