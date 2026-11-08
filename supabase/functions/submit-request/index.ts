// Receives the sample request form: checks it, saves the request, records the WhatsApp opt-in, and
// emails staff. The brand gets a receipt with its code: by email when it gave one, on WhatsApp when it
// gave a number and asked for updates there. An email also gets a sign-in account, so the brand can
// follow the request on the tracking page (public.my_requests). Answers with the code, whether the
// request can be followed on Track, and the key that lets the sender answer the questions after sending.
//
// POST application/json: RequestData in _shared/forms.ts; or { followUp: FollowUpData }, the answers
// on the screen after sending (how they heard of us, where they sell), with the code and that key.
import { ERRORS, FOLLOW_UP, NOTICE, belowMinimum, checkFollowUp, checkRequest } from '../_shared/forms.ts';
import { clientReceiptEmail, staffRequestEmail } from '../_shared/emails.ts';
import { crash, db, human, later, logNotification, preflight, refuse, reply, sameContact, sendEmail, siteUrl, staffEmails } from '../_shared/server.ts';
import { sendWhatsApp, template } from '../_shared/whatsapp.ts';

/** Requests from one contact in an hour before it is asked to use WhatsApp instead. */
const PER_HOUR = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return refuse('Send the form with POST', 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return refuse(ERRORS.failed); }
  if (raw && typeof raw === 'object' && 'followUp' in raw) return followUp((raw as { followUp: unknown }).followUp);
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
      path: r.path, product: r.product, qty: r.qty, have: r.have, also: r.also, brand: r.brand, contact: r.contact,
      contact_channel: r.reach.channel, email, whatsapp, note: r.note || null, source: r.source, notice_version: r.notice,
    }, 'id,code,created_at,follow_up');
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

  // made before the answer, so a brand that goes straight to Track finds it there; a failure costs
  // the request nothing, it just cannot be followed online
  let track = false;
  if (email) {
    try {
      if (!(await client.rpc<string | null>('user_id_by_email', { p_email: email }))) await client.createUser(email);
      track = true;
    } catch (err) {
      console.error('[account]', err);
    }
  }

  later(notify(client, saved, r, track));
  return reply({ code: saved.code, track, followUp: saved.follow_up });
});

type Saved = { id: number; code: string; created_at: string; follow_up: string };

/** Saves the answers after sending on the request whose code and key they came with. */
async function followUp(raw: unknown) {
  const checked = checkFollowUp((raw ?? {}) as never);
  if (!checked.ok) return refuse(checked.error);
  const f = checked.value;
  try {
    const client = db();
    const [row] = await client.select<{ id: number }>('requests', 'id', { code: `eq.${f.code}`, follow_up: `eq.${f.key}` });
    if (!row) return refuse(ERRORS.failed, 404);
    await client.update('requests', { id: `eq.${row.id}` }, Object.fromEntries(FOLLOW_UP.filter((q) => f[q.k]).map((q) => [q.k, f[q.k]])));
  } catch (err) { return crash('follow up', err, ERRORS.failed); }
  return reply({ ok: true });
}
type Checked = Extract<ReturnType<typeof checkRequest>, { ok: true }>['value'];

/** Tells staff and the brand, and logs each message. */
async function notify(client: ReturnType<typeof db>, saved: Saved, r: Checked, track: boolean) {
  const staff = staffEmails();
  const alert = staffRequestEmail({
    code: saved.code, at: new Date(saved.created_at), brand: r.brand,
    picks: { path: r.path, product: r.product, qty: r.qty, have: r.have }, also: r.also ?? [], belowMinimum: belowMinimum(r.qty, r.product),
    typed: r.contact, reach: r.reach, whatsappUpdates: r.whatsappUpdates, note: r.note, source: r.source,
  });
  const toStaff = await sendEmail({ to: staff, ...alert, replyTo: r.reach.channel === 'email' ? r.reach.email : undefined });
  await logNotification(client, { event: 'request_received', audience: 'staff', channel: 'email', recipients: staff, sent: toStaff, request_id: saved.id });

  if (r.reach.channel === 'email') {
    const receipt = clientReceiptEmail({ code: saved.code, brand: r.brand, track: track ? `${siteUrl()}/track` : undefined });
    const toBrand = await sendEmail({ to: [r.reach.email], ...receipt });
    await logNotification(client, { event: 'request_received', audience: 'client', channel: 'email', recipients: [r.reach.email], sent: toBrand, request_id: saved.id });
  } else {
    // a business may only write first on WhatsApp to someone who agreed to it (docs/whatsapp.md)
    const sent = !r.reach.whatsapp ? { status: 'skipped' as const, detail: 'The number has no country code; staff reply by hand' }
      : r.whatsappUpdates !== true ? { status: 'skipped' as const, detail: 'No WhatsApp updates asked for; staff reply by hand' }
      : await sendWhatsApp(r.reach.whatsapp, template('request_received', [saved.code]));
    await logNotification(client, { event: 'request_received', audience: 'client', channel: 'whatsapp', recipients: [r.reach.whatsapp ?? r.contact], sent, request_id: saved.id });
  }
}
