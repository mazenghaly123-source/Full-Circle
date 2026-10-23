// Approvals: the decisions with clients (longest first, with links to nudge them on WhatsApp or by
// email), what their answers left for us (an approval to move on, changes to make, a photo to add),
// what clients answered lately, and how often a sample is approved at the first try.
import * as api from '../api';
import type { View } from '../app';
import { ICON, day, daysSince, esc, isOpen, needsOf, stageName, waLink, when } from '../ui';
import { moveOnClick, needRow } from './needs';

const HISTORY_DAYS = 30;
const TABS = [['all', 'All'], ['approved', 'Approved'], ['changes_asked', 'Changes asked'], ['withdrawn', 'Withdrawn']] as const;
type Tab = (typeof TABS)[number][0];
const ui = { tab: 'all' as Tab };

export async function approvalsView(v: View) {
  let all = await api.board();
  const q = document.getElementById('q') as HTMLInputElement;
  const matches = (o: api.BoardOrder) => {
    const s = q.value.trim().toLowerCase();
    return !s || [o.code, o.name, o.clients?.brand].some((t) => t?.toLowerCase().includes(s));
  };

  function draw() {
    const shown = all.filter(matches), live = shown.filter(isOpen);
    const withThem = live.flatMap((o) => o.order_decisions.filter((d) => d.status === 'open').map((d) => ({ o, d }))).sort((a, b) => a.d.opened_at.localeCompare(b.d.opened_at));
    const needs = live.flatMap(needsOf).sort((a, b) => a.at.localeCompare(b.at));
    const since = Date.now() - HISTORY_DAYS * 86_400_000;
    const answered = shown.flatMap((o) => o.order_decisions.filter((d) => d.status !== 'open' && d.closed_at && Date.parse(d.closed_at) >= since).map((d) => ({ o, d })))
      .sort((a, b) => b.d.closed_at!.localeCompare(a.d.closed_at!));
    const history = answered.filter((x) => ui.tab === 'all' || x.d.status === ui.tab);
    // the sample gate: rounds sent at stage 05 (withdrawn ones were never answered) before the approval
    const samples = all.map((o) => o.order_decisions.filter((d) => d.stage === 5 && (d.status === 'approved' || d.status === 'changes_asked')))
      .filter((ds) => ds.some((d) => d.status === 'approved'));
    const first = samples.filter((ds) => ds.length === 1).length;
    const rounds = samples.length ? samples.reduce((n, ds) => n + ds.length, 0) / samples.length : 0;

    v.main.innerHTML = `<section class="mast"><div style="display:flex;flex-direction:column;gap:6px"><span class="kick">${withThem.length} with clients · ${needs.length} waiting on us</span><h1 class="sc">Approvals</h1></div>
<p>${withThem.length ? `${withThem.length} ${withThem.length === 1 ? 'decision waits' : 'decisions wait'} on a client${withThem.length ? `, the longest for ${daysSince(withThem[0].d.opened_at)} d` : ''}. ` : 'No decision waits on a client. '}Approving never moves an order: the client sees “Approved, waiting on Full Circle” until you move it on.</p></section>
<div class="split wl">
<section class="card" aria-labelledby="w-h"><div class="ch"><span><span class="kick">01 — Their move</span><h2 id="w-h" class="sc ct" style="margin-top:6px">With clients</h2></span><span class="cm">Oldest first</span></div>
<div class="cb" style="gap:4px">${withThem.map(({ o, d }) => {
      const text = `Hello, this is Full Circle. A decision on ${o.code} (${o.name}) is waiting for you: ${d.title}. You can answer it at ${location.origin}/track`;
      const links = (o.clients?.client_members ?? []).flatMap((m) => {
        const wa = waLink(m.whatsapp, text.replace('Hello,', `Hello ${m.name},`));
        return [wa ? `<a class="qa" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp ${esc(m.name)}</a>` : '',
          `<a class="qa" href="mailto:${esc(m.email)}?subject=${encodeURIComponent(`${o.code} / Your decision: ${d.title}`)}&amp;body=${encodeURIComponent(text.replace('Hello,', `Hello ${m.name},`))}">Email ${esc(m.name)}</a>`];
      }).filter(Boolean);
      return `<div class="q" style="align-items:start"><span class="thi" aria-hidden="true">${ICON.approvals}</span>
<span style="min-width:0;display:flex;flex-direction:column;gap:3px"><span style="display:flex;align-items:baseline;gap:8px;min-width:0"><span style="font-weight:500">${esc(o.clients?.brand ?? '—')}</span><a class="mono t3" href="#/order/${o.id}">${esc(o.code)}</a></span>
<span style="font-size:13.5px">${esc(d.title)}</span>
<span class="t3" style="font-size:12.5px">${esc(o.name)} · ${stageName(d.stage)} · sent ${day(d.opened_at)} by ${esc(d.opened_label)}<span class="show-s"> · ${daysSince(d.opened_at)} d with them</span></span>
<span class="row" style="gap:6px;margin-top:6px">${links.join('') || '<span class="hint">Nobody on this client can sign in yet.</span>'}<a class="qa" href="#/order/${o.id}">Open order</a></span></span>
<span class="qd" style="display:flex;flex-direction:column;align-items:flex-end"><span class="sc tn" style="font-size:26px;line-height:26px">${daysSince(d.opened_at)}</span><span class="t3" style="font-size:12px">${daysSince(d.opened_at) === 1 ? 'day' : 'days'} with them</span></span></div>`;
    }).join('') || `<div class="empty">${q.value.trim() ? 'No decision matches the search.' : 'No decision waits on a client.'}</div>`}
<span class="hint" style="margin-top:8px">Clients are emailed when a decision opens and see it when they sign in. The links above nudge them yourself.</span></div></section>
<section class="card focus" aria-labelledby="u-h"><div class="ch"><span><span class="kick">02 — Attention</span><h2 id="u-h" class="sc ct" style="margin-top:6px">Waiting on us</h2></span><span class="sc tn" style="font-size:44px;line-height:40px">${String(needs.length).padStart(2, '0')}</span></div>
<div class="cb" style="gap:2px">${needs.map(needRow).join('') || `<div class="okr"><span class="ok" aria-hidden="true">${ICON.check}</span><span>Nothing waits on us${q.value.trim() ? ' in this search' : ''}.</span></div>`}</div></section>
</div>
<section class="card" aria-labelledby="h-h"><div class="ch"><span><span class="kick">03 — Log</span><h2 id="h-h" class="sc ct" style="margin-top:6px">Answered, last ${HISTORY_DAYS} days</h2></span></div>
<div class="cb">
<div class="row" role="group" aria-label="Show">${TABS.map(([k, label]) => `<button type="button" class="chip" data-t="${k}" aria-pressed="${ui.tab === k}">${label}<span class="n">${answered.filter((x) => k === 'all' || x.d.status === k).length}</span></button>`).join('')}</div>
${history.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Answered</th><th>Order</th><th>Decision</th><th>Answer</th><th>In their words</th></tr></thead><tbody>${history.map(({ o, d }) => `<tr>
<td class="mono t3" style="white-space:nowrap">${when(d.closed_at!)}</td><td><a class="mono" href="#/order/${o.id}">${esc(o.code)}</a><br><span class="t3" style="font-size:12px">${esc(o.clients?.brand ?? '—')}</span></td>
<td>${esc(d.title)}<br><span class="t3" style="font-size:12px">${stageName(d.stage)}</span></td>
<td style="white-space:nowrap"><span class="pillS${d.status === 'approved' ? ' ok' : d.status === 'changes_asked' ? ' us' : ''}">${d.status === 'approved' ? 'Approved' : d.status === 'changes_asked' ? 'Changes asked' : 'Withdrawn'}</span><br><span class="t3" style="font-size:12px">by ${esc(d.closed_label ?? '—')}</span></td>
<td class="t2">${d.note ? `“${esc(d.note)}”` : '<span class="t3">—</span>'}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="empty">Nothing answered in the last ${HISTORY_DAYS} days${ui.tab === 'all' ? '' : ' with this answer'}.</div>`}
<span class="hint">Each answer is in the order's approval log, word for word, and is never edited.</span></div></section>
<section class="card" aria-labelledby="g-h"><div class="ch"><span><span class="kick">04 — Sample gate</span><h2 id="g-h" class="sc ct" style="margin-top:6px">First try</h2></span><span class="cm">All orders</span></div>
<div class="cb">${samples.length ? `<div class="facts">
<div class="fc"><span class="kick">Samples approved</span><span class="sc tn" style="font-size:30px;line-height:30px">${samples.length}</span><span class="fs">at 05 Sampling</span></div>
<div class="fc"><span class="kick">First try</span><span class="sc tn" style="font-size:30px;line-height:30px">${Math.round((first / samples.length) * 100)}%</span><span class="fs">${first} of ${samples.length} without a second round</span></div>
<div class="fc"><span class="kick">Rounds per sample</span><span class="sc tn" style="font-size:30px;line-height:30px">${rounds.toFixed(1)}</span><span class="fs">samples sent before the approval</span></div></div>`
    : '<div class="empty">No sample has been approved yet.</div>'}</div></section>`;
  }
  draw();
  q.addEventListener('input', draw, { signal: v.signal });
  moveOnClick(v, async () => { all = await api.board(); draw(); });
  v.main.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-t]');
    if (t) { ui.tab = t.dataset.t as Tab; draw(); }
  }, { signal: v.signal });
}
