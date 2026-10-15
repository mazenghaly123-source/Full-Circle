// Receives the sample request form: checks it, saves the request, records the WhatsApp opt-in, and
// emails staff (and the brand, when it gave an email). Answers with the code.
//
// POST application/json: RequestData in _shared/forms.ts.
import { ERRORS, NOTICE, belowMinimum, checkRequest } from '../_shared/forms.ts';
import { clientReceiptEmail, staffRequestEmail } from '../_shared/emails.ts';
import { WHATSAPP_LATER, crash, db, human, later, logNotification, preflight, refuse, reply, sameContact, sendEmail, staffEmails } from '../_shared/server.ts';

/** Requests from one contact in an hour before it is asked to use WhatsApp instead. */
const PER_HOUR = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return refuse('Send the form with POST', 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return refuse(ERRORS.failed); }
  const checked = checkRequest(raw as never);
  if (!checked.ok) return refuse(checked.error, 400, checked.field);
  const r = checked.value;
  if (r.notice !== NOTICE.version) return refuse(ERRORS.failed);

  try {
    if (!(await human(r.turnstile, req))) return refuse(ERRORS.robot, 403, 'robot');
  } catch (err) { return crash('turnstile', err, ERRORS.failed); }

  const client = db();
  const email = r.reach.channel === 'email' ? r.reach.email : null;
  const whatsapp = r.reach.channel === 'whatsapp' ? r.reach.whatsapp : null;

  // one contact sending over and over is almost certainly a mistake or a robot
  const since = new Date(Date.now() - 3600_000).toISOString();
  let saved: Saved;
  try {
    if (await client.count('requests', { ...sameContact(r.reach, r.contact), created_at: `gte.${since}` }) >= PER_HOUR) return refuse(ERRORS.tooMany, 429);
    [saved] = await client.insert<Saved>('requests', {
      path: r.path, product: r.product, qty: r.qty, have: r.have, brand: r.brand, contact: r.contact,
      contact_channel: r.reach.channel, email, whatsapp, note: r.note || null, source: r.source, notice_version: r.notice,
    }, 'id,code,created_at');
  } catch (err) { return crash('insert request', err, ERRORS.failed); }

  // the opt-in goes with the request; if it cannot be recorded, the request is taken back so the
  // brand can send it again rather than staff getting it without its answer
  if (r.whatsappUpdates !== undefined) {
    try {
      await client.insert('contact_consents', {
        channel: 'whatsapp', address: whatsapp ?? r.contact, purpose: 'order_updates', opted_in: r.whatsappUpdates,
        wording: NOTICE.whatsappUpdates, wording_version: NOTICE.version, source: `request ${saved.code}`, request_id: saved.id,
      });
    } catch (err) {
      await client.delete('requests', { id: `eq.${saved.id}` }).catch(() => {});
      return crash('record consent', err, ERRORS.failed);
    }
  }

  later(notify(client, saved, r));
  return reply({ code: saved.code });
});

type Saved = { id: number; code: string; created_at: string };
type Checked = Extract<ReturnType<typeof checkRequest>, { ok: true }>['value'];

/** Emails staff and the brand, and logs each message. */
async function notify(client: ReturnType<typeof db>, saved: Saved, r: Checked) {
  const staff = staffEmails();
  const alert = staffRequestEmail({
    code: saved.code, at: new Date(saved.created_at), brand: r.brand,
    picks: { path: r.path, product: r.product, qty: r.qty, have: r.have }, belowMinimum: belowMinimum(r.qty, r.product),
    typed: r.contact, reach: r.reach, whatsappUpdates: r.whatsappUpdates, note: r.note, source: r.source,
  });
  const toStaff = await sendEmail({ to: staff, ...alert, replyTo: r.reach.channel === 'email' ? r.reach.email : undefined });
  await logNotification(client, { event: 'request_received', audience: 'staff', channel: 'email', recipients: staff, sent: toStaff, request_id: saved.id });

  if (r.reach.channel === 'email') {
    const receipt = clientReceiptEmail({ code: saved.code, brand: r.brand });
    const toBrand = await sendEmail({ to: [r.reach.email], ...receipt });
    await logNotification(client, { event: 'request_received', audience: 'client', channel: 'email', recipients: [r.reach.email], sent: toBrand, request_id: saved.id });
  } else {
    await logNotification(client, { event: 'request_received', audience: 'client', channel: 'whatsapp', recipients: [r.reach.whatsapp ?? r.contact], sent: WHATSAPP_LATER, request_id: saved.id });
  }
}
