// Team: Full Circle's own people. Owners add staff (they get an email with the admin link and sign
// in with a code) and change roles; an owner can do everything, staff run requests and orders.
import { readContact } from '../../../../supabase/functions/_shared/forms';
import * as api from '../api';
import type { View } from '../app';
import { day, esc, failed, field, fields, select, toast } from '../ui';

export async function teamView(v: View) {
  let people = await api.team();
  const owner = v.me.role === 'owner';

  function draw() {
    v.main.innerHTML = `<section class="mast"><div style="display:flex;flex-direction:column;gap:6px"><span class="kick">${people.length} on the team</span><h1 class="sc">Team</h1></div>
<p>Owners can do everything, including adding people. Staff answer requests, open orders, ask for decisions, add photos and move stages.</p></section>
<div class="split">
<section class="card" aria-labelledby="t-h"><div class="ch"><span><span class="kick">01 — People</span><h2 id="t-h" class="sc ct" style="margin-top:6px">Full Circle</h2></span></div>
<div class="cb">${people.map((p) => `<div class="row" style="justify-content:space-between"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:500">${esc(p.name)}${p.user_id === v.me.user_id ? ' <span class="t3">(you)</span>' : ''}</span><span class="t3" style="font-size:12.5px">Since ${day(p.created_at)}</span></span><span class="pillS${p.role === 'owner' ? ' ok' : ''}">${p.role === 'owner' ? 'Owner' : 'Staff'}</span></div>`).join('')}</div></section>
<section class="card hero" aria-labelledby="a-h"><div class="ch"><span><span class="kick">02 — Add someone</span><h2 id="a-h" class="sc ct" style="margin-top:6px">${owner ? 'A new member of staff' : 'Owners add people'}</h2></span></div>
<div class="cb">${owner ? `<form id="add" class="stack" style="gap:10px" novalidate><div class="g2">${field('Name', 'name', '')}${field('Work email', 'email', '', { type: 'email' })}</div>
${select('Role', 'role', [['staff', 'Staff'], ['owner', 'Owner']], 'staff')}<span class="errline" id="add-err" role="alert"></span>
<div class="row"><button type="submit" class="pill bone">Add and email the link</button></div></form>` : '<span class="hint">Ask an owner to add people to the team.</span>'}</div></section></div>`;
  }
  draw();

  v.main.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement; if (form.id !== 'add') return;
    const f = fields(form), err = form.querySelector<HTMLElement>('#add-err')!, email = readContact(f.email);
    if (!f.name) { err.textContent = 'Add their name'; return; }
    if (email?.channel !== 'email') { err.textContent = 'Add a valid email: it is how they sign in'; return; }
    const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!; btn.disabled = true;
    try {
      const out = await api.invite({ kind: 'staff', name: f.name, email: email.email, role: f.role === 'owner' ? 'owner' : 'staff' });
      people = await api.team(); draw();
      toast(out.email === 'sent' ? `${f.name} was emailed the admin link` : `${f.name} can sign in; the email was not sent (${out.email})`);
    } catch (ex) {
      btn.disabled = false;
      if (ex instanceof api.SignedOut) return failed(ex);
      err.textContent = (ex as Error).message;
    }
  }, { signal: v.signal });
}
