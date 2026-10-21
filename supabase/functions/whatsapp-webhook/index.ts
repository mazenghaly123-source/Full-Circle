// What Meta posts about the system number (docs/whatsapp.md). A reply someone sends lands in the
// admin's inbox with the contact messages, and staff are emailed (once an hour per number at most).
// The first reply in a day is answered with where to talk to the team; "STOP" turns the updates off
// and says so. What happened to each message the number sent (delivered, read, failed) is kept with
// it. Meta signs every call with the app secret; anything else is turned away. A call that fails is
// sent again by Meta, and Meta's id for each message keeps it from landing twice.
//
// GET: Meta checks the address once, with WHATSAPP_VERIFY_TOKEN. POST: the events.
import { staffMessageEmail } from '../_shared/emails.ts';
import { db, logNotification, sendEmail, staffEmails } from '../_shared/server.ts';
import { asksToStop, fromMeta, readWebhook, sendWhatsApp, textMessage, type Inbound, type Status } from '../_shared/whatsapp.ts';

const env = (k: string) => Deno.env.get(k)?.trim() || undefined;
const MAIN_LINE = '+20 101 143 5406';
const ANSWER = `Thank you, we have your message. This number sends order updates; the team will answer you from our main WhatsApp line, ${MAIN_LINE}.`;
const STOPPED = 'Done: Full Circle will not send you order updates on WhatsApp any more. You still get them by email, and you can turn them back on in the portal.';
const HOUR = 3600_000;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const token = env('WHATSAPP_VERIFY_TOKEN');
    const ok = token && url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === token;
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '') : new Response('Forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('Send it with POST', { status: 405 });

  const body = await req.text();
  if (!(await fromMeta(body, req.headers.get('x-hub-signature-256'), env('WHATSAPP_APP_SECRET') ?? ''))) return new Response('Not signed by Meta', { status: 401 });
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return new Response('Unreadable', { status: 400 }); }

  const { inbound, statuses } = readWebhook(payload);
  const client = db();
  try {
    for (const s of statuses) await record(client, s);
    for (const m of inbound) await receive(client, m);
  } catch (err) {
    console.error('[whatsapp-webhook]', err);
    return new Response('Try again', { status: 500 });
  }
  return new Response('OK');
});

type Client = ReturnType<typeof db>;

/** Keeps what Meta says happened to a message, in whichever log has it. */
async function record(client: Client, s: Status) {
  const at = s.at.toISOString();
  for (const table of ['order_notifications', 'notifications']) {
    const mine = { provider_id: `eq.${s.wamid}`, channel: 'eq.whatsapp' };
    if (s.status === 'failed') await client.update(table, mine, { status: 'failed', detail: s.error ?? 'WhatsApp could not deliver it' });
    // a message read was delivered first, even when Meta's word for that never came
    if (s.status === 'delivered' || s.status === 'read') await client.update(table, { ...mine, delivered_at: 'is.null' }, { delivered_at: at });
    if (s.status === 'read') await client.update(table, { ...mine, read_at: 'is.null' }, { read_at: at });
  }
}

/** Saves a reply for staff, then answers it and tells staff, unless it was saved before. */
async function receive(client: Client, m: Inbound) {
  if (!/^\+[1-9]\d{6,14}$/.test(m.from)) return;
  // a client's person is named as staff know them
  const [member] = await client.select<{ name: string; clients: { brand: string } | null }>('client_members', 'name,clients(brand)',
    { whatsapp: `eq.${m.from}`, order: 'id.desc', limit: '1' });
  const name = (member ? `${member.name}${member.clients ? ` (${member.clients.brand})` : ''}` : m.name ?? m.from).slice(0, 200);
  const [saved] = await client.insert<{ id: number }>('messages', {
    name, contact: m.from, contact_channel: 'whatsapp', whatsapp: m.from, text: m.text.slice(0, 4000) || '[An empty message]',
    notice_version: 'whatsapp', via: 'whatsapp', wamid: m.wamid, created_at: m.at.toISOString(),
  }, 'id', 'wamid');
  if (!saved) return;

  const before = await client.select<{ created_at: string }>('messages', 'created_at',
    { via: 'eq.whatsapp', whatsapp: `eq.${m.from}`, id: `neq.${saved.id}`, created_at: `gte.${new Date(m.at.getTime() - 24 * HOUR).toISOString()}` });
  if (asksToStop(m.text)) {
    await client.insert('contact_consents', {
      channel: 'whatsapp', address: m.from, purpose: 'order_updates', opted_in: false,
      wording: `Replied "${m.text.trim().slice(0, 200)}" on WhatsApp`, wording_version: 'whatsapp-reply', source: 'whatsapp reply',
    });
    await sendWhatsApp(m.from, textMessage(STOPPED));
  } else if (!before.length) {
    await sendWhatsApp(m.from, textMessage(ANSWER));
  }
  if (before.some((b) => Date.parse(b.created_at) > m.at.getTime() - HOUR)) return;
  const staff = staffEmails();
  const sent = await sendEmail({ to: staff, ...staffMessageEmail({ at: m.at, name, typed: m.from, reach: { channel: 'whatsapp', whatsapp: m.from }, text: m.text, source: {}, via: 'whatsapp' }) });
  await logNotification(client, { event: 'contact_message', audience: 'staff', channel: 'email', recipients: staff, sent, message_id: saved.id });
}
