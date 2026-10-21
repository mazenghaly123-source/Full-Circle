// Sign-in by a 6-digit code (Supabase Auth) and the session it starts, with no library: the
// portal's clients and the admin's staff sign in the same way, each into their own session.
import { BACKEND } from '../../data/backend';
import { ERRORS, type Problem } from '../../../supabase/functions/_shared/forms';

/** Who is signing in: the email, or the WhatsApp number in international form. */
export type Who = { email: string } | { phone: string };

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

const json = { 'Content-Type': 'application/json', apikey: BACKEND.key };
const auth = (path: string, body: object, headers: Record<string, string> = {}) =>
  fetch(`${BACKEND.url}/auth/v1/${path}`, { method: 'POST', headers: { ...json, ...headers }, body: JSON.stringify(body) });
/** The error a Supabase API answered with. */
export const reply = async (res: Response) => res.json().catch(() => ({})) as Promise<{ error_code?: string; code?: string | number; msg?: string; message?: string }>;
const started = (r: { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user?: { id: string } }, user?: string): Session =>
  ({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at ?? Math.floor(Date.now() / 1000) + (r.expires_in ?? 3600), user: { id: r.user?.id ?? user! } });

/**
 * A sign-in by code and the session it starts, kept in the browser under `store` (the portal and
 * the admin each keep their own: a person can be both a client and staff). It is the only thing the
 * site keeps in the browser (/privacy).
 */
export function authClient(store: string) {
  let session: Session | null = (() => { try { const s = JSON.parse(localStorage.getItem(store) ?? 'null'); return s?.access_token ? s : null; } catch { return null; } })();
  function keep(s: Session | null) {
    session = s;
    try { if (s) localStorage.setItem(store, JSON.stringify(s)); else localStorage.removeItem(store); } catch { /* private mode: the session lasts for this page */ }
  }

  /**
   * Sends a sign-in code. It answers the same whether or not the email or number is on an order (the
   * page never says which), so "not found" counts as sent.
   */
  async function sendCode(who: Who, captcha: string): Promise<Problem | null> {
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
  async function verifyCode(who: Who, token: string): Promise<Problem | null> {
    try {
      const res = await auth('verify', { ...who, token, type: 'phone' in who ? 'sms' : 'email' });
      const r = await res.json().catch(() => ({}));
      if (res.ok && r.access_token) { keep(started(r)); return null; }
      if (res.status === 429) return { error: AUTH_ERRORS.tooMany };
      return { error: res.status >= 500 ? AUTH_ERRORS.failed : AUTH_ERRORS.wrong };
    } catch {
      return { error: AUTH_ERRORS.failed };
    }
  }

  function signOut() {
    const s = session; keep(null);
    if (s) auth('logout', {}, { Authorization: `Bearer ${s.access_token}` }).catch(() => { /* the session is gone here either way */ });
  }

  /** The refresh under way, which calls made at the same moment share (a refresh token is used once). */
  let refreshing: Promise<string> | null = null;

  /** A current access token: refreshed a minute before it runs out. */
  async function token(force = false) {
    if (!session) throw new SignedOut();
    if (!force && !refreshing && session.expires_at - 60 > Date.now() / 1000) return session.access_token;
    refreshing ??= (async () => {
      const s = session!;
      const res = await auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token }).catch(() => null);
      // offline, or Auth busy or down: keep the session and let the caller say it could not reach us
      if (!res || res.status === 429 || res.status >= 500) throw new Error('auth unavailable');
      const r = await res.json().catch(() => ({}));
      if (!res.ok || !r.access_token) { keep(null); throw new SignedOut(); }
      keep(started(r, s.user.id));
      return r.access_token as string;
    })().finally(() => { refreshing = null; });
    return refreshing;
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

  return {
    signedIn: () => !!session,
    /** The signed-in person's user id (the portal's log says "You" for their own entries). */
    me: () => session?.user.id ?? null,
    /** The current access token, for calls that are not to the database (Storage, functions). */
    token,
    sendCode, verifyCode, signOut, call,
  };
}
