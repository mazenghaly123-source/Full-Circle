// The form functions on a local Supabase: what lands in the database, the emails and the WhatsApp
// messages. Runs when SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_PUBLISHABLE_KEY point at a local
// stack (`supabase start`; the CI backend job sets them). Turnstile, Resend and Meta are stood in for
// by a small server on port 54399, which supabase/functions/.env points the functions at:
//   TURNSTILE_VERIFY_URL=http://host.docker.internal:54399/siteverify
//   RESEND_API_URL=http://host.docker.internal:54399/emails
//   RESEND_API_KEY=test
//   STAFF_EMAILS=staff@fullcircle.test
//   WHATSAPP_API_URL=http://host.docker.internal:54399/whatsapp
//   WHATSAPP_TOKEN=test, WHATSAPP_PHONE_ID=100200300
//   WHATSAPP_APP_SECRET=test-app-secret, WHATSAPP_VERIFY_TOKEN=test-verify-token
//   SEND_SMS_HOOK_SECRET=the same as Auth's (supabase/config.toml), and in this process's environment
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { expect, test } from '@playwright/test';
import { ERRORS, NOTICE } from '../../supabase/functions/_shared/forms';
import { TEMPLATES } from '../../supabase/functions/_shared/whatsapp';

const URL_ = process.env.SUPABASE_URL ?? '', SECRET = process.env.SUPABASE_SECRET_KEY ?? '', PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
test.skip(!URL_ || !SECRET, 'no local Supabase (set SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_PUBLISHABLE_KEY)');
test.describe.configure({ mode: 'serial' });

const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
type Mail = { to: string[]; subject: string; text: string; html: string; reply_to?: string };
const mails: Mail[] = [];
type Wa = { to: string; type: string; template?: { name: string; components: { type: string; parameters: { text: string }[] }[] }; text?: { body: string } };
const sent: Wa[] = [];
let mock: Server;

test.beforeAll(async () => {
  mock = createServer(async (req, res) => {
    let body = '';
    try { for await (const c of req) body += c; } catch { return; } // cut off when the server closes
    res.setHeader('content-type', 'application/json');
    if (req.url === '/siteverify') res.end(JSON.stringify({ success: body.includes(TOKEN) }));
    else if (req.url === '/emails') { mails.push(JSON.parse(body)); res.end(JSON.stringify({ id: `mail-${mails.length}` })); }
    else if (req.url === '/whatsapp/100200300/messages' && req.headers.authorization === 'Bearer test') {
      sent.push(JSON.parse(body)); res.end(JSON.stringify({ messages: [{ id: `wamid.test-${run}-${sent.length}` }] }));
    }
    else { res.statusCode = 404; res.end('{}'); }
  });
  await new Promise<void>((ok) => mock.listen(54399, '0.0.0.0', ok));
});
// close() alone waits for every open connection, and the functions' runtime can leave one open
test.afterAll(() => new Promise<void>((ok) => { mock.close(() => ok()); mock.closeAllConnections(); }));

/** Reads rows as the service role. */
async function rows<T = Record<string, unknown>>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, { headers: { apikey: SECRET } });
  expect(res.ok, await res.clone().text()).toBe(true);
  return res.json();
}

