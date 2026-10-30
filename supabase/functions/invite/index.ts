// Adds a person to a client (they can then sign in to the portal) or to staff (the admin). Creates
// their sign-in account when the email has none, and emails them where to sign in. A client's person
// with a WhatsApp number can sign in with it too, and is told on WhatsApp as well when that number
// asked for updates there.
//
// POST application/json, signed in as staff:
//   { kind: 'client', client_id, name, email, whatsapp? }   any member of staff
//   { kind: 'staff', name, email, role: 'owner' | 'staff' }  owners and developers only
import { readContact, toInternational } from '../_shared/forms.ts';
import { inviteEmail } from '../_shared/emails.ts';
import { caller, crash, db, preflight, refuse, reply, sendEmail, siteUrl } from '../_shared/server.ts';
import { sendWhatsApp, template, type Sent } from '../_shared/whatsapp.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return refuse('Send it with POST', 405);

  let me: string | null;
  try { me = await caller(req); } catch (err) { return crash('caller', err, 'Could not check who you are. Try again'); }
  if (!me) return refuse('Sign in again', 401);
  const client = db();
  let staff: { role: 'owner' | 'developer' | 'staff'; name: string }[];
  try { staff = await client.select('staff', 'role,name', { user_id: `eq.${me}` }); } catch (err) { return crash('staff', err, 'Could not check who you are. Try again'); }
  if (!staff.length) return refuse('Only Full Circle staff can add people', 403);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return refuse('Could not read that. Try again'); }
  if (b.kind !== 'client' && b.kind !== 'staff') return refuse('Say whether they are a client or staff');
  if (b.kind === 'staff' && staff[0].role === 'staff') return refuse('Only an owner or a developer adds staff', 403);
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 120) return refuse('Add their name', 400, 'name');
  const reach = readContact(typeof b.email === 'string' ? b.email : '');
  if (reach?.channel !== 'email') return refuse('Add a valid email: it is how they sign in', 400, 'email');
  let whatsapp: string | null = null;
  if (typeof b.whatsapp === 'string' && b.whatsapp.trim()) {
    whatsapp = toInternational(b.whatsapp);
    if (!whatsapp) return refuse('Add the number with its country code (+20…)', 400, 'whatsapp');
  }

  try {
    const id = (await client.rpc<string | null>('user_id_by_email', { p_email: reach.email })) ?? await client.createUser(reach.email);
    if (b.kind === 'client') {
      const clientId = Number(b.client_id);
      const [brand] = Number.isInteger(clientId) ? await client.select<{ brand: string }>('clients', 'brand', { id: `eq.${clientId}` }) : [];
      if (!brand) return refuse('That client no longer exists', 404);
      if (await client.count('client_members', { client_id: `eq.${clientId}`, user_id: `eq.${id}` })) return refuse('They are already on this client', 409, 'email');
      const [row] = await client.insert<{ id: number }>('client_members', { client_id: clientId, user_id: id, name, email: reach.email, whatsapp }, 'id');
      const sent = await sendEmail({ to: [reach.email], ...inviteEmail({ kind: 'client', name, brand: brand.brand, url: `${siteUrl()}/track`, by: staff[0].name }) });
      let wa: Sent | null = null, phone = false;
      // they are added by now: the number is a bonus, so a failure here is reported, not thrown
      if (whatsapp) {
        try {
          phone = await client.addPhone(id, whatsapp);
          const [choice] = await client.select<{ opted_in: boolean }>('contact_consents', 'opted_in',
            { channel: 'eq.whatsapp', address: `eq.${whatsapp}`, purpose: 'eq.order_updates', order: 'created_at.desc,id.desc', limit: '1' });
          wa = choice?.opted_in ? await sendWhatsApp(whatsapp, template('portal_invite', [name, staff[0].name, brand.brand]))
            : { status: 'skipped', detail: 'The number has not asked for WhatsApp updates' };
        } catch (err) {
          console.error('[invite whatsapp]', err);
          wa = { status: 'failed', detail: String(err) };
        }
      }
      // phone: whether they can sign in with the number (another account may have it)
      return reply({ ok: true, member_id: row.id, email: sent.status, ...(wa ? { whatsapp: wa.status, phone } : {}) });
    }
    if ((await client.select('staff', 'user_id', { user_id: `eq.${id}` })).length) return refuse('They are already on the team', 409, 'email');
    await client.insert('staff', { user_id: id, name, role: b.role === 'owner' ? 'owner' : 'staff' });
    const sent = await sendEmail({ to: [reach.email], ...inviteEmail({ kind: 'staff', name, url: `${siteUrl()}/admin`, by: staff[0].name }) });
    return reply({ ok: true, user_id: id, email: sent.status });
  } catch (err) {
    return crash('invite', err, 'Could not add them. Try again');
  }
});
