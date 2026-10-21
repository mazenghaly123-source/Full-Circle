// The portal's link to Supabase (phase 3): sign-in by a 6-digit code, the session, the client's
// orders, signed links to their photos, and the three things a client can do. No library: a few
// calls to Supabase's REST APIs (Auth, the database, Storage), as the Edge Functions make theirs.
import { BACKEND } from '../../data/backend';
import { ERRORS, NOTICE, type Problem } from '../../../supabase/functions/_shared/forms';

/** Who is signing in: the email, or the WhatsApp number in international form. */
export type Who = { email: string } | { phone: string };

export type Decision = { id: number; stage: number; title: string; body: string | null; status: 'open' | 'approved' | 'changes_asked' | 'withdrawn'; opened_at: string; closed_at: string | null };
export type Photo = { id: number; stage: number; object_path: string; caption: string | null; created_at: string };
export type LogEntry = {
  id: number; kind: 'order_opened' | 'decision_opened' | 'decision_withdrawn' | 'approved' | 'changes_asked' | 'photo_asked' | 'photo_added' | 'stage_moved';
  side: 'client' | 'staff'; actor_id: string | null; actor_label: string; stage: number | null; to_stage: number | null;
  decision_id: number | null; title: string | null; note: string | null; created_at: string;
};
export type Order = {
  id: number; code: string; name: string; product: string; summary: string | null; qty: number | null;
  /** 1 to 8 */
  stage: number; status: 'active' | 'paused' | 'delivered' | 'cancelled'; created_at: string;
  order_specs: { key: string; value: string; position: number }[];
  order_decisions: Decision[];
  stage_photos: Photo[];
  order_events: LogEntry[];
  photo_requests: { stage: number; answered_at: string | null }[];
};
/** Everything the portal shows for the person signed in. */
export type Portal = { brand: string; whatsapp: string | null; updates: boolean; orders: Order[]; urls: Record<string, string> };

/** The words the sign-in shows when something goes wrong. */
export const AUTH_ERRORS = {
  id: 'Add the email or WhatsApp number on your order',
  country: 'Add the number with its country code (+20…), or use your email',
  code: 'Enter the 6 digits from the message',
  wrong: 'That code is wrong or has expired. Check it, or send a new one',
  tooMany: 'Too many tries. Wait a few minutes, then send a new code',
  whatsapp: 'Codes on WhatsApp are not switched on yet. Use the email on your order',
  failed: 'Could not reach Full Circle. Check your connection and try again',
  robot: ERRORS.robot,
  signedOut: 'You were signed out. Sign in again',
} as const;

/** The session ends (or was never there): the page goes back to the sign-in. */
export class SignedOut extends Error {}

type Session = { access_token: string; refresh_token: string; expires_at: number; user: { id: string } };
// The only thing the site keeps in the browser: the signed-in person's session (/privacy)
const STORE = 'fc-portal-session';
let session: Session | null = (() => { try { const s = JSON.parse(localStorage.getItem(STORE) ?? 'null'); return s?.access_token ? s : null; } catch { return null; } })();
function keep(s: Session | null) {
  session = s;
  try { if (s) localStorage.setItem(STORE, JSON.stringify(s)); else localStorage.removeItem(STORE); } catch { /* private mode: the session lasts for this page */ }
}
export const signedIn = () => !!session;
/** The signed-in person's user id (the log says "You" for their own entries). */
export const me = () => session?.user.id ?? null;

const json = { 'Content-Type': 'application/json', apikey: BACKEND.key };
const auth = (path: string, body: object, headers: Record<string, string> = {}) =>
  fetch(`${BACKEND.url}/auth/v1/${path}`, { method: 'POST', headers: { ...json, ...headers }, body: JSON.stringify(body) });
const reply = async (res: Response) => res.json().catch(() => ({})) as Promise<{ error_code?: string; code?: string | number; msg?: string; message?: string }>;

/**
 * Sends a sign-in code. It answers the same whether or not the email or number is on an order (the
 * page never says which), so "not found" counts as sent.
 */
export async function sendCode(who: Who, captcha: string): Promise<Problem | null> {
  try {
    const res = await auth('otp', { ...who, create_user: false, ...('phone' in who ? { channel: 'whatsapp' } : {}), gotrue_meta_security: { captcha_token: captcha } });
    if (res.ok) return null;
    const r = await reply(res), code = String(r.error_code ?? r.code ?? '');
    if (res.status === 429 || code.startsWith('over_')) return { error: AUTH_ERRORS.tooMany };
    if (code === 'captcha_failed') return { error: AUTH_ERRORS.robot };
    if ('phone' in who && /phone_provider|sms_send_failed/.test(code)) return { error: AUTH_ERRORS.whatsapp };
    if (/otp_disabled|signup_disabled|user_not_found/.test(code) || /signups not allowed/i.test(r.msg ?? r.message ?? '')) return null;
    return { error: AUTH_ERRORS.failed };
  } catch {
    return { error: AUTH_ERRORS.failed };
  }
}