/** Waits for the WhatsApp messages to a number (+20…). */
async function whatsappTo(number: string, n: number) {
  const to = number.slice(1);
  await expect.poll(() => sent.filter((m) => m.to === to).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(n);
  return sent.filter((m) => m.to === to);
}
const params = (m: Wa) => m.template?.components.find((c) => c.type === 'body')?.parameters.map((p) => p.text);
/** A number nobody else in this run has. */
const freshNumber = (() => { let i = 0; return () => `+2010${String(Date.now() + i++).slice(-8)}`; })();

/** Waits for the emails sent after a reply (the functions send them once they have answered). */
async function mailsTo(address: string, n: number) {
  await expect.poll(() => mails.filter((m) => m.to.includes(address)).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(n);
  return mails.filter((m) => m.to.includes(address));
}

const run = Date.now().toString(36);
const fn = (name: string) => `${URL_}/functions/v1/${name}`;
const requestForm = (data: Record<string, unknown>) =>
  JSON.stringify({ path: 'Scaling', product: 'Denim', qty: '60–150', have: 'A sketch', brand: 'Acme', note: '', notice: NOTICE.version, source: {}, turnstile: TOKEN, ...data });
const post = (name: string, body: string) => fetch(fn(name), { method: 'POST', body });

test('a request with a WhatsApp number lands, and staff are emailed', async () => {
  const contact = `010 ${String(Date.now()).slice(-8)}`;
  const res = await post('submit-request', requestForm({ contact, note: 'Raw selvedge', whatsappUpdates: true, source: { utm_source: 'instagram', landing: '/what-we-make' } }));
  expect(res.status).toBe(200);
  const { code } = await res.json();
  expect(code).toMatch(/^FC-\d{4,}$/);

  const [r] = await rows<Record<string, unknown> & { id: number }>('requests', `code=eq.${code}&select=*`);
  expect(r).toMatchObject({ path: 'Scaling', product: 'Denim', qty: '60–150', have: 'A sketch', brand: 'Acme', contact, contact_channel: 'whatsapp', email: null, note: 'Raw selvedge', status: 'new', notice_version: NOTICE.version, source: { utm_source: 'instagram', landing: '/what-we-make' } });
  expect(r.whatsapp).toMatch(/^\+201\d{9}$/);

  const [consent] = await rows('contact_consents', `request_id=eq.${r.id}&select=channel,address,purpose,opted_in,wording,wording_version,source`);
  expect(consent).toEqual({ channel: 'whatsapp', address: r.whatsapp, purpose: 'order_updates', opted_in: true, wording: NOTICE.whatsappUpdates, wording_version: NOTICE.version, source: `request ${code}` });

  const [alert] = (await mailsTo('staff@fullcircle.test', 1)).filter((m) => m.subject.startsWith(code));
  expect(alert.subject).toBe(`${code} / New sample request: Acme (Denim, Scaling)`);
  expect(alert.text).toContain('Order updates on WhatsApp: Yes, opted in');
  // the brand asked for updates on WhatsApp, so its receipt goes there
  const [receipt] = await whatsappTo(r.whatsapp as string, 1);
  expect(receipt.template?.name).toBe(TEMPLATES.request_received.name);
  expect(params(receipt)).toEqual([code]);
  await expect.poll(async () => (await rows('notifications', `request_id=eq.${r.id}&select=audience,channel,status,detail&order=id`)).length).toBe(2);
  expect(await rows('notifications', `request_id=eq.${r.id}&select=audience,channel,status,detail&order=id`)).toEqual([
    { audience: 'staff', channel: 'email', status: 'sent', detail: null },
    { audience: 'client', channel: 'whatsapp', status: 'sent', detail: null },
  ]);
});

test('a number that did not ask for WhatsApp updates gets no message: staff reply by hand', async () => {
  const contact = `010 ${String(Date.now()).slice(-8)}`;
  const { code } = await (await post('submit-request', requestForm({ contact, whatsappUpdates: false }))).json();
  const [r] = await rows<{ id: number; whatsapp: string }>('requests', `code=eq.${code}&select=id,whatsapp`);
  await expect.poll(async () => (await rows('notifications', `request_id=eq.${r.id}&audience=eq.client`)).length).toBe(1);
  expect(await rows('notifications', `request_id=eq.${r.id}&audience=eq.client&select=status,detail`)).toEqual([{ status: 'skipped', detail: 'No WhatsApp updates asked for; staff reply by hand' }]);
  expect(sent.filter((m) => m.to === r.whatsapp.slice(1))).toEqual([]);
});

test('a brand that gave an email gets a receipt, and staff can reply to it', async () => {
  const email = `brand-${run}@acme.test`;
  const res = await post('submit-request', requestForm({ contact: email.toUpperCase(), whatsappUpdates: true }));
  const { code } = await res.json();
  const [receipt] = await mailsTo(email, 1);
  expect(receipt.subject).toBe(`Your sample request ${code} / Full Circle`);
  const alert = (await mailsTo('staff@fullcircle.test', 1)).find((m) => m.subject.startsWith(code))!;
  expect(alert.reply_to).toBe(email);
  // an opt-in sent with an email is not recorded
  const [r] = await rows<{ id: number; email: string }>('requests', `code=eq.${code}&select=id,email`);
  expect(r.email).toBe(email);
  expect(await rows('contact_consents', `request_id=eq.${r.id}`)).toEqual([]);
});

test('requests the server must turn away save nothing', async () => {
  const before = (await rows('requests', 'select=id')).length;
  const refused = async (body: string, status: number, json: object) => {
    const res = await post('submit-request', body);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(json);
  };
  await refused(requestForm({ contact: 'a@b.test', turnstile: 'wrong' }), 403, { error: ERRORS.robot, field: 'robot' });
  await refused(requestForm({ contact: 'a@b.test', product: 'Socks' }), 400, { error: ERRORS.picks, field: 'picks' });
  await refused(requestForm({ contact: 'nobody' }), 400, { error: ERRORS.contact, field: 'contact' });
  await refused(requestForm({ contact: 'a@b.test', notice: 'old' }), 400, { error: ERRORS.failed });
  await refused('not json', 400, { error: ERRORS.failed });
  expect((await rows('requests', 'select=id')).length).toBe(before);
});

test('one contact sending over and over is asked to use WhatsApp, however it is typed', async () => {
  const contact = `again-${run}@acme.test`;
  for (let i = 0; i < 5; i++) expect((await post('submit-request', requestForm({ contact }))).status).toBe(200);
  const res = await post('submit-request', requestForm({ contact: ` ${contact.toUpperCase()}` }));
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({ error: ERRORS.tooMany });
});

test('a contact message lands and staff are emailed', async () => {
  const email = `sara-${run}@brand.test`;
  const res = await post('submit-contact', JSON.stringify({ name: 'Sara', contact: email, text: 'Hello <there>', notice: NOTICE.version, source: { referrer: 'https://google.com/' }, turnstile: TOKEN }));
  expect(res.status).toBe(200);
  const [m] = await rows<{ id: number }>('messages', `email=eq.${email}&select=id,name,contact_channel,text,source`);
  expect(m).toMatchObject({ name: 'Sara', contact_channel: 'email', text: 'Hello <there>', source: { referrer: 'https://google.com/' } });
  const alert = (await mailsTo('staff@fullcircle.test', 1)).find((x) => x.reply_to === email)!;
  expect(alert.subject).toBe('New message from Sara');
  expect(alert.html).toContain('Hello &lt;there&gt;');
  const bad = await post('submit-contact', JSON.stringify({ name: 'Sara', contact: email, text: 'Hi', notice: NOTICE.version, source: {}, turnstile: 'wrong' }));
  expect(bad.status).toBe(403);
});

test('a number counts as one contact however it is written', async () => {
  const local = `011${String(Date.now()).slice(-8)}`, intl = `+20 ${local.slice(1, 3)} ${local.slice(3)}`;
  const message = (contact: string) => post('submit-contact', JSON.stringify({ name: 'Sara', contact, text: 'Hi', notice: NOTICE.version, source: {}, turnstile: TOKEN }));
  for (let i = 0; i < 5; i++) expect((await message(i % 2 ? local : intl)).status).toBe(200);
  expect((await message(`00${intl.slice(1)}`)).status).toBe(429);
});

test('the publishable key reads and writes nothing', async () => {
  test.skip(!PUBLISHABLE, 'no publishable key');
  const headers = { apikey: PUBLISHABLE, 'Content-Type': 'application/json' };
  for (const table of ['requests', 'messages', 'contact_consents', 'notifications', 'staff', 'clients', 'client_members', 'orders', 'order_specs', 'order_decisions', 'order_events', 'stage_photos', 'photo_requests', 'order_notifications']) {
    const res = await fetch(`${URL_}/rest/v1/${table}?select=*`, { headers });
    expect(res.status, table).toBe(401);
  }
  const insert = await fetch(`${URL_}/rest/v1/requests`, { method: 'POST', headers, body: JSON.stringify({ path: 'Starting', product: 'Tees', brand: 'X', contact: 'x@y.test', contact_channel: 'email', email: 'x@y.test', notice_version: 'v' }) });
  expect(insert.status).toBe(401);
});

test('visitors leave no files: the one bucket is the private one for stage photos, which staff fill', async () => {
  const res = await fetch(`${URL_}/storage/v1/bucket`, { headers: { apikey: SECRET } });
  const buckets: { id: string; public: boolean; allowed_mime_types: string[] }[] = await res.json();
  expect(buckets.map((b) => b.id)).toEqual(['stage-photos']);
  expect(buckets[0].public).toBe(false);
  expect(buckets[0].allowed_mime_types.every((t) => t.startsWith('image/'))).toBe(true);
  // and the publishable key cannot put a file in it
  if (!PUBLISHABLE) return;
  const upload = await fetch(`${URL_}/storage/v1/object/stage-photos/1/visitor.jpg`, { method: 'POST', headers: { apikey: PUBLISHABLE, 'Content-Type': 'image/jpeg' }, body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) });
  expect(upload.ok).toBe(false);
});

// The admin's functions (phase 4) ------------------------------------------------------------------

/** A signed-in person: an account with a password (tests only; real people sign in by code). */
async function person(email: string) {
  // a secret key (sb_secret_…) goes in apikey alone; a JWT also as the bearer token
  const admin: Record<string, string> = { apikey: SECRET, 'Content-Type': 'application/json', ...(SECRET.startsWith('sb_') ? {} : { Authorization: `Bearer ${SECRET}` }) };
  const made = await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: 'test-password-1', email_confirm: true }) });
  expect(made.ok, await made.clone().text()).toBe(true);
  const { id } = await made.json();
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'test-password-1' }) });
  expect(res.ok, await res.clone().text()).toBe(true);
  const { access_token } = await res.json();
  return { id: id as string, headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' } };
}

