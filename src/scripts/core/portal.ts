// The portal's link to Supabase (phase 3): the client's orders, signed links to their photos, and
// the three things a client can do, as the person signed in (core/auth.ts). No library: a few calls
// to Supabase's REST APIs (the database, Storage), as the Edge Functions make theirs.
import { BACKEND } from '../../data/backend';
import { NOTICE, type Problem } from '../../../supabase/functions/_shared/forms';
import { AUTH_ERRORS, SignedOut, authClient, reply, type Who } from './auth';

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

// Sign-in and the session (shared with the admin, which keeps its own session)
const session = authClient('fc-portal-session');
export const { signedIn, me, sendCode, verifyCode, signOut } = session;
const call = session.call;
export { AUTH_ERRORS, SignedOut, type Who };

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
    if (res.ok) { sendQueued(); return null; }
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

/**
 * Asks the notify function to send the messages an action queued (staff hear of an approval at
 * once). It runs on its own: the page does not wait for it, and what it misses goes with the next.
 */
export function sendQueued() {
  call('/functions/v1/notify', { method: 'POST', body: '{}' }).catch(() => { /* sent with the next call */ });
}