/** Checks the code and starts the session. */
export async function verifyCode(who: Who, token: string): Promise<Problem | null> {
  try {
    const res = await auth('verify', { ...who, token, type: 'phone' in who ? 'sms' : 'email' });
    const r = await res.json().catch(() => ({}));
    if (res.ok && r.access_token) { keep({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at ?? Math.floor(Date.now() / 1000) + (r.expires_in ?? 3600), user: { id: r.user?.id } }); return null; }
    if (res.status === 429) return { error: AUTH_ERRORS.tooMany };
    return { error: res.status >= 500 ? AUTH_ERRORS.failed : AUTH_ERRORS.wrong };
  } catch {
    return { error: AUTH_ERRORS.failed };
  }
}

export function signOut() {
  const s = session; keep(null);
  if (s) auth('logout', {}, { Authorization: `Bearer ${s.access_token}` }).catch(() => { /* the session is gone here either way */ });
}

/** A current access token: refreshed a minute before it runs out. */
async function token(force = false) {
  if (!session) throw new SignedOut();
  if (!force && session.expires_at - 60 > Date.now() / 1000) return session.access_token;
  const res = await auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token }).catch(() => null);
  if (!res) throw new Error('offline');
  const r = await res.json().catch(() => ({}));
  if (!res.ok || !r.access_token) { keep(null); throw new SignedOut(); }
  keep({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at ?? Math.floor(Date.now() / 1000) + (r.expires_in ?? 3600), user: { id: r.user?.id ?? session.user.id } });
  return session!.access_token;
}

/** A call as the signed-in person; a rejected token is refreshed once before giving up. */
async function call(path: string, init: RequestInit = {}) {
  for (const force of [false, true]) {
    const res = await fetch(`${BACKEND.url}${path}`, { ...init, headers: { ...json, Authorization: `Bearer ${await token(force)}`, ...(init.headers as Record<string, string>) } });
    if (res.status !== 401) return res;
  }
  keep(null);
  throw new SignedOut();
}

const ORDER_FIELDS = 'id,code,name,product,summary,qty,stage,status,created_at,order_specs(key,value,position),'
  + 'order_decisions(id,stage,title,body,status,opened_at,closed_at),stage_photos(id,stage,object_path,caption,created_at),'
  + 'order_events(id,kind,side,actor_id,actor_label,stage,to_stage,decision_id,title,note,created_at),photo_requests(stage,answered_at)';

/** The person's brand, orders (newest first) and signed links to their photos. */
export async function load(): Promise<Portal> {
  const get = async <T>(path: string): Promise<T> => {
    const res = await call(`/rest/v1/${path}`);
    if (!res.ok) throw new Error(`${path.split('?')[0]}: ${res.status}`);
    return res.json();
  };
  const [clients, people, orders, consent] = await Promise.all([
    get<{ brand: string }[]>('clients?select=brand&order=brand'),
    get<{ whatsapp: string | null }[]>('client_members?select=whatsapp&order=id'),
    get<Order[]>(`orders?select=${ORDER_FIELDS}&order=created_at.desc`),
    rpcRead<{ channel: string; opted_in: boolean }[]>('my_updates_consent'),
  ]);
  const paths = orders.flatMap((o) => o.stage_photos.map((p) => p.object_path));
  return {
    brand: clients.map((c) => c.brand).join(' / '),
    whatsapp: people.find((p) => p.whatsapp)?.whatsapp ?? null,
    updates: consent.some((c) => c.channel === 'whatsapp' && c.opted_in),
    orders,
    urls: paths.length ? await sign(paths) : {},
  };
}

/** Signed links to stage photos (private bucket), good for an hour. */
async function sign(paths: string[]): Promise<Record<string, string>> {
  const res = await call('/storage/v1/object/sign/stage-photos', { method: 'POST', body: JSON.stringify({ expiresIn: 3600, paths }) });
  if (!res.ok) return {};
  const out: { path: string | null; signedURL: string | null }[] = await res.json().catch(() => []);
  return Object.fromEntries(out.filter((x) => x.path && x.signedURL).map((x) => [x.path, `${BACKEND.url}/storage/v1${x.signedURL}`]));
}

async function rpcRead<T>(fn: string): Promise<T> {
  const res = await call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: '{}' });
  if (!res.ok) throw new Error(`${fn}: ${res.status}`);
  return res.json();
}

/**
 * One of the client's actions, through its checked database function. A refusal comes back in the
 * function's own words ("This decision is already closed"); it never throws but for SignedOut.
 */
export async function act(fn: 'approve_decision' | 'request_changes' | 'request_photo' | 'set_updates_consent', args: object): Promise<Problem | null> {
  try {
    const res = await call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
    if (res.ok) return null;
    const r = await reply(res);
    return { error: res.status < 500 && r.message ? r.message : AUTH_ERRORS.failed };
  } catch (e) {
    if (e instanceof SignedOut) throw e;
    return { error: AUTH_ERRORS.failed };
  }
}

/** Turns order updates on WhatsApp on or off, storing the words shown. */
export const setUpdates = (on: boolean) =>
  act('set_updates_consent', { p_channel: 'whatsapp', p_opted_in: on, p_wording: NOTICE.whatsappUpdates, p_version: NOTICE.version });
