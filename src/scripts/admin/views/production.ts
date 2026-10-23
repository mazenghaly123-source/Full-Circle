// Production: the floor as a board, a column per stage and a card per open order, with its pieces,
// the brand, the days at this stage, the delivery date and whose move it is. What waits on us comes
// first, above the board; only a Move button changes a stage, never an approval.
import * as api from '../api';
import type { View } from '../app';
import { STAGES } from '../../../data/site';
import { FLOW, ICON, day, daysSince, enteredStage, esc, flowOf, isLate, isOpen, needsOf, pad, waitingOn, type Flow } from '../ui';
import { moveOnClick, needRow } from './needs';

const SHOW = [['all', 'All'], ['us', 'Needs us'], ['late', 'Late'], ['work', 'In work'], ['client', 'With client']] as const;
type Show = (typeof SHOW)[number][0];
const ui = { show: 'all' as Show };

const pcsOf = (list: api.BoardOrder[]) => list.reduce((n, o) => n + (o.qty ?? 0), 0);

/** The line under a card saying whose move it is. */
function next(o: api.BoardOrder, f: Flow) {
  const need = needsOf(o)[0], open = o.order_decisions.find((d) => d.status === 'open');
  const text = f === 'us' && need ? (need.kind === 'approved' ? `Approved: move it on` : need.kind === 'changes' ? 'Changes asked' : `Photo asked of ${pad(need.stage)}`)
    : f === 'late' ? `${daysSince(`${o.due_on}T00:00:00Z`)} d past the delivery date`
    : f === 'client' ? `With ${esc(o.clients?.brand ?? 'the client')}: ${esc(open?.title ?? 'a decision')}`
    : o.status === 'paused' ? 'Paused' : 'In work';
  return `<span class="onx"><span class="${FLOW[f].mark}" aria-hidden="true"></span>${text}</span>`;
}

export async function productionView(v: View) {
  let all = await api.board();
  const q = document.getElementById('q') as HTMLInputElement;
  const matches = (o: api.BoardOrder) => {
    const s = q.value.trim().toLowerCase();
    return !s || [o.code, o.name, o.product, o.clients?.brand].some((t) => t?.toLowerCase().includes(s));
  };

  function draw() {
    const open = all.filter(isOpen), flow = new Map(open.map((o) => [o.id, flowOf(o)]));
    const needs = open.filter(matches).flatMap(needsOf).sort((a, b) => a.at.localeCompare(b.at));
    const pieces = open.reduce((n, o) => n + (o.qty ?? 0), 0), late = open.filter(isLate).length;
    const shown = (o: api.BoardOrder) => matches(o) && (ui.show === 'all' || flow.get(o.id) === ui.show);
    const count = (k: Show) => open.filter((o) => k === 'all' || flow.get(o.id) === k).length;

    v.main.innerHTML = `<section class="mast"><div style="display:flex;flex-direction:column;gap:6px"><span class="kick">${open.length} open ${open.length === 1 ? 'order' : 'orders'} · ${pieces.toLocaleString('en-GB')} pieces</span><h1 class="sc">Production</h1></div>
<p>${needs.length ? `${needs.length} ${needs.length === 1 ? 'thing waits' : 'things wait'} on us. ` : 'Nothing waits on us. '}${late ? `${late} ${late === 1 ? 'order is' : 'orders are'} past the delivery date. ` : ''}${open.filter((o) => waitingOn(o) === 'client').length} with clients.</p></section>
<section class="card focus" aria-labelledby="w-h"><div class="ch"><span><span class="kick">01 — Attention</span><h2 id="w-h" class="sc ct" style="margin-top:6px">Waiting on us</h2></span><span class="sc tn" style="font-size:44px;line-height:40px">${pad(needs.length)}</span></div>
<div class="cb" style="gap:2px">${needs.length ? `<div class="wq2">${needs.map(needRow).join('')}</div>` : `<div class="okr"><span class="ok" aria-hidden="true">${ICON.check}</span><span>Nothing waits on us${q.value.trim() ? ' in this search' : ''}.</span></div>`}
<span class="hint" style="margin-top:6px">Approving never moves a stage. The approval is logged and the client's portal says “Approved, waiting on Full Circle”; only a Move button moves the order.</span></div></section>
<section class="card" aria-labelledby="b-h"><div class="ch"><span><span class="kick">02 — Floor</span><h2 id="b-h" class="sc ct" style="margin-top:6px">Production board</h2></span><a class="pill" href="#/orders">All orders</a></div>
<div class="row" role="group" aria-label="Show" style="padding:14px 22px 14px;gap:6px 8px">${SHOW.map(([k, label]) => `<button type="button" class="chip" data-show="${k}" aria-pressed="${ui.show === k}">${k === 'all' ? '' : `<span class="${FLOW[k as Flow].mark}" aria-hidden="true"></span>`}${label}<span class="n">${count(k)}</span></button>`).join('')}</div>
<div class="scroll-x" style="padding-bottom:4px"><div class="bd">${STAGES.map((s, i) => {
      const at = open.filter((o) => o.stage === i + 1).sort((a, b) => daysSince(enteredStage(b)) - daysSince(enteredStage(a)));
      return `<section class="bcl" aria-label="${pad(i + 1)} ${esc(s.n)}"><div class="bch"><span class="mono t3">${pad(i + 1)}</span><span class="bnm">${esc(s.n)}</span><span class="t3 tn" style="font-size:12px">${at.length ? `${at.length}${pcsOf(at) ? ` · ${pcsOf(at).toLocaleString('en-GB')} pcs` : ` ${at.length === 1 ? 'order' : 'orders'}`}` : 'None'}</span></div>
${at.map((o) => {
        const f = flow.get(o.id)!, d = daysSince(enteredStage(o));
        return `<a class="oc${shown(o) ? '' : ' dim'}" href="#/order/${o.id}" aria-label="${esc(o.code)}, ${esc(o.clients?.brand ?? '')}, ${FLOW[f].label}"><span class="edge e-${f}" aria-hidden="true"></span><span class="ob">
<span class="r1"><span class="mono">${esc(o.code)}</span>${o.qty ? `<span class="mono t3">${o.qty} pcs</span>` : ''}</span>
<span class="obr">${esc(o.clients?.brand ?? '—')}</span><span class="oit">${esc(o.name)}</span>
<span class="odl">Day <b class="tn">${d + 1}</b> here${o.due_on ? ` · Due <b>${day(o.due_on)}</b>` : ''}</span>${next(o, f)}</span></a>`;
      }).join('')}</section>`;
    }).join('')}</div></div>
${open.length ? '' : '<div class="cb"><div class="empty">No open orders. Convert a request in the Inbox, or start a New order.</div></div>'}
<div class="well kw"><div class="kr">${(Object.keys(FLOW) as Flow[]).map((k) => `<span class="ki"><span class="kedge e-${k}" aria-hidden="true"></span>${FLOW[k].label}</span>`).join('')}</div>
<span>Day: days at this stage, from the last move. Due: the delivery date. Faded: not in the filter or the search.</span></div></section>`;
  }

  draw();
  q.addEventListener('input', draw, { signal: v.signal });
  moveOnClick(v, async () => { all = await api.board(); draw(); });
  v.main.addEventListener('click', (e) => {
    const s = (e.target as HTMLElement).closest<HTMLElement>('[data-show]');
    if (s) { ui.show = s.dataset.show as Show; draw(); }
  }, { signal: v.signal });
}
