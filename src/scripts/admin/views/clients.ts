// Clients: each brand, the people who sign in for it (portal) and its orders. Add a client, or add
// someone to one: they get an email with the portal link and sign in with a code.
import { readContact } from '../../../../supabase/functions/_shared/forms';
import * as api from '../api';
import type { View } from '../app';
import { day, dialog, esc, failed, field, fields, ring8, stageName, toast } from '../ui';

export async function clientsView(v: View) {
  let list = await api.clients();
  const q = document.getElementById('q') as HTMLInputElement;
  const matches = (c: api.Client) => {
    const s = q.value.trim().toLowerCase();
    return !s || [c.brand, ...c.client_members.flatMap((m) => [m.name, m.email, m.whatsapp ?? '']), ...c.orders.map((o) => o.code)].some((t) => t.toLowerCase().includes(s));
  };

  function draw() {
    const shown = list.filter(matches);
    const pick = list.find((c) => c.id === Number(v.parts[1])) ?? shown[0] ?? null;
    const noPeople = list.filter((c) => !c.client_members.length).length;
    v.main.innerHTML = `<section class="mast"><div style="display:flex;flex-direction:column;gap:6px"><span class="kick">${list.length} ${list.length === 1 ? 'brand' : 'brands'}</span><h1 class="sc">Clients</h1></div>
<p>${noPeople ? `${noPeople} ${noPeople === 1 ? 'has' : 'have'} nobody who can sign in to the portal yet. ` : ''}A client's people follow its orders on the portal.</p></section>
<div class="split">
<section class="card" aria-labelledby="c-h"><div class="ch"><span><span class="kick">01 — Brands</span><h2 id="c-h" class="sc ct" style="margin-top:6px">All clients</h2></span><button type="button" class="pill" data-new-client>Add a client</button></div>
<div class="cb" style="gap:2px">${shown.map((c) => `<a class="li${c === pick ? ' on' : ''}" href="#/clients/${c.id}" aria-current="${c === pick}" style="grid-template-columns:minmax(0,1fr) auto">
<span style="display:flex;flex-direction:column;gap:3px;min-width:0"><span style="font-weight:500">${esc(c.brand)}</span><span class="t3" style="font-size:12.5px">${c.client_members.length ? esc(c.client_members.map((m) => m.name).join(' · ')) : 'Nobody signs in yet'}</span></span>
<span class="mono t3">${c.orders.length} ${c.orders.length === 1 ? 'order' : 'orders'}</span></a>`).join('') || `<div class="empty">${list.length ? 'No client matches the search.' : 'No clients yet. Converting a request adds one.'}</div>`}</div></section>
<section class="card hero" aria-live="polite" id="detail">${pick ? `<div class="ch"><span><span class="kick">02 — Client</span><h2 class="sc ct" style="margin-top:6px">${esc(pick.brand)}</h2></span><span class="cm">Since ${day(pick.created_at)}</span></div>
<div class="cb">
<div class="divk">People who sign in</div>
${pick.client_members.length ? pick.client_members.map((m) => `<div class="row" style="justify-content:space-between"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:500">${esc(m.name)}</span><span class="t3" style="font-size:12.5px">${esc(m.email)}${m.whatsapp ? ` · ${esc(m.whatsapp)}` : ''}</span></span><span class="mono t3">added ${day(m.created_at)}</span></div>`).join('') : '<span class="hint">Nobody yet. Add the person who follows the orders: they get an email with the link and sign in with a code.</span>'}
<form id="inv" class="stack" style="gap:10px" novalidate><div class="g2">${field('Name', 'name', '')}${field('Email (they sign in with it)', 'email', '', { type: 'email' })}</div>
${field('WhatsApp (optional)', 'whatsapp', '', { ph: '+20 10 …' })}<span class="errline" id="inv-err" role="alert"></span><div class="row"><button type="submit" class="pill bone">Add and email the link</button></div></form>
<div class="divk">Orders</div>
${pick.orders.length ? `<table class="tbl"><tbody>${pick.orders.map((o) => `<tr><td class="mono"><a href="#/order/${o.id}">${esc(o.code)}</a></td><td>${esc(o.name)}</td><td><span class="row" style="gap:8px;flex-wrap:nowrap">${ring8(o.stage)}<span class="t2" style="font-size:12.5px;white-space:nowrap">${stageName(o.stage)}</span></span></td></tr>`).join('')}</tbody></table>` : '<span class="hint">No orders yet.</span>'}
</div>` : '<div class="cb"><div class="empty">Pick a client.</div></div>'}</section></div>`;
  }
  draw();
  // on a phone the client sits under the list: a picked one scrolls to it
  if (v.parts[1] && matchMedia('(max-width: 860px)').matches) v.main.querySelector('#detail')?.scrollIntoView({ block: 'start' });
  q.addEventListener('input', draw, { signal: v.signal });

  v.main.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-new-client]')) return;
    const { el, close } = dialog('Add a client', `<form id="nc" class="stack" novalidate>${field('Brand name', 'brand', '', { req: true })}<span class="errline" id="nc-err" role="alert"></span></form>`,
      '<span></span><div class="row"><button type="button" class="pill ghost" data-close>Cancel</button><button type="submit" form="nc" class="pill red">Add</button></div>');
    el.querySelector('#nc')!.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const brand = fields(el.querySelector('#nc')!).brand;
      if (!brand) { el.querySelector('#nc-err')!.textContent = 'Add the brand name'; return; }
      try { const id = await api.addClient(brand); close(); list = await api.clients(); toast(`${brand} added`); v.go(`#/clients/${id}`); }
      catch (err) { if (err instanceof api.SignedOut) { close(); return failed(err); } el.querySelector('#nc-err')!.textContent = (err as Error).message; }
    });
  }, { signal: v.signal });

  v.main.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement; if (form.id !== 'inv') return;
    const pick = list.find((c) => c.id === Number(v.parts[1])) ?? list.filter(matches)[0];
    const f = fields(form), err = form.querySelector<HTMLElement>('#inv-err')!, email = readContact(f.email);
    if (!pick) return;
    if (!f.name) { err.textContent = 'Add their name'; return; }
    if (email?.channel !== 'email') { err.textContent = 'Add a valid email: it is how they sign in'; return; }
    const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!; btn.disabled = true;
    try {
      const out = await api.invite({ kind: 'client', client_id: pick.id, name: f.name, email: email.email, whatsapp: f.whatsapp || undefined });
      list = await api.clients(); draw();
      toast(out.email === 'sent' ? `${f.name} was emailed the portal link` : `${f.name} can sign in; the email was not sent (${out.email})`);
    } catch (ex) {
      btn.disabled = false;
      if (ex instanceof api.SignedOut) return failed(ex);
      err.textContent = (ex as Error).message;
    }
  }, { signal: v.signal });
}
