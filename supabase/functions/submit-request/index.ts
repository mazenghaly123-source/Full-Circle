// Receives the sample request form: checks it, saves the request and its files, records the
// WhatsApp opt-in, and emails staff (and the brand, when it gave an email). Answers with the code.
//
// POST multipart/form-data: "data" (JSON, RequestData in _shared/forms.ts) and up to 5 "files".
import { ERRORS, FILE_TYPES, LIMITS, NOTICE, belowMinimum, checkRequest, sniffType } from '../_shared/forms.ts';
import { clientReceiptEmail, staffRequestEmail } from '../_shared/emails.ts';
import { WHATSAPP_LATER, crash, db, human, later, logNotification, preflight, refuse, reply, sendEmail, staffEmails } from '../_shared/server.ts';

const BUCKET = 'request-files';
/** How long the file links in the staff email work. */
const LINK_SECONDS = 7 * 24 * 3600;
/** Requests from one contact in an hour before it is asked to use WhatsApp instead. */
const PER_HOUR = 5;

/** A file name that is safe in a storage path (the original name is kept in the database). */
const safeName = (name: string) => name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(-80) || 'file';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return refuse('Send the form with POST', 405);

  let form: FormData, raw: unknown;
  try { form = await req.formData(); raw = JSON.parse(String(form.get('data'))); } catch { return refuse(ERRORS.failed); }
  const checked = checkRequest(raw as never);
  if (!checked.ok) return refuse(checked.error, 400, checked.field);
  const r = checked.value;
  if (r.notice !== NOTICE.version) return refuse(ERRORS.failed);

  // files: how many, how big, and what their first bytes say they are
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  const total = files.reduce((n, f) => n + f.size, 0);
  if (files.length > LIMITS.files || total > LIMITS.totalBytes || files.some((f) => f.size > LIMITS.fileBytes)) return refuse(ERRORS.files, 400, 'files');
  const typed: { file: File; type: (typeof FILE_TYPES)[number] }[] = [];
  for (const file of files) {
    const type = sniffType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
    if (!type) return refuse(ERRORS.files, 400, 'files');
    typed.push({ file, type });
  }

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
    if (await client.count('requests', { contact: `eq.${r.contact}`, created_at: `gte.${since}` }) >= PER_HOUR) return refuse(ERRORS.tooMany, 429);
    [saved] = await client.insert<Saved>('requests', {
      path: r.path, product: r.product, qty: r.qty, have: r.have, brand: r.brand, contact: r.contact,
      contact_channel: r.reach.channel, email, whatsapp, note: r.note || null, source: r.source, notice_version: r.notice,
    }, 'id,code,created_at');
  } catch (err) { return crash('insert request', err, ERRORS.failed); }

  // the files go in under the request's code; if one fails, the whole request is taken back so the
  // brand can send it again rather than staff getting it without its files
  const stored: { object_path: string; name: string; size: number; type: string }[] = [];
  try {
    for (const [i, { file, type }] of typed.entries()) {
      const object_path = `${saved.code}/${i + 1}-${safeName(file.name)}`;
      await client.upload(BUCKET, object_path, file, type);
      stored.push({ object_path, name: file.name.slice(0, 200), size: file.size, type });
    }
    if (stored.length) await client.insert('request_files', stored.map((f) => ({ ...f, request_id: saved.id })));
    if (r.whatsappUpdates !== undefined) {
      await client.insert('contact_consents', {
        channel: 'whatsapp', address: whatsapp ?? r.contact, purpose: 'order_updates', opted_in: r.whatsappUpdates,
        wording: NOTICE.whatsappUpdates, wording_version: NOTICE.version, source: `request ${saved.code}`, request_id: saved.id,
      });
    }
  } catch (err) {
    await Promise.allSettled([stored.length && client.removeFiles(BUCKET, stored.map((f) => f.object_path)), client.delete('requests', { id: `eq.${saved.id}` })]);
    return crash('store request files', err, ERRORS.failed);
  }

  later(notify(client, saved, r, stored));
  return reply({ code: saved.code });
});

type Saved = { id: number; code: string; created_at: string };
type Checked = Extract<ReturnType<typeof checkRequest>, { ok: true }>['value'];

/** Emails staff (with links to the files) and the brand, and logs each message. */
async function notify(client: ReturnType<typeof db>, saved: Saved, r: Checked, stored: { object_path: string; name: string }[]) {
  const links = stored.length ? await client.signedUrls(BUCKET, stored.map((f) => f.object_path), LINK_SECONDS).catch(() => []) : [];
  const staff = staffEmails();
  const alert = staffRequestEmail({
    code: saved.code, at: new Date(saved.created_at), brand: r.brand,
    picks: { path: r.path, product: r.product, qty: r.qty, have: r.have }, belowMinimum: belowMinimum(r.qty, r.product),
    typed: r.contact, reach: r.reach, whatsappUpdates: r.whatsappUpdates, note: r.note, source: r.source,
    files: stored.map((f, i) => ({ name: f.name, url: links[i] ?? '' })),
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