/** Writes rows as the service role. */
async function insert<T = Record<string, unknown>>(table: string, row: object): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/${table}`, { method: 'POST', headers: { apikey: SECRET, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(row) });
  expect(res.ok, await res.clone().text()).toBe(true);
  return (await res.json())[0];
}

test('staff add a client\'s person, who is emailed a link to the portal; others cannot', async () => {
  test.skip(!PUBLISHABLE, 'no publishable key');
  const owner = await person(`owner-${run}@fullcircle.test`), stranger = await person(`stranger-${run}@x.test`);
  await insert('staff', { user_id: owner.id, name: 'Mazen', role: 'owner' });
  const brand = await insert<{ id: number }>('clients', { brand: `Atelier ${run}` });
  const email = `laila-${run}@brand.test`;
  const body = JSON.stringify({ kind: 'client', client_id: brand.id, name: 'Laila', email: email.toUpperCase(), whatsapp: '0101 143 5406' });

  expect((await fetch(fn('invite'), { method: 'POST', body })).status).toBe(401);
  expect((await fetch(fn('invite'), { method: 'POST', headers: stranger.headers, body })).status).toBe(403);
  const res = await fetch(fn('invite'), { method: 'POST', headers: owner.headers, body });
  expect(res.status, await res.clone().text()).toBe(200);
  const [member] = await rows('client_members', `client_id=eq.${brand.id}&select=name,email,whatsapp`);
  expect(member).toEqual({ name: 'Laila', email, whatsapp: '+201011435406' });
  const [mail] = await mailsTo(email, 1);
  expect(mail.subject).toBe('Follow your orders with Full Circle');
  expect(mail.text).toContain('/track');
  expect((await fetch(fn('invite'), { method: 'POST', headers: owner.headers, body })).status).toBe(409);
});

test('only an owner adds staff', async () => {
  test.skip(!PUBLISHABLE, 'no publishable key');
  const owner = await person(`owner2-${run}@fullcircle.test`), member = await person(`staff2-${run}@fullcircle.test`);
  await insert('staff', { user_id: owner.id, name: 'Mazen', role: 'owner' });
  await insert('staff', { user_id: member.id, name: 'Salma', role: 'staff' });
  const body = (email: string) => JSON.stringify({ kind: 'staff', name: 'Nadia', email, role: 'staff' });
  expect((await fetch(fn('invite'), { method: 'POST', headers: member.headers, body: body(`nadia-${run}@fullcircle.test`) })).status).toBe(403);
  const res = await fetch(fn('invite'), { method: 'POST', headers: owner.headers, body: body(`nadia-${run}@fullcircle.test`) });
  expect(res.status, await res.clone().text()).toBe(200);
  const { user_id } = await res.json();
  expect(await rows('staff', `user_id=eq.${user_id}&select=name,role`)).toEqual([{ name: 'Nadia', role: 'staff' }]);
  const [mail] = await mailsTo(`nadia-${run}@fullcircle.test`, 1);
  expect(mail.text).toContain('/admin');
});

test('queued order messages go out once, photos for one person in one email', async () => {
  test.skip(!PUBLISHABLE, 'no publishable key');
  const someone = await person(`notify-${run}@brand.test`);
  const brand = await insert<{ id: number }>('clients', { brand: `Studio ${run}` });
  const order = await insert<{ id: number }>('orders', { code: `FC-T${run}`, client_id: brand.id, name: 'Overshirt', product: 'Shirts', stage: 6 });
  const to = `client-${run}@brand.test`;
  for (const event of ['stage_moved', 'photo_added', 'photo_added']) await insert('order_notifications', { order_id: order.id, event, audience: 'client', channel: 'email', recipient: to });

  expect((await fetch(fn('notify'), { method: 'POST' })).status).toBe(401);
  const res = await fetch(fn('notify'), { method: 'POST', headers: someone.headers });
  expect(res.status, await res.clone().text()).toBe(200);
  const sent = await mailsTo(to, 2);
  expect(sent.map((m) => m.subject).sort()).toEqual([`FC-T${run} / 2 new photos of Overshirt`, `FC-T${run} / Overshirt is at 06 Production`]);
  expect(await rows('order_notifications', `order_id=eq.${order.id}&select=status&order=id`)).toEqual([{ status: 'sent' }, { status: 'sent' }, { status: 'sent' }]);
  // nothing is sent twice
  await fetch(fn('notify'), { method: 'POST', headers: someone.headers });
  expect(mails.filter((m) => m.to.includes(to))).toHaveLength(2);
});

// WhatsApp from the system number (phase 4) ---------------------------------------------------------

const HOOK_SECRET = process.env.SEND_SMS_HOOK_SECRET ?? '';

test('a person added with a number that opted in hears on WhatsApp, and signs in with a code there', async () => {
  test.skip(!PUBLISHABLE, 'no publishable key');
  const owner = await person(`owner3-${run}@fullcircle.test`);
  await insert('staff', { user_id: owner.id, name: 'Mazen', role: 'owner' });
  const brand = await insert<{ id: number }>('clients', { brand: `Denim ${run}` });
  const number = freshNumber();
  await insert('contact_consents', { channel: 'whatsapp', address: number, purpose: 'order_updates', opted_in: true, wording: NOTICE.whatsappUpdates, wording_version: NOTICE.version, source: 'request FC-1' });
  const res = await fetch(fn('invite'), { method: 'POST', headers: owner.headers, body: JSON.stringify({ kind: 'client', client_id: brand.id, name: 'Omar', email: `omar-${run}@brand.test`, whatsapp: number }) });
  expect(res.status, await res.clone().text()).toBe(200);
  expect(await res.json()).toMatchObject({ email: 'sent', whatsapp: 'sent', phone: true });
  const [invite] = await whatsappTo(number, 1);
  expect(invite.template?.name).toBe(TEMPLATES.portal_invite.name);
  expect(params(invite)).toEqual(['Omar', 'Mazen', `Denim ${run}`]);

  // the portal's sign-in with the number: Auth hands the code to send-sms, which sends it on WhatsApp
  const auth = (path: string, body: object) => fetch(`${URL_}/auth/v1/${path}`, { method: 'POST', headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const asked = await auth('otp', { phone: number, create_user: false, channel: 'whatsapp' });
  expect(asked.status, await asked.clone().text()).toBe(200);
  const [, code] = await whatsappTo(number, 2);
  expect(code.template?.name).toBe(TEMPLATES.code.name);
  const otp = params(code)![0];
  expect(otp).toMatch(/^\d{6}$/);
  expect(code.template?.components.find((c) => c.type === 'button')?.parameters[0].text).toBe(otp);
  const verified = await auth('verify', { phone: number, token: otp, type: 'sms' });
  expect(verified.status, await verified.clone().text()).toBe(200);
  expect((await verified.json()).access_token).toBeTruthy();
});

test('Auth\'s hook takes only calls Auth signed', async () => {
  test.skip(!HOOK_SECRET, 'no SEND_SMS_HOOK_SECRET');
  const body = JSON.stringify({ user: { phone: '201011435406' }, sms: { otp: '123456' } });
  const sign = (id: string, ts: string, secret: string) => `v1,${createHmac('sha256', Buffer.from(secret.replace(/^v1,whsec_/, ''), 'base64')).update(`${id}.${ts}.${body}`).digest('base64')}`;
  const call = (headers: Record<string, string>) => fetch(fn('send-sms'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  const ts = String(Math.floor(Date.now() / 1000));
  expect((await call({})).status).toBe(401);
  expect((await call({ 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': sign('msg_1', ts, 'v1,whsec_' + Buffer.from('another secret').toString('base64')) })).status).toBe(401);
  const old = String(Number(ts) - 600);
  expect((await call({ 'webhook-id': 'msg_1', 'webhook-timestamp': old, 'webhook-signature': sign('msg_1', old, HOOK_SECRET) })).status).toBe(401);
  const ok = await call({ 'webhook-id': 'msg_2', 'webhook-timestamp': ts, 'webhook-signature': sign('msg_2', ts, HOOK_SECRET) });
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual({});
});

test('queued order messages go on WhatsApp too, as the event\'s template', async () => {
  test.skip(!PUBLISHABLE, 'no publishable key');
  const someone = await person(`notify2-${run}@brand.test`);
  const brand = await insert<{ id: number }>('clients', { brand: `Knit ${run}` });
  const order = await insert<{ id: number }>('orders', { code: `FC-W${run}`, client_id: brand.id, name: 'Hoodie', product: 'Hoodies', stage: 6 });
  const number = freshNumber();
  for (const event of ['stage_moved', 'photo_added', 'photo_added', 'decision_approved']) await insert('order_notifications', { order_id: order.id, event, audience: event === 'decision_approved' ? 'staff' : 'client', channel: 'whatsapp', recipient: number });
  expect((await fetch(fn('notify'), { method: 'POST', headers: someone.headers })).status).toBe(200);
  const got = await whatsappTo(number, 2);
  expect(got.map((m) => [m.template?.name, params(m)]).sort()).toEqual([
    [TEMPLATES.photo_added.name, ['There are 2 new photos', 'Hoodie', `FC-W${run}`]],
    [TEMPLATES.stage_moved.name, ['Hoodie', `FC-W${run}`, '06 Production']],
  ]);
  const logged = await rows<{ event: string; status: string; provider_id: string | null; detail: string | null }>('order_notifications', `order_id=eq.${order.id}&select=event,status,provider_id,detail&order=id`);
  expect(logged.map((l) => l.status)).toEqual(['sent', 'sent', 'sent', 'skipped']);
  expect(logged[0].provider_id).toMatch(/^wamid\./);
  expect(logged[3].detail).toBe('Staff hear of this by email');
});

/** A call from Meta to the webhook, signed with the app secret. */
const fromMeta = (payload: object, secret = 'test-app-secret') => {
  const body = JSON.stringify(payload);
  return fetch(fn('whatsapp-webhook'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}` }, body });
};
const change = (value: object) => ({ object: 'whatsapp_business_account', entry: [{ id: '1', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '100200300' }, ...value } }] }] });
const reply = (from: string, id: string, body: string, name = 'Omar K') =>
  change({ contacts: [{ wa_id: from.slice(1), profile: { name } }], messages: [{ from: from.slice(1), id, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body } }] });

