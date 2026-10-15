// What the two form functions share: the database and storage calls they make, replies with CORS,
// the Turnstile check, sending email through Resend and logging every message sent. Runs in Deno
// (Supabase Edge Functions) with no dependencies: the handful of calls below go straight to
// Supabase's REST and storage APIs.

import type { Contact } from './forms.ts';

const env = (k: string) => Deno.env.get(k)?.trim() || undefined;

/** The database and storage as the service role (row-level security does not apply to it). */
export function db() {
  const url = env('SUPABASE_URL')!;
  // new projects hand functions their secret keys as JSON; older ones the service role JWT
  let key = env('SUPABASE_SERVICE_ROLE_KEY');
  try { key = JSON.parse(env('SUPABASE_SECRET_KEYS') ?? '{}').default ?? key; } catch { /* keep the JWT */ }
  if (!key) throw new Error('no service key in the environment');
  // a secret key (sb_secret_…) goes in apikey alone; a JWT also as the bearer token
  const auth: Record<string, string> = key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
  async function call(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
    const res = await fetch(url + path, { ...init, headers: { ...auth, ...init.headers } });
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]}: ${res.status} ${await res.text()}`);
    return res;
  }
  const json = { 'Content-Type': 'application/json' };
  const query = (filters: Record<string, string>) => new URLSearchParams(filters).toString();
  const objectPath = (bucket: string, path: string) => `${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  return {
    /** Inserts rows; with `select`, returns the inserted rows' columns. */
    async insert<T = unknown>(table: string, rows: object | object[], select?: string): Promise<T[]> {
      const res = await call(`/rest/v1/${table}${select ? `?select=${select}` : ''}`, { method: 'POST', headers: { ...json, Prefer: select ? 'return=representation' : 'return=minimal' }, body: JSON.stringify(rows) });
      return select ? res.json() : [];
    },
    /** Counts rows matching PostgREST filters ({ contact: 'eq.x' }). */
    async count(table: string, filters: Record<string, string>) {
      const res = await call(`/rest/v1/${table}?select=id&${query(filters)}`, { method: 'HEAD', headers: { Prefer: 'count=exact' } });
      return Number(res.headers.get('content-range')?.split('/')[1] ?? 0);
    },
    async delete(table: string, filters: Record<string, string>) {
      await call(`/rest/v1/${table}?${query(filters)}`, { method: 'DELETE' });
    },
    async upload(bucket: string, path: string, body: Blob, type: string) {
      await call(`/storage/v1/object/${objectPath(bucket, path)}`, { method: 'POST', headers: { 'Content-Type': type, 'x-upsert': 'false' }, body });
    },
    async removeFiles(bucket: string, paths: string[]) {
      await call(`/storage/v1/object/${bucket}`, { method: 'DELETE', headers: json, body: JSON.stringify({ prefixes: paths }) });
    },
    /** Links that open private files for a while, in the order of `paths` ('' where one failed). */
    async signedUrls(bucket: string, paths: string[], seconds: number): Promise<string[]> {
      const res = await call(`/storage/v1/object/sign/${bucket}`, { method: 'POST', headers: json, body: JSON.stringify({ expiresIn: seconds, paths }) });
      const out: { signedURL?: string | null }[] = await res.json();
      return out.map((o) => (o.signedURL ? `${url}/storage/v1${o.signedURL}` : ''));
    },
  };
}

// The forms post from the site's pages, its previews and local builds. No cookies or credentials
// are involved, so any origin may call; the Turnstile check is what keeps robots out.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

export const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export const preflight = () => new Response(null, { status: 204, headers: CORS });

/** Runs work after the reply has gone (sending email should not hold up the form). */
export function later(work: Promise<unknown>) {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  const logged = work.catch((err) => console.error('[after reply]', err));
  if (rt) rt.waitUntil(logged); else return logged;
}

// Cloudflare's always-pass test key. Only the staging project and a local stack may fall back to it;
// anywhere else a missing TURNSTILE_SECRET_KEY turns every form away.
const TEST_SECRET = '1x0000000000000000000000000000000AA';
const STAGING_REF = 'kmsrzeqxgufrodefclty';

