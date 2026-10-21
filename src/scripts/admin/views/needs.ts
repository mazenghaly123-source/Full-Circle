// What waits on us, as Overview, Production and Approvals list it: one row per thing, with the action
// that answers it. An approval moves the order on from the row; the rest open the order's page.
import * as api from '../api';
import type { View } from '../app';
import { ICON, age, esc, failed, stageName, toast, type Need } from '../ui';

export function needRow(n: Need) {
  const what = n.kind === 'approved' ? `${esc(n.who)} approved ${esc(n.title)}` : n.kind === 'changes' ? `${esc(n.who)} asked for changes to ${esc(n.title)}` : `${esc(n.who)} asked for a ${esc(n.title.toLowerCase())}`;
  const next = n.o.stage + 1;
  const action = n.kind === 'approved' && next <= 8 ? `<button type="button" class="qa qa-p" data-move="${n.o.id}" data-to="${next}" data-code="${esc(n.o.code)}">Move to ${stageName(next)}</button>`
    : `<a class="qa" href="#/order/${n.o.id}">${n.kind === 'changes' ? 'Send the revision' : n.kind === 'photo' ? 'Add photo' : 'Open order'}</a>`;
  return `<div class="q"><span class="thi" aria-hidden="true">${n.kind === 'photo' ? ICON.photo : ICON.approvals}</span>
<span style="min-width:0;display:flex;flex-direction:column;gap:2px"><span style="display:flex;align-items:baseline;gap:8px;min-width:0"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.o.clients?.brand ?? '—')}</span><a class="mono t3" href="#/order/${n.o.id}">${esc(n.o.code)}</a></span>
<span class="t2" style="font-size:13px;line-height:17px">${what}${n.note ? `: “${esc(n.note)}”` : ''} <span class="t3">· ${age(n.at)}</span></span></span>
${action}</div>`;
}

/** Moves an order on from a row's button (the database still holds the sample gate), then redraws. */
export function moveOnClick(v: View, reload: () => Promise<void>) {
  v.main.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-move]');
    if (!b) return;
    b.disabled = true;
    try {
      await api.rpc('move_stage', { p_order: Number(b.dataset.move), p_to: Number(b.dataset.to), p_note: null });
      await reload();
      toast(`${b.dataset.code} moved to ${stageName(Number(b.dataset.to))}`);
      v.counts();
    } catch (err) { failed(err); b.disabled = false; }
  }, { signal: v.signal });
}
