// Receives the contact form: checks it, saves the message and emails staff.
//
// POST application/json: MessageData in _shared/forms.ts.
import { ERRORS, NOTICE, checkMessage } from '../_shared/forms.ts';
import { staffMessageEmail } from '../_shared/emails.ts';
import { crash, db, human, later, logNotification, preflight, refuse, reply, sendEmail, staffEmails } from '../_shared/server.ts';

/** Messages from one contact in an hour before it is asked to use WhatsApp instead. */
const PER_HOUR = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return refuse('Send the form with POST', 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return refuse(ERRORS.failed); }
  const checked = checkMessage(raw as never);
  if (!checked.ok) return refuse(checked.error);
  const m = checked.value;
  if (m.notice !== NOTICE.version) return refuse(ERRORS.failed);

  try {
    if (!(await human(m.turnstile, req))) return refuse(ERRORS.robot, 403, 'robot');
  } catch (err) { return crash('turnstile', err, ERRORS.failed); }

  const client = db();
  const since = new Date(Date.now() - 3600_000).toISOString();
  let saved: { id: number; created_at: string };
  try {
    if (await client.count('messages', { contact: `eq.${m.contact}`, created_at: `gte.${since}` }) >= PER_HOUR) return refuse(ERRORS.tooMany, 429);
    [saved] = await client.insert<typeof saved>('messages', {
      name: m.name, contact: m.contact, contact_channel: m.reach.channel,
      email: m.reach.channel === 'email' ? m.reach.email : null, whatsapp: m.reach.channel === 'whatsapp' ? m.reach.whatsapp : null,
      text: m.text, source: m.source, notice_version: m.notice,
    }, 'id,created_at');
  } catch (err) { return crash('insert message', err, ERRORS.failed); }

  later((async () => {
    const staff = staffEmails();
    const alert = staffMessageEmail({ at: new Date(saved.created_at), name: m.name, typed: m.contact, reach: m.reach, text: m.text, source: m.source });
    const sent = await sendEmail({ to: staff, ...alert, replyTo: m.reach.channel === 'email' ? m.reach.email : undefined });
    await logNotification(client, { event: 'contact_message', audience: 'staff', channel: 'email', recipients: staff, sent, message_id: saved.id });
  })());
  return reply({ ok: true });
});