test('Meta checks the webhook with its token, and only signed calls are read', async () => {
  const check = (token: string) => fetch(`${fn('whatsapp-webhook')}?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=4242`);
  const ok = await check('test-verify-token');
  expect(ok.status).toBe(200);
  expect(await ok.text()).toBe('4242');
  expect((await check('wrong')).status).toBe(403);
  expect((await fromMeta(reply(freshNumber(), `wamid.x-${run}`, 'Hi'), 'another secret')).status).toBe(401);
});

test('a reply to the number lands in the inbox once, is answered once a day, and staff are told', async () => {
  const number = freshNumber();
  const first = reply(number, `wamid.in-${run}-1`, 'Is my sample ready?');
  expect((await fromMeta(first)).status).toBe(200);
  expect((await fromMeta(first)).status).toBe(200); // Meta sends it again: it lands once
  const saved = await rows<{ id: number; name: string; whatsapp: string; text: string; via: string; status: string }>('messages', `whatsapp=eq.${encodeURIComponent(number)}&select=id,name,whatsapp,text,via,status`);
  expect(saved).toEqual([{ id: saved[0].id, name: 'Omar K', whatsapp: number, text: 'Is my sample ready?', via: 'whatsapp', status: 'new' }]);
  const [answer] = await whatsappTo(number, 1);
  expect(answer.type).toBe('text');
  expect(answer.text?.body).toContain('+20 101 143 5406');
  const alert = (await mailsTo('staff@fullcircle.test', 1)).filter((m) => m.subject === 'WhatsApp reply from Omar K');
  expect(alert).toHaveLength(1);
  expect(alert[0].text).toContain('Is my sample ready?');

  // a second reply the same day: saved, not answered again, and staff are not emailed again within the hour
  expect((await fromMeta(reply(number, `wamid.in-${run}-2`, 'Also the hoodie'))).status).toBe(200);
  await expect.poll(async () => (await rows('messages', `whatsapp=eq.${encodeURIComponent(number)}&select=id`)).length).toBe(2);
  await new Promise((r) => setTimeout(r, 1500));
  expect(sent.filter((m) => m.to === number.slice(1))).toHaveLength(1);
  expect(mails.filter((m) => m.subject === 'WhatsApp reply from Omar K')).toHaveLength(1);
});

