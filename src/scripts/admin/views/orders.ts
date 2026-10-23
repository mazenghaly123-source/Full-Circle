// Orders: every order, where it is and whose move it is. "Waiting on us" comes first: an approval or
// change request at the current stage that has not been acted on, or a photo the client asked for.
import * as api from '../api';
import type { View } from '../app';
import { day, esc, ring8, stageName, waitPill, waitingOn } from '../ui';

const FILTERS = [['all', 'All'], ['us', 'Waiting on us'], ['client', 'Waiting on client'], ['done', 'Delivered or closed']] as const;
type Filter = (typeof FILTERS)[number][0];
const ui = { filter: 'all' as Filter, stage: 0 };

export async function ordersView(v: View) {
  const all = await api.orders();
  const q = document.getElementById('q') as HTMLInputElement;
  const wait = new Map(all.map((o) => [o.id, waitingOn(o)]));
  const done = (o: api.OrderRow) => o.status === 'delivered' || o.status === 'cancelled';
  const pass = (o: api.OrderRow, f: Filter) => f === 'all' ? !done(o) : f === 'done' ? done(o) : wait.get(o.id) === f;
  const matches = (o: api.OrderRow) => {
    const s = q.value.trim().toLowerCase();
    return !s || [o.code, o.name, o.product, o.clients?.brand].some((t) => t?.toLowerCase().includes(s));
  };
  // ours first, then the client's, then the rest; newest first within each
  const rank = (o: api.OrderRow) => ({ us: 0, client: 1 } as Record<string, number>)[wait.get(o.id) ?? ''] ?? 2;

  function draw() {
    const shown = all.filter((o) => pass(o, ui.filter) && (!ui.stage || o.stage === ui.stage) && matches(o)).sort((a, b) => rank(a) - rank(b));
    const ours = all.filter((o) => wait.get(o.id) === 'us').length, theirs = all.filter((o) => wait.get(o.id) === 'client').length;
    const open = all.filter((o) => !done(o));
    v.main.innerHTML = `<section class="mast"><div style="display:flex;flex-direction:column;gap:6px"><span class="kick">${open.length} open ${open.length === 1 ? 'order' : 'orders'}</span><h1 class="sc">Orders</h1></div>
<p>${ours ? `${ours} ${ours === 1 ? 'waits' : 'wait'} on us. ` : 'Nothing waits on us. '}${theirs ? `${theirs} ${theirs === 1 ? 'waits' : 'wait'} on a client's decision.` : ''}</p></section>
<section class="card" aria-labelledby="o-h"><div class="ch"><span><span class="kick">01 — All orders</span><h2 id="o-h" class="sc ct" style="margin-top:6px">By whose move</h2></span>
<button type="button" class="pill bone" data-new>New order</button></div>
<div class="cb">
<div class="row" role="group" aria-label="Show">${FILTERS.map(([k, label]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${ui.filter === k}">${k === 'us' ? '<span class="mk mk-us" aria-hidden="true"></span>' : k === 'client' ? '<span class="mk mk-client" aria-hidden="true"></span>' : ''}${label}<span class="n">${all.filter((o) => pass(o, k)).length}</span></button>`).join('')}</div>
<div class="row" role="group" aria-label="Stage"><span class="kick">Stage</span>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<button type="button" class="chip" data-s="${n}" aria-pressed="${ui.stage === n}">${n ? String(n).padStart(2, '0') : 'Any'}</button>`).join('')}</div>
<div class="scroll-x"><table class="tbl"><thead><tr><th>Code</th><th>Client</th><th>Order</th><th>Stage</th><th>Whose move</th><th>Due</th></tr></thead><tbody>
${shown.map((o) => `<tr data-o="${o.id}" style="cursor:pointer"><td class="mono"><a href="#/order/${o.id}">${esc(o.code)}</a></td><td>${esc(o.clients?.brand ?? '—')}</td>
<td><span style="font-weight:500">${esc(o.name)}</span><br><span class="t3" style="font-size:12px">${esc(o.summary ?? o.product)}</span></td>
<td><span class="row" style="gap:8px;flex-wrap:nowrap">${ring8(o.stage, wait.get(o.id) === 'us')}<span class="t2" style="font-size:12.5px;white-space:nowrap">${stageName(o.stage)}</span></span></td>
<td>${done(o) ? `<span class="pillS">${o.status === 'delivered' ? 'Delivered' : 'Cancelled'}</span>` : waitPill(wait.get(o.id) ?? null)}</td>
<td class="tn" style="white-space:nowrap">${o.due_on ? day(o.due_on) : '<span class="t3">—</span>'}</td></tr>`).join('')}
</tbody></table></div>
${shown.length ? '' : `<div class="empty">${all.length ? 'No order matches. Pick another filter, or clear the search.' : 'No orders yet. Convert a request in the Inbox, or start a New order.'}</div>`}
</div></section>`;
  }
  draw();
  q.addEventListener('input', draw, { signal: v.signal });
  v.main.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const f = t.closest<HTMLElement>('[data-f]'), s = t.closest<HTMLElement>('[data-s]'), row = t.closest<HTMLElement>('[data-o]');
    if (f) { ui.filter = f.dataset.f as Filter; return draw(); }
    if (s) { ui.stage = Number(s.dataset.s); return draw(); }
    if (t.closest('[data-new]')) return document.getElementById('new-order')!.click();
    if (row && !t.closest('a')) v.go(`#/order/${row.dataset.o}`);
  }, { signal: v.signal });
}
