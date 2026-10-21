// Convert to order (from a request) or New order (from the top bar): picks or creates the client,
// opens the order at its entry stage with the request's code (docs/adr/0004), and adds the person who
// will follow it, who is emailed the portal link.
import { readContact } from '../../../../supabase/functions/_shared/forms';
import * as api from '../api';
import { dialog, esc, failed, field, fields, select, stageName, toast } from '../ui';

export async function convertDialog(o: { me: api.Staff; go: (h: string) => void; request?: api.Request }) {
  const r = o.request;
  let list: api.Client[] = [];
  try { list = await api.clients(); } catch (err) { return failed(err); }
  // a client whose brand matches the request's is offered first
  const same = r ? list.find((c) => c.brand.trim().toLowerCase() === r.brand.trim().toLowerCase()) : undefined;
  const stage = r?.path === 'Scaling' ? '4' : '1';
  const body = `<form id="cv" class="stack" novalidate>
${r ? `<p class="t2" style="margin:0">${esc(r.code)} becomes the order's code. ${esc(r.brand)} asked about ${esc(r.product)}${r.qty ? `, ${esc(r.qty)} pieces` : ''}.</p>` : '<p class="t2" style="margin:0">An order that did not come through the site (a client on WhatsApp, a repeat order) takes the next code.</p>'}
<div class="divk">Client</div>
${select('Client', 'client', [['new', 'A new client'], ...list.map((c): [string, string] => [String(c.id), c.brand])], same ? String(same.id) : 'new')}
<div id="cv-brand">${field('Brand name', 'brand', r?.brand ?? '', { req: true })}</div>
<div class="divk">Order</div>
<div class="g2">${field('Order name', 'name', r?.product ?? '', { req: true, ph: 'Overshirt' })}${field('Product', 'product', r?.product ?? '', { req: true })}</div>
<div class="g2">${select('Starts at', 'stage', [1, 2, 3, 4, 5, 6, 7, 8].map((n): [string, string] => [String(n), stageName(n)]), stage)}${field('Pieces', 'qty', '', { type: 'number', attrs: ' min="1" inputmode="numeric"' })}</div>
<div class="g2">${field('Fabric', 'fabric', '')}${field('Delivery due', 'due', '', { type: 'date' })}</div>
${field('Line under the name on the portal', 'summary', '', { ph: 'Sample 01 / denim 12 oz / 300 pcs', hint: 'Optional. The client sees it next to the order.' })}
<div class="divk">Who follows it</div>
<div class="g2">${field('Their name', 'person', '')}${field('Email (they sign in with it)', 'email', r?.email ?? '', { type: 'email' })}</div>
${field('WhatsApp (optional)', 'whatsapp', r?.whatsapp ?? '', { ph: '+20 10 …' })}
<label class="row" style="font-size:13px;color:var(--t2)"><input type="checkbox" name="invite" ${r?.email || !r ? 'checked' : ''} style="accent-color:#EEE8DE;width:18px;height:18px">Add them to the portal and email them the link</label>
<span class="errline" id="cv-err" role="alert"></span>
</form>`;
  const foot = `<span class="hint">${r ? 'The request is marked converted.' : ''}</span><div class="row"><button type="button" class="pill ghost" data-close>Cancel</button><button type="submit" form="cv" class="pill red">Open the order</button></div>`;
  const { el, close } = dialog(r ? `Convert ${r.code} to an order` : 'New order', body, foot);
  const form = el.querySelector<HTMLFormElement>('#cv')!, err = el.querySelector<HTMLElement>('#cv-err')!;
  const brandBox = el.querySelector<HTMLElement>('#cv-brand')!;
  const sync = () => { brandBox.hidden = (form.querySelector<HTMLSelectElement>('[name=client]')!.value !== 'new'); };
  form.querySelector('[name=client]')!.addEventListener('change', sync); sync();

  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const f = fields(form);
    const say = (msg: string, name?: string) => { err.textContent = msg; if (name) form.querySelector<HTMLElement>(`[name=${name}]`)?.focus(); };
    if (f.client === 'new' && !f.brand) return say('Add the brand name', 'brand');
    if (!f.name) return say('Name the order', 'name');
    if (!f.product) return say('Add the product', 'product');
    const qty = f.qty ? Number(f.qty) : null;
    if (qty !== null && (!Number.isInteger(qty) || qty < 1)) return say('Pieces is a whole number', 'qty');
    const invite = f.invite === 'on' && (f.person || f.email);
    const email = f.email ? readContact(f.email) : null;
    if (invite && !f.person) return say('Add the name of the person who follows it', 'person');
    if (invite && email?.channel !== 'email') return say('Add their email: it is how they sign in', 'email');

    busy = true; say('');
    const btn = el.querySelector<HTMLButtonElement>('button[type=submit]')!; btn.disabled = true; btn.textContent = 'Opening…';
    try {
      const clientId = f.client === 'new' ? await api.addClient(f.brand) : Number(f.client);
      const orderId = await api.rpc<number>('create_order', {
        p_client: clientId, p_name: f.name, p_product: f.product, p_request: r?.id ?? null, p_entry_stage: Number(f.stage),
        p_summary: f.summary || null, p_fabric: f.fabric || null, p_qty: qty, p_due_on: f.due || null,
      });
      let note = 'Order opened';
      if (invite && email?.channel === 'email') {
        try {
          const out = await api.invite({ kind: 'client', client_id: clientId, name: f.person, email: email.email, whatsapp: f.whatsapp || undefined });
          note = out.email === 'sent' ? `Order opened; ${f.person} was emailed the portal link` : `Order opened; ${f.person} can sign in (the email was not sent: ${out.email})`;
        } catch (ie) {
          if (ie instanceof api.SignedOut) throw ie;
          note = `Order opened; adding ${f.person} failed: ${(ie as Error).message}`;
        }
      }
      close(); toast(note); o.go(`#/order/${orderId}`);
    } catch (ex) {
      busy = false; btn.disabled = false; btn.textContent = 'Open the order';
      if (ex instanceof api.SignedOut) { close(); return failed(ex); }
      say(ex instanceof Error ? ex.message : 'Could not open the order');
    }
  });
}
