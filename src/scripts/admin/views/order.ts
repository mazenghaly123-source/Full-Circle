// An order's page: what needs us now, the stage (and moving it), the decision with the client, stage
// photos, specs and details, the people who follow it, the approval log and the messages sent. Every
// change goes through a database function that writes the log; the client is emailed by notify.
import * as api from '../api';
import type { View } from '../app';
import { day, dialog, esc, failed, field, fields, logLine, pad, sampleApproved, select, stageName, toast, waitingOn, when } from '../ui';

const STATUS: [api.Status, string][] = [['active', 'Active'], ['paused', 'Paused'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
const EVENT: Record<string, string> = {
  decision_opened: 'Decision waiting', stage_moved: 'Stage moved', photo_added: 'New photo',
  decision_approved: 'Approved', changes_asked: 'Changes asked', photo_asked: 'Photo asked',
};

export async function orderView(v: View) {
  const id = Number(v.parts[1]);
  let o = Number.isInteger(id) ? await api.order(id) : null;
  if (!o) { v.main.innerHTML = '<div class="empty">That order does not exist, or was deleted. <a class="pill" href="#/orders">All orders</a></div>'; return; }
  let urls = await api.signed(o.stage_photos.map((p) => p.object_path));
  const ui = { photoStage: o.stage };

  async function reload(msg?: string) {
    const next = await api.order(id);
    if (!next || v.signal.aborted) return;
    o = next;
    const missing = o.stage_photos.map((p) => p.object_path).filter((p) => !urls[p]);
    if (missing.length) urls = { ...urls, ...await api.signed(missing) };
    const y = scrollY; draw(); scrollTo(0, y);
    if (msg) toast(msg);
    v.counts();
  }
  /** Runs a change; on success shows the order as it now is. */
  async function act(work: () => Promise<unknown>, msg: string, btn?: HTMLButtonElement | null) {
    if (btn) btn.disabled = true;
    try { await work(); await reload(msg); } catch (err) { failed(err); if (btn) btn.disabled = false; }
  }

  const thumb = (p: api.Photo, pick?: boolean) => `<${pick ? 'label' : 'span'} class="thumb">${urls[p.object_path] ? `<img src="${esc(urls[p.object_path])}" alt="${esc(p.caption ?? `Photo at ${stageName(p.stage)}`)}" loading="lazy">` : ''}
${pick ? `<input type="checkbox" name="photo" value="${p.id}" aria-label="Show photo ${p.id} with the decision">` : ''}<span class="cap">${pad(p.stage)}${p.caption ? ` · ${esc(p.caption)}` : ''}</span></${pick ? 'label' : 'span'}>`;

  function draw() {
    const x = o!, w = waitingOn(x), brand = x.clients?.brand ?? '—', people = x.clients?.client_members ?? [];
    const open = x.order_decisions.find((d) => d.status === 'open');
    const events = [...x.order_events].sort((a, b) => b.id - a.id);
    const answered = events.find((e) => e.kind === 'approved' || e.kind === 'changes_asked');
    const movedSince = answered && events.some((e) => e.kind === 'stage_moved' && e.id > answered.id);
    const askedPhotos = x.photo_requests.filter((r) => !r.answered_at);
    const gateOpen = sampleApproved(x.order_decisions);
    const next = Math.min(x.stage + 1, 8);

    // what needs us, with the action that answers it
    const needs: string[] = [];
    if (answered && !movedSince && answered.kind === 'approved') needs.push(`<div class="okr"><span class="ok" aria-hidden="true">✓</span><span style="flex:1"><b style="color:var(--t1);font-weight:500">${esc(answered.actor_label)} approved ${esc(answered.title ?? 'the decision')}</b><br>${when(answered.created_at)}. Approving does not move the order: move it on when it is ready.</span>${x.stage < 8 ? `<button type="button" class="qa qa-p" data-move="${next}">Move to ${stageName(next)}</button>` : ''}</div>`);
    if (answered && !movedSince && answered.kind === 'changes_asked') needs.push(`<div class="okr"><span class="mk mk-us" aria-hidden="true"></span><span style="flex:1"><b style="color:var(--t1);font-weight:500">${esc(answered.actor_label)} asked for changes to ${esc(answered.title ?? 'the decision')}</b><br>${answered.note ? `“${esc(answered.note)}” · ` : ''}${when(answered.created_at)}. Make them, then send the revised version.</span>${open ? '' : `<button type="button" class="qa qa-p" data-decide="${esc(answered.title ?? '')}">Send the revised version</button>`}</div>`);
    for (const r of askedPhotos) needs.push(`<div class="okr"><span class="mk mk-us" aria-hidden="true"></span><span style="flex:1"><b style="color:var(--t1);font-weight:500">${esc(r.asked_label)} asked for a photo of ${stageName(r.stage)}</b><br>${r.note ? `“${esc(r.note)}” · ` : ''}${when(r.created_at)}. A photo added at that stage answers it.</span><button type="button" class="qa qa-p" data-photo-for="${r.stage}">Add a photo</button></div>`);

    v.main.innerHTML = `<nav class="crumb" aria-label="Breadcrumb"><a href="#/orders">02 Orders</a><span aria-hidden="true">/</span><span aria-current="page">${esc(x.code)}</span></nav>
<section class="mast"><div style="display:flex;flex-direction:column;gap:6px"><span class="kick">${esc(x.code)} · ${esc(brand)}</span><h1 class="sc">${esc(x.name)}</h1></div>
<p>${x.status !== 'active' ? `${STATUS.find(([k]) => k === x.status)![1]}. ` : ''}${w === 'us' ? 'Waiting on us: see below.' : w === 'client' ? `Waiting on ${esc(brand)}: ${esc(open?.title ?? 'a decision')}.` : `At ${stageName(x.stage)}; nothing waits on anyone.`}</p></section>
<section class="facts" aria-label="Order facts">
<div class="fc"><span class="kick">Client</span><a class="fv" href="#/clients/${x.client_id}">${esc(brand)}</a><span class="fs">${people.length ? esc(people.map((p) => p.name).join(' · ')) : 'Nobody follows it yet'}</span></div>
<div class="fc"><span class="kick">Stage</span><span class="fv">${stageName(x.stage)}</span><span class="fs">${x.stage <= 5 ? (gateOpen ? 'Sample approved' : 'Bulk waits for a sample approval') : 'After the sample gate'}</span></div>
<div class="fc"><span class="kick">Delivery due</span><span class="fv tn">${x.due_on ? day(x.due_on) : '—'}</span><span class="fs">${esc(x.product)}</span></div>
<div class="fc"><span class="kick">Pieces</span><span class="fv tn">${x.qty ?? '—'}</span><span class="fs">${esc(x.fabric ?? '')}</span></div>
</section>
<div class="split wl">
<div class="stack">
${needs.length ? `<section class="card focus" aria-labelledby="n-h"><div class="ch"><span><span class="kick">01 — Needs us</span><h2 id="n-h" class="sc ct" style="margin-top:6px">${needs.length === 1 ? 'One thing' : `${needs.length} things`} to do</h2></span></div><div class="cb">${needs.join('')}</div></section>` : ''}
<section class="card hero" aria-labelledby="s-h"><div class="ch"><span><span class="kick">02 — Stage</span><h2 id="s-h" class="sc ct" style="margin-top:6px">${stageName(x.stage)}</h2></span></div>
<div class="cb"><div class="steps">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<span class="step${n < x.stage ? ' d' : n === x.stage ? ' c' : ''}"><b>${pad(n)}</b>${stageName(n).slice(3)}</span>`).join('')}</div>
<form id="mv" class="row" style="align-items:flex-end">${select('Move to', 'to', [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => n !== x.stage).map((n): [string, string] => [String(n), stageName(n)]), String(next === x.stage ? x.stage - 1 : next))}
<div style="flex:1;min-width:200px">${field('Note for the log (the client sees it)', 'note', '', { ph: 'Optional' })}</div><button type="submit" class="pill">Move</button></form>
<span class="hint">${people.length ? `${esc(people.map((p) => p.name).join(' and '))} ${people.length === 1 ? 'is' : 'are'} emailed when it moves.` : 'Nobody follows this order yet, so nobody is told.'}${x.stage <= 5 && !gateOpen ? ' It cannot go past 05 Sampling until the client approves a sample decision opened at 05.' : ''}</span></div></section>
<section class="card" aria-labelledby="d-h"><div class="ch"><span><span class="kick">03 — Decision</span><h2 id="d-h" class="sc ct" style="margin-top:6px">${open ? esc(open.title) : 'Nothing waits on the client'}</h2></span>${open ? '<button type="button" class="pill ghost" data-withdraw>Withdraw</button>' : '<button type="button" class="pill" data-decide="">Ask for a decision</button>'}</div>
<div class="cb">${open ? `${open.body ? `<p class="t2" style="margin:0;white-space:pre-wrap">${esc(open.body)}</p>` : ''}
${open.photo_ids.length ? `<div class="photos">${x.stage_photos.filter((p) => open.photo_ids.includes(p.id)).map((p) => thumb(p)).join('')}</div>` : ''}
<span class="hint">Sent ${when(open.opened_at)} by ${esc(open.opened_label)}, at ${stageName(open.stage)}. The client approves or asks for changes on the portal.</span>`
    : '<span class="hint">Ask the client to approve what this stage made: the brief, the tech pack, a fabric, a pattern, a sample. One decision is open at a time.</span>'}
${x.order_decisions.filter((d) => d.status !== 'open').length ? `<div class="divk">Earlier</div>${[...x.order_decisions].filter((d) => d.status !== 'open').sort((a, b) => b.id - a.id).map((d) => `<div class="row" style="justify-content:space-between;font-size:13px"><span>${esc(d.title)} <span class="t3">· ${stageName(d.stage)}</span></span><span class="pillS${d.status === 'approved' ? ' ok' : ''}">${{ approved: 'Approved', changes_asked: 'Changes asked', withdrawn: 'Withdrawn', open: '' }[d.status]}${d.closed_at ? ` · ${day(d.closed_at)}` : ''}</span></div>`).join('')}` : ''}
</div></section>
<section class="card" aria-labelledby="p-h" id="photos"><div class="ch"><span><span class="kick">04 — Photos</span><h2 id="p-h" class="sc ct" style="margin-top:6px">Stage photos</h2></span><span class="cm">${x.stage_photos.length} on the portal</span></div>
<div class="cb"><form id="up" class="row" style="align-items:flex-end">
${select('At stage', 'stage', [1, 2, 3, 4, 5, 6, 7, 8].map((n): [string, string] => [String(n), stageName(n)]), String(ui.photoStage))}
<div style="flex:1;min-width:180px">${field('Caption (optional)', 'caption', '')}</div>
<label class="pill bone" style="cursor:pointer">Add photos<input type="file" name="files" accept="image/*" multiple hidden></label></form>
<span class="hint">Photos are resized on this device before they are sent. The client sees them on the portal and is emailed once for the batch.</span>
${x.stage_photos.length ? `<div class="photos">${[...x.stage_photos].sort((a, b) => b.id - a.id).map((p) => thumb(p)).join('')}</div>` : '<div class="empty">No photos yet.</div>'}
</div></section>
</div>
<div class="stack">
<section class="card" aria-labelledby="dt-h"><div class="ch"><span><span class="kick">05 — Details</span><h2 id="dt-h" class="sc ct" style="margin-top:6px">Order</h2></span></div>
<form id="det" class="cb">
${field('Name', 'name', x.name)}${field('Product', 'product', x.product)}${field('Line on the portal', 'summary', x.summary ?? '')}
<div class="g2">${field('Fabric', 'fabric', x.fabric ?? '')}${field('Pieces', 'qty', x.qty ? String(x.qty) : '', { type: 'number', attrs: ' min="1"' })}</div>
<div class="g2">${field('Delivery due', 'due', x.due_on ?? '', { type: 'date' })}${select('Status', 'status', STATUS, x.status)}</div>
<div class="row"><button type="submit" class="pill">Save details</button></div></form></section>
<section class="card" aria-labelledby="sp-h"><div class="ch"><span><span class="kick">06 — Specs</span><h2 id="sp-h" class="sc ct" style="margin-top:6px">What the client sees</h2></span></div>
<form id="sp" class="cb"><div id="sp-rows" class="stack" style="gap:8px">${[...x.order_specs].sort((a, b) => a.position - b.position).map((r) => specRow(r.key, r.value)).join('')}</div>
<div class="row"><button type="button" class="pill ghost" data-add-spec>Add a row</button><button type="submit" class="pill">Save specs</button></div></form></section>
<section class="card" aria-labelledby="pp-h"><div class="ch"><span><span class="kick">07 — People</span><h2 id="pp-h" class="sc ct" style="margin-top:6px">Who follows it</h2></span><a class="pill ghost" href="#/clients/${x.client_id}">Add someone</a></div>
<div class="cb">${people.length ? people.map((p) => `<div style="display:flex;flex-direction:column;gap:2px;font-size:13.5px"><span style="font-weight:500">${esc(p.name)}</span><span class="t3" style="font-size:12.5px">${esc(p.email)}${p.whatsapp ? ` · ${esc(p.whatsapp)}` : ''}</span></div>`).join('') : '<div class="empty">Nobody signs in for this client yet. Add someone on the client\'s page.</div>'}</div></section>
<section class="card" aria-labelledby="ms-h"><div class="ch"><span><span class="kick">08 — Messages</span><h2 id="ms-h" class="sc ct" style="margin-top:6px">Sent about it</h2></span></div>
<div class="cb">${x.order_notifications.length ? `<div class="scroll-x"><table class="tbl"><tbody>${[...x.order_notifications].sort((a, b) => b.id - a.id).slice(0, 12).map((n) => `<tr><td class="mono t3" style="white-space:nowrap">${when(n.created_at)}</td><td>${EVENT[n.event] ?? esc(n.event)}<br><span class="t3" style="font-size:12px">${esc(n.recipient)} · ${n.channel}</span></td><td><span class="pillS${n.status === 'sent' ? ' ok' : n.status === 'failed' ? ' us' : ''}" title="${esc(n.detail ?? '')}">${n.status === 'sent' && n.read_at ? 'read' : n.status === 'sent' && n.delivered_at ? 'delivered' : n.status}</span></td></tr>`).join('')}</tbody></table></div>` : '<span class="hint">Nothing sent yet.</span>'}</div></section>
</div></div>
<section class="card" aria-labelledby="lg-h"><div class="ch"><span><span class="kick">09 — Approval log</span><h2 id="lg-h" class="sc ct" style="margin-top:6px">Everything, in order</h2></span><span class="cm">Never edited or deleted</span></div>
<div class="cb scroll-x"><table class="tbl log"><tbody>${events.map((e) => `<tr><td>${when(e.created_at)}</td><td>${esc(logLine(e))}</td><td class="t3" style="white-space:nowrap">${esc(e.side === 'staff' ? e.actor_label : `${e.actor_label} (client)`)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  const specRow = (k = '', val = '') => `<div class="kv"><div class="inp"><input name="k" value="${esc(k)}" placeholder="Fabric" aria-label="Spec"></div><div class="inp"><input name="v" value="${esc(val)}" placeholder="Denim 12 oz, rinse" aria-label="Value"></div><button type="button" class="more" data-del-spec aria-label="Remove this row">×</button></div>`;

  function decide(title: string) {
    const x = o!;
    const body = `<form id="dc" class="stack" novalidate>
<p class="t2" style="margin:0">At ${stageName(x.stage)}. ${esc(x.clients?.brand ?? 'The client')}'s people are emailed, and approve or ask for changes on the portal.</p>
${field('What they decide', 'title', title, { req: true, ph: 'Approve sample 03' })}
${field('What it is, in a few lines', 'body', '', { area: true, ph: 'Fit and fabric are revised from your notes on sample 02.' })}
${x.stage_photos.length ? `<div class="fl"><span class="lab">Photos to show with it</span><div class="photos">${[...x.stage_photos].sort((a, b) => b.id - a.id).map((p) => thumb(p, true)).join('')}</div></div>` : '<span class="hint">No photos on the order yet: add them under Photos first if the client should see them.</span>'}
<span class="errline" id="dc-err" role="alert"></span></form>`;
    const { el, close } = dialog('Ask for a decision', body, '<span></span><div class="row"><button type="button" class="pill ghost" data-close>Cancel</button><button type="submit" form="dc" class="pill red">Send it to the client</button></div>');
    const form = el.querySelector<HTMLFormElement>('#dc')!;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = fields(form);
      if (!f.title) { el.querySelector('#dc-err')!.textContent = 'Say what they decide'; return; }
      const photos = [...form.querySelectorAll<HTMLInputElement>('input[name=photo]:checked')].map((i) => Number(i.value));
      const btn = el.querySelector<HTMLButtonElement>('button[type=submit]')!; btn.disabled = true;
      try { await api.rpc('open_decision', { p_order: x.id, p_title: f.title, p_body: f.body || null, p_photo_ids: photos }); close(); await reload('Decision sent'); }
      catch (err) { btn.disabled = false; if (err instanceof api.SignedOut) { close(); return failed(err); } el.querySelector('#dc-err')!.textContent = (err as Error).message; }
    });
  }

  draw();
  v.main.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement, x = o!;
    const move = t.closest<HTMLButtonElement>('[data-move]');
    if (move) return act(() => api.rpc('move_stage', { p_order: x.id, p_to: Number(move.dataset.move), p_note: null }), `Moved to ${stageName(Number(move.dataset.move))}`, move);
    const dec = t.closest<HTMLElement>('[data-decide]');
    if (dec) return decide(dec.dataset.decide ?? '');
    const wd = t.closest<HTMLButtonElement>('[data-withdraw]');
    if (wd) {
      const open = x.order_decisions.find((d) => d.status === 'open');
      if (open && confirm(`Withdraw “${open.title}”? The client can no longer answer it; the log keeps it.`)) return act(() => api.rpc('withdraw_decision', { p_decision: open.id }), 'Decision withdrawn', wd);
      return;
    }
    const pf = t.closest<HTMLElement>('[data-photo-for]');
    if (pf) {
      ui.photoStage = Number(pf.dataset.photoFor); draw();
      v.main.querySelector('#photos')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return v.main.querySelector<HTMLInputElement>('#up input[type=file]')!.click();
    }
    if (t.closest('[data-add-spec]')) { v.main.querySelector('#sp-rows')!.insertAdjacentHTML('beforeend', specRow()); v.main.querySelector<HTMLInputElement>('#sp-rows .kv:last-child input')!.focus(); return; }
    if (t.closest('[data-del-spec]')) t.closest('.kv')!.remove();
  }, { signal: v.signal });

  v.main.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement, f = fields(form), x = o!, btn = form.querySelector<HTMLButtonElement>('button[type=submit]');
    if (form.id === 'mv') return act(() => api.rpc('move_stage', { p_order: x.id, p_to: Number(f.to), p_note: f.note || null }), `Moved to ${stageName(Number(f.to))}`, btn);
    if (form.id === 'det') {
      const qty = f.qty ? Number(f.qty) : null;
      if (!f.name || !f.product) return toast('The order needs a name and a product');
      if (qty !== null && (!Number.isInteger(qty) || qty < 1)) return toast('Pieces is a whole number');
      return act(() => api.updateOrder(x.id, { name: f.name, product: f.product, summary: f.summary || null, fabric: f.fabric || null, qty, due_on: f.due || null, status: f.status as api.Status }), 'Details saved', btn);
    }
    if (form.id === 'sp') {
      const rows = [...form.querySelectorAll('.kv')].map((r) => ({ key: r.querySelector<HTMLInputElement>('[name=k]')!.value.trim(), value: r.querySelector<HTMLInputElement>('[name=v]')!.value.trim() })).filter((r) => r.key && r.value);
      if (new Set(rows.map((r) => r.key.toLowerCase())).size !== rows.length) return toast('Each spec name once');
      return act(() => api.saveSpecs(x.id, rows), 'Specs saved', btn);
    }
  }, { signal: v.signal });

  v.main.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    if (input.name === 'stage' && input.closest('#up')) { ui.photoStage = Number(input.value); return; }
    if (input.type !== 'file' || !input.files?.length) return;
    const form = input.closest('form')!, f = fields(form), files = [...input.files];
    const label = input.closest('label')!; label.style.opacity = '.5';
    let done = 0;
    try {
      for (const file of files) { toast(`Sending ${done + 1} of ${files.length}…`); await api.addPhoto(o!.id, Number(f.stage), file, f.caption); done++; }
      await reload(done === 1 ? 'Photo added' : `${done} photos added`);
    } catch (err) {
      failed(err); if (done) await reload();
    } finally { label.style.opacity = ''; input.value = ''; if (done) api.sendQueued(); }
  }, { signal: v.signal });
}
