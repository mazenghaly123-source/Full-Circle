// The form functions on a local Supabase: what lands in the database, and the emails.
// Runs when SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_PUBLISHABLE_KEY point at a local stack
// (`supabase start`; the CI backend job sets them). Turnstile and Resend are stood in for by a small
// server on port 54399, which supabase/functions/.env points the functions at:
//   TURNSTILE_VERIFY_URL=http://host.docker.internal:54399/siteverify
//   RESEND_API_URL=http://host.docker.internal:54399/emails
//   RESEND_API_KEY=test
//   STAFF_EMAILS=staff@fullcircle.test
import { createServer, type Server } from 'node:http';
import { expect, test } from '@playwright/test';
import { ERRORS, NOTICE } from '../../supabase/functions/_shared/forms';

const URL_ = process.env.SUPABASE_URL ?? '', SECRET = process.env.SUPABASE_SECRET_KEY ?? '', PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
test.skip(!URL_ || !SECRET, 'no local Supabase (set SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_PUBLISHABLE_KEY)');
test.describe.configure({ mode: 'serial' });

const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
type Mail = { to: string[]; subject: string; text: string; html: string; reply_to?: string };
const mails: Mail[] = [];
let mock: Server;

test.beforeAll(async () => {
  mock = createServer(async (req, res) => {
    let body = '';
    try { for await (const c of req) body += c; } catch { return; } // cut off when the server closes
    res.setHeader('content-type', 'application/json');
    if (req.url === '/siteverify') res.end(JSON.stringify({ success: body.includes(TOKEN) }));
    else if (req.url === '/emails') { mails.push(JSON.parse(body)); res.end(JSON.stringify({ id: `mail-${mails.length}` })); }
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
  await expect.poll(async () => (await rows('notifications', `request_id=eq.${r.id}&select=audience,channel,status,detail&order=id`)).length).toBe(2);
  expect(await rows('notifications', `request_id=eq.${r.id}&select=audience,channel,status,detail&order=id`)).toEqual([
    { audience: 'staff', channel: 'email', status: 'sent', detail: null },
    { audience: 'client', channel: 'whatsapp', status: 'skipped', detail: 'WhatsApp messages start in phase 4' },
  ]);
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