function turnstileSecret() {
  const set = env('TURNSTILE_SECRET_KEY');
  if (set) return set;
  const url = env('SUPABASE_URL') ?? '';
  return url.includes(STAGING_REF) || /\/\/(kong|localhost|127\.0\.0\.1)[:/]/.test(url) ? TEST_SECRET : undefined;
}

/** Asks Cloudflare whether the browser that sent the form passed the Turnstile check. */
export async function human(token: string, req: Request): Promise<boolean> {
  const secret = turnstileSecret();
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY is not set');
  if (!token) return false;
  const body = new FormData();
  body.set('secret', secret); body.set('response', token);
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (ip) body.set('remoteip', ip);
  const res = await fetch(env('TURNSTILE_VERIFY_URL') ?? 'https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const out = await res.json().catch(() => ({}));
  return out.success === true;
}

/**
 * A filter for rows from the same contact however it was typed: the email, the number in
 * international form, or the text itself when the number's country could not be told.
 */
export const sameContact = (reach: Contact, typed: string): Record<string, string> =>
  reach.channel === 'email' ? { email: `eq.${reach.email}` } : reach.whatsapp ? { whatsapp: `eq.${reach.whatsapp}` } : { contact: `eq.${typed}` };

/** Who gets the staff alerts (comma-separated STAFF_EMAILS, otherwise the address on the site). */
export const staffEmails = () => (env('STAFF_EMAILS') ?? 'fullcircleworks.co@gmail.com').split(',').map((s) => s.trim()).filter(Boolean);

type Email = { to: string[]; subject: string; text: string; html: string; replyTo?: string };
type Sent = { status: 'sent' | 'failed' | 'skipped'; providerId?: string; detail?: string };

/** Sends one email through Resend. Without RESEND_API_KEY nothing is sent and it says so. */
export async function sendEmail(m: Email): Promise<Sent> {
  const key = env('RESEND_API_KEY');
  if (!key) return { status: 'skipped', detail: 'RESEND_API_KEY is not set' };
  // until the domain is verified at Resend, only its test sender works, and only to the account's own address
  const from = env('EMAIL_FROM') ?? 'Full Circle <onboarding@resend.dev>';
  try {
    const res = await fetch(env('RESEND_API_URL') ?? 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: m.to, subject: m.subject, text: m.text, html: m.html, reply_to: m.replyTo }),
    });
    const out = await res.json().catch(() => ({}));
    return res.ok ? { status: 'sent', providerId: out.id } : { status: 'failed', detail: `${res.status} ${out.message ?? out.name ?? ''}`.trim() };
  } catch (err) {
    return { status: 'failed', detail: String(err) };
  }
}

type Note = {
  event: 'request_received' | 'contact_message'; audience: 'staff' | 'client'; channel: 'email' | 'whatsapp';
  recipients: string[]; sent: Sent; request_id?: number; message_id?: number;
};

/** Writes one row per recipient to the notifications log. */
export async function logNotification(client: ReturnType<typeof db>, n: Note) {
  const rows = n.recipients.map((recipient) => ({
    event: n.event, audience: n.audience, channel: n.channel, recipient, status: n.sent.status,
    provider_id: n.sent.providerId ?? null, detail: n.sent.detail ?? null, request_id: n.request_id ?? null, message_id: n.message_id ?? null,
  }));
  try { await client.insert('notifications', rows); } catch (err) { console.error('[notifications]', err); }
}

/** WhatsApp messages from the system number start in phase 4; until then they are logged as skipped. */
export const WHATSAPP_LATER: Sent = { status: 'skipped', detail: 'WhatsApp messages start in phase 4' };

/** Turns a form away: the message for the error line, and the field it is about. */
export const refuse = (error: string, status = 400, field?: string) => reply(field ? { error, field } : { error }, status);

/** Logs an unexpected failure and answers with the general error line. */
export function crash(where: string, err: unknown, message: string) {
  console.error(`[${where}]`, err);
  return reply({ error: message }, 500);
}
