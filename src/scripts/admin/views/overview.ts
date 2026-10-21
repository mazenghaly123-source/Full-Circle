// Overview: the studio at a glance. The headline figures, the production flow (each open order as a
// block in its stage), what needs us (new requests and messages, and what clients' answers left us),
// the delivery dates of the next two weeks, and the latest entries of every order's log.
import * as api from '../api';
import type { View } from '../app';
import { FLOW, ICON, age, dateLine, day, daysSince, enteredStage, esc, flowOf, isLate, isOpen, logLine, needsOf, pad, today, when, type Flow } from '../ui';
import { STAGES } from '../../../data/site';
import { moveOnClick, needRow } from './needs';

const SHOW = [['all', 'All'], ['us', 'Needs us'], ['late', 'Late'], ['work', 'In work'], ['client', 'With client']] as const;
type Show = (typeof SHOW)[number][0];
const ui = { show: 'all' as Show, needs: 'all' as 'all' | 'inbox' | 'orders' };
/** Blocks a stage shows before "+ n more". */
const MAX_BLOCKS = 5;
const DAY = 86_400_000;

export async function overviewView(v: View) {
  // the inbox's list for what needs a reply; every request of the last 60 days for the figure
  const [first, requests, messages, counted] = await Promise.all([api.board(), api.requests(), api.messages(), api.requestsSince(new Date(Date.now() - 60 * DAY).toISOString())]);
  let orders = first;

  function draw() {
    const open = orders.filter(isOpen), flow = new Map(open.map((o) => [o.id, flowOf(o)]));
    const orderNeeds = open.flatMap(needsOf);
    const inbox = [...requests.filter((r) => r.status === 'new').map((r) => ({ at: r.created_at, row: inboxRow(r.brand, r.code, `Sample request: ${[r.product, r.qty].filter(Boolean).join(', ')}`, r.created_at, `#/inbox/r/${r.id}`) })),
      ...messages.filter((m) => m.status === 'new').map((m) => ({ at: m.created_at, row: inboxRow(m.name, m.via === 'whatsapp' ? 'WhatsApp' : 'Message', m.text, m.created_at, `#/inbox/m/${m.id}`) }))];
    const needs = [...(ui.needs === 'orders' ? [] : inbox), ...(ui.needs === 'inbox' ? [] : orderNeeds.map((n) => ({ at: n.at, row: needRow(n) })))].sort((a, b) => a.at.localeCompare(b.at));
    const withThem = open.filter((o) => flow.get(o.id) === 'client');
    const longest = withThem.flatMap((o) => o.order_decisions.filter((d) => d.status === 'open')).sort((a, b) => a.opened_at.localeCompare(b.opened_at))[0];
    const late = open.filter(isLate), pieces = open.reduce((n, o) => n + (o.qty ?? 0), 0);
    const now = Date.now(), recent = counted.filter((r) => now - Date.parse(r.created_at) < 30 * DAY), before = counted.filter((r) => { const t = now - Date.parse(r.created_at); return t >= 30 * DAY && t < 60 * DAY; });
    const converted = recent.filter((r) => r.orders.length).length;
    const nYou = inbox.length + orderNeeds.length;

    const kpis = [
      { mark: 'mk mk-us', label: 'Needs you', n: nYou, unit: nYou === 1 ? 'thing' : 'things', sub: `${inbox.length} in the inbox · ${orderNeeds.length} on orders`, href: '#/inbox' },
      { mark: 'mk mk-client', label: 'With clients', n: withThem.length, unit: withThem.length === 1 ? 'order' : 'orders', sub: longest ? `Longest: ${daysSince(longest.opened_at)} d` : 'No decision waiting', href: '#/approvals' },
      { mark: 'mk mk-work', label: 'On the floor', n: open.length, unit: open.length === 1 ? 'order' : 'orders', sub: `${pieces.toLocaleString('en-GB')} pieces`, href: '#/production' },
      { mark: 'mk mk-late', label: 'Running late', n: late.length, unit: late.length === 1 ? 'order' : 'orders', sub: late.length ? `Past due: ${late.map((o) => o.code).slice(0, 2).join(', ')}` : 'Nothing past its date', href: '#/production' },
      { mark: '', label: 'Requests, 30 days', n: recent.length, unit: '', sub: `${before.length ? `${recent.length >= before.length ? '+' : ''}${Math.round(((recent.length - before.length) / before.length) * 100)}% on the 30 before · ` : ''}${converted} became ${converted === 1 ? 'an order' : 'orders'}`, href: '#/analytics' },
    ];

    // the next 14 days, from today in Cairo
    const start = Date.parse(`${today()}T00:00:00Z`);
    const days = Array.from({ length: 14 }, (_, i) => new Date(start + i * DAY).toISOString().slice(0, 10));
    const due = open.filter((o) => o.due_on).sort((a, b) => a.due_on!.localeCompare(b.due_on!));
    const soon = due.filter((o) => o.due_on! <= days[13]);
    const wd = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    const log = orders.flatMap((o) => o.order_events.map((e) => ({ o, e }))).sort((a, b) => b.e.created_at.localeCompare(a.e.created_at)).slice(0, 12);

    v.main.innerHTML = `<section class="mast"><div style="display:flex;flex-direction:column;gap:6px"><span class="kick">${dateLine()} · Cairo</span><h1 class="sc">Overview</h1></div>
<p>${nYou ? `${nYou} ${nYou === 1 ? 'thing needs' : 'things need'} you${inbox.length ? `: ${inbox.length} in the inbox` : ''}${orderNeeds.length ? `${inbox.length ? ' and' : ':'} ${orderNeeds.length} on orders` : ''}.` : 'Nothing needs you right now.'} ${open.length} ${open.length === 1 ? 'order is' : 'orders are'} open${late.length ? `, ${late.length} past ${late.length === 1 ? 'its' : 'their'} delivery date` : ''}.</p></section>
<section class="ledger" aria-label="Headline figures">${kpis.map((k) => `<a class="kp" href="${k.href}"><span class="kick" style="display:flex;align-items:center;gap:7px;color:var(--t2);grid-column:span 2">${k.mark ? `<span class="${k.mark}" aria-hidden="true"></span>` : ''}${k.label}</span>
<span class="kn tn" style="grid-column:span 2">${k.n}<small>${k.unit}</small></span><span class="dl" style="grid-column:span 2">${esc(k.sub)}</span></a>`).join('')}</section>
<div class="grid">
<section class="card hero c8" aria-labelledby="fl-h"><div class="ch"><span style="display:flex;flex-direction:column;gap:6px"><span class="kick">01 — Production</span><h2 id="fl-h" class="sc ct">Production flow</h2></span><a class="more" href="#/production" aria-label="Open the production board">${ICON.production}</a></div>
<div class="row" role="group" aria-label="Show" style="padding:14px 22px 0;gap:6px 8px">${SHOW.map(([k, label]) => `<button type="button" class="chip" data-show="${k}" aria-pressed="${ui.show === k}">${k === 'all' ? '' : `<span class="${FLOW[k as Flow].mark}" aria-hidden="true"></span>`}${label}<span class="n">${k === 'all' ? open.length : open.filter((o) => flow.get(o.id) === k).length}</span></button>`).join('')}</div>
<div class="flow"><div class="fcols">${STAGES.map((s, i) => {
      const at = open.filter((o) => o.stage === i + 1).sort((a, b) => (b.qty ?? 0) - (a.qty ?? 0));
      const most = Math.max(1, ...open.map((o) => o.qty ?? 0));
      const pcs = at.reduce((n, o) => n + (o.qty ?? 0), 0);
      // block height follows pieces; a full column is scaled to fit its 220px
      const raw = at.slice(0, MAX_BLOCKS).map((o) => 30 + 70 * ((o.qty ?? 0) / most)), fit = Math.min(1, (200 - 3 * raw.length) / Math.max(1, raw.reduce((a, b) => a + b, 0)));
      return `<div class="fcol" role="group" aria-label="${pad(i + 1)} ${esc(s.n)}: ${at.length} ${at.length === 1 ? 'order' : 'orders'}">
<div class="fh"><span class="fnum"><span class="mono t3">${pad(i + 1)}</span></span><span class="fname">${esc(s.n)}</span><span class="ftot tn">${at.length ? `${at.length}${pcs ? ` · ${pcs.toLocaleString('en-GB')} pcs` : ` ${at.length === 1 ? 'order' : 'orders'}`}` : '—'}</span></div>
<div class="fb">${at.slice(0, MAX_BLOCKS).map((o, k) => {
        const f = flow.get(o.id)!, h = Math.round(raw[k] * fit);
        return `<a class="blk blk-${f}${ui.show !== 'all' && ui.show !== f ? ' dim' : ''}" href="#/order/${o.id}" style="height:${h}px" aria-label="${esc(o.code)}, ${esc(o.clients?.brand ?? '')}, ${FLOW[f].label}${o.qty ? `, ${o.qty} pieces` : ''}"><span>${esc(o.code)}</span>${h >= 46 && o.qty ? `<small>${o.qty} pcs</small>` : ''}</a>`;
      }).join('')}${at.length > MAX_BLOCKS ? `<a class="t3" href="#/orders" style="font-size:12px;text-align:center">+ ${at.length - MAX_BLOCKS} more</a>` : ''}</div>
<div class="ff"><span style="font-size:12px;line-height:16px;color:var(--t3);white-space:nowrap">${at.length ? `<b class="tn" style="color:var(--t1);font-weight:600">${Math.max(...at.map((o) => daysSince(enteredStage(o))))} d</b> longest` : '&nbsp;'}</span></div></div>`;
    }).join('')}</div></div>
<div class="row" style="padding:12px 22px 18px;gap:8px 18px;font-size:12.5px;color:var(--t2)">${(Object.keys(FLOW) as Flow[]).map((k) => `<span class="leg"><span class="swb blk-${k}" aria-hidden="true"></span>${FLOW[k].label}</span>`).join('')}<span class="t3">Block height: pieces</span></div></section>
<section class="card focus c4" aria-labelledby="nd-h"><div class="ch"><span style="display:flex;flex-direction:column;gap:6px"><span class="kick">02 — Attention</span><h2 id="nd-h" class="sc ct">Needs you</h2></span><span class="sc tn" style="font-size:50px;line-height:44px">${pad(nYou)}</span></div>
<div style="padding:14px 22px 4px"><div class="seg" role="group" aria-label="Show">${([['all', 'All', nYou], ['inbox', 'Inbox', inbox.length], ['orders', 'Orders', orderNeeds.length]] as const).map(([k, label, n]) => `<button type="button" data-needs="${k}" aria-pressed="${ui.needs === k}">${label}<span class="n">${n}</span></button>`).join('')}</div></div>
<div style="padding:8px 10px;display:flex;flex-direction:column;gap:2px">${needs.map((n) => n.row).join('') || `<div class="okr"><span class="ok" aria-hidden="true">${ICON.check}</span><span>All clear: nothing waits on you here.</span></div>`}</div>
<div style="margin:auto 22px 18px;padding-top:14px;border-top:1px solid var(--bd);display:flex;justify-content:space-between;gap:12px;font-size:12.5px"><a href="#/inbox" style="font-weight:500">Inbox →</a><a href="#/approvals" style="font-weight:500">Approvals →</a></div></section>
<section class="card c4" aria-labelledby="dd-h"><div class="ch"><span style="display:flex;flex-direction:column;gap:6px"><span class="kick">03 — Dates</span><h2 id="dd-h" class="sc ct">Deadlines</h2></span><span class="cm" style="padding-top:4px">${day(days[0])} – ${day(days[13])}</span></div>
<div style="padding:16px 22px 18px;display:flex;flex-direction:column;gap:12px">
<div class="cal" role="list" aria-label="Delivery dates, next two weeks">${days.map((d, i) => {
      const n = due.filter((o) => o.due_on === d), weekend = [5, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());
      return `<span class="day${i === 0 ? ' today' : ''}${weekend ? ' wk' : ''}" role="listitem" title="${n.length ? esc(n.map((o) => `${o.code} due`).join(', ')) : ''}"><span style="font-size:12px;line-height:13px;color:var(--t3)">${wd(d)}</span><b class="tn">${Number(d.slice(8))}</b><span class="dots">${n.slice(0, 3).map((o) => `<span class="${FLOW[flow.get(o.id)!].mark}" aria-hidden="true"></span>`).join('')}</span><span class="sr">${n.length ? `${n.length} due` : ''}</span></span>`;
    }).join('')}</div>
<div>${[...late, ...soon.filter((o) => !isLate(o))].slice(0, 6).map((o) => `<a class="dlr${isLate(o) ? ' late' : ''}" href="#/order/${o.id}"><span style="display:flex;flex-direction:column"><b class="sc tn" style="font-size:26px;line-height:24px;font-weight:600">${Number(o.due_on!.slice(8))}</b><span style="font-size:12px;color:var(--t3)">${wd(o.due_on!)}</span></span>
<span style="min-width:0;display:flex;flex-direction:column"><span style="font-size:13.5px;font-weight:500;display:flex;align-items:center;gap:7px"><span class="${FLOW[flow.get(o.id)!].mark}" aria-hidden="true"></span>${isLate(o) ? `Delivery · ${daysSince(`${o.due_on}T00:00:00Z`)} d late` : 'Delivery due'}</span><span style="font-size:12.5px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="mono">${esc(o.code)}</span> · ${esc(o.clients?.brand ?? '—')} · ${esc(o.name)}</span></span><span class="mono t3">${day(o.due_on!)}</span></a>`).join('')
      || `<span class="hint">${due.length ? `Next delivery: ${esc(due[0].code)} on ${day(due[0].due_on!)}.` : 'No order has a delivery date yet. Set one under Details on the order.'}</span>`}</div></div></section>
<section class="card c8" aria-labelledby="lg-h"><div class="ch"><span style="display:flex;flex-direction:column;gap:6px"><span class="kick">04 — Log</span><h2 id="lg-h" class="sc ct">Activity</h2></span><span class="cm">Every order</span></div>
<div class="cb scroll-x">${log.length ? `<table class="tbl log"><tbody>${log.map(({ o, e }) => `<tr><td>${when(e.created_at)}</td><td>${esc(logLine(e))}<br><span class="t3" style="font-size:12px"><a class="mono" href="#/order/${o.id}">${esc(o.code)}</a> · ${esc(o.clients?.brand ?? '—')}</span></td><td class="t3" style="white-space:nowrap">${esc(e.side === 'staff' ? e.actor_label : `${e.actor_label} (client)`)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nothing logged yet. Opening an order starts its log.</div>'}</div></section>
</div>`;
  }

  draw();
  moveOnClick(v, async () => { orders = await api.board(); draw(); });
  v.main.addEventListener('click', (e) => {
    const t = e.target as HTMLElement, s = t.closest<HTMLElement>('[data-show]'), n = t.closest<HTMLElement>('[data-needs]');
    if (s) { ui.show = s.dataset.show as Show; draw(); }
    if (n) { ui.needs = n.dataset.needs as typeof ui.needs; draw(); }
  }, { signal: v.signal });
}

function inboxRow(who: string, code: string, what: string, at: string, href: string) {
  return `<div class="q"><span class="thi" aria-hidden="true">${ICON.inbox}</span>
<span style="min-width:0;display:flex;flex-direction:column;gap:2px"><span style="display:flex;align-items:baseline;gap:8px;min-width:0"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(who)}</span><span class="mono t3">${esc(code)}</span></span>
<span class="t2" style="font-size:13px;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(what)} <span class="t3">· ${age(at)}</span></span></span>
<a class="qa" href="${href}">Open</a></div>`;
}