test('STOP turns the updates off and says so', async () => {
  const number = freshNumber();
  await insert('contact_consents', { channel: 'whatsapp', address: number, purpose: 'order_updates', opted_in: true, wording: NOTICE.whatsappUpdates, wording_version: NOTICE.version, source: 'request FC-1' });
  expect((await fromMeta(reply(number, `wamid.stop-${run}`, 'STOP'))).status).toBe(200);
  const [latest] = await rows<{ opted_in: boolean; source: string }>('contact_consents', `address=eq.${encodeURIComponent(number)}&select=opted_in,source&order=id.desc&limit=1`);
  expect(latest).toEqual({ opted_in: false, source: 'whatsapp reply' });
  const [said] = await whatsappTo(number, 1);
  expect(said.text?.body).toMatch(/not send you order updates on WhatsApp/);
});

test('what Meta says happened to a message is kept with it', async () => {
  const brand = await insert<{ id: number }>('clients', { brand: `Status ${run}` });
  const order = await insert<{ id: number }>('orders', { code: `FC-S${run}`, client_id: brand.id, name: 'Tee', product: 'Tees', stage: 2 });
  const row = (id: string) => insert<{ id: number }>('order_notifications', { order_id: order.id, event: 'stage_moved', audience: 'client', channel: 'whatsapp', recipient: '+201011435406', status: 'sent', provider_id: id });
  const [read, lost] = [await row(`wamid.read-${run}`), await row(`wamid.lost-${run}`)];
  const at = Math.floor(Date.now() / 1000);
  const statuses = change({ statuses: [
    { id: `wamid.read-${run}`, status: 'delivered', timestamp: String(at - 5), recipient_id: '201011435406' },
    { id: `wamid.read-${run}`, status: 'read', timestamp: String(at), recipient_id: '201011435406' },
    { id: `wamid.lost-${run}`, status: 'failed', timestamp: String(at), recipient_id: '201011435406', errors: [{ code: 131026, title: 'Message undeliverable' }] },
  ] });
  expect((await fromMeta(statuses)).status).toBe(200);
  const [r] = await rows<{ status: string; delivered_at: string; read_at: string }>('order_notifications', `id=eq.${read.id}&select=status,delivered_at,read_at`);
  expect(r.status).toBe('sent');
  expect(Date.parse(r.delivered_at)).toBe((at - 5) * 1000);
  expect(Date.parse(r.read_at)).toBe(at * 1000);
  expect(await rows('order_notifications', `id=eq.${lost.id}&select=status,detail`)).toEqual([{ status: 'failed', detail: '131026 Message undeliverable' }]);
});
