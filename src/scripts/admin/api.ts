// The admin's link to Supabase (phase 4), as the member of staff signed in. Staff read everything
// through row-level security and change orders only through the database functions, which write the
// approval log (supabase/migrations). Adding people and sending messages go through the invite and
// notify Edge Functions. No library: a few REST calls, as the portal makes (core/portal.ts).
import { BACKEND } from '../../data/backend';
import { SignedOut, authClient, reply } from '../core/auth';
import type { LogEntry } from '../core/portal';

/** The staff's own session (a person can also be a client, with a portal session of their own). */
export const session = authClient('fc-admin-session');
export { SignedOut };

export type Role = 'owner' | 'staff';
export type Staff = { user_id: string; name: string; role: Role; created_at: string };
export type Request = {
  id: number; code: string; path: string; product: string; qty: string | null; have: string | null; brand: string;
  contact: string; contact_channel: 'email' | 'whatsapp'; email: string | null; whatsapp: string | null; note: string | null;
  status: 'new' | 'replied' | 'converted' | 'closed'; source: Record<string, string>; created_at: string;
  orders: { id: number; code: string }[];
};
export type Message = {
  id: number; name: string; contact: string; contact_channel: 'email' | 'whatsapp'; email: string | null; whatsapp: string | null;
  text: string; status: 'new' | 'replied' | 'closed'; created_at: string;
};
export type Member = { id: number; name: string; email: string; whatsapp: string | null; created_at: string };
export type Client = { id: number; brand: string; notes: string | null; created_at: string; client_members: Member[]; orders: { id: number; code: string; name: string; stage: number; status: string }[] };
export type Decision = { id: number; stage: number; title: string; body: string | null; photo_ids: number[]; status: 'open' | 'approved' | 'changes_asked' | 'withdrawn'; note: string | null; opened_label: string; opened_at: string; closed_label: string | null; closed_at: string | null };
export type Photo = { id: number; stage: number; object_path: string; caption: string | null; created_at: string };
export type PhotoRequest = { id: number; stage: number; note: string | null; asked_label: string; created_at: string; answered_at: string | null };
export type Note = { id: number; event: string; audience: 'staff' | 'client'; channel: 'email' | 'whatsapp'; recipient: string; status: 'queued' | 'sent' | 'failed' | 'skipped'; detail: string | null; created_at: string };
export type Status = 'active' | 'paused' | 'delivered' | 'cancelled';
/** An order as the lists show it. */
export type OrderRow = {
  id: number; code: string; name: string; product: string; summary: string | null; qty: number | null; stage: number; status: Status; due_on: string | null; created_at: string;
  client_id: number; clients: { brand: string } | null;
  order_decisions: Pick<Decision, 'id' | 'stage' | 'title' | 'status'>[];
  photo_requests: Pick<PhotoRequest, 'stage' | 'answered_at'>[];
  order_events: Pick<LogEntry, 'id' | 'kind' | 'decision_id'>[];
};
/** An order with everything its page shows. */
export type Order = Omit<OrderRow, 'clients' | 'order_decisions' | 'photo_requests' | 'order_events'> & {
  request_id: number | null; fabric: string | null; qty: number | null;
  clients: { id: number; brand: string; client_members: Member[] } | null;
  order_specs: { id: number; key: string; value: string; position: number }[];
  order_decisions: Decision[]; stage_photos: Photo[]; photo_requests: PhotoRequest[]; order_events: LogEntry[]; order_notifications: Note[];
};

/** Something the server refused, in words to show (the database functions' own, where they have them). */
export class Refused extends Error {}
const FAILED = 'Could not reach Full Circle. Check the connection and try again';

async function ask(path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try { res = await session.call(path, init); } catch (e) { throw e instanceof SignedOut ? e : new Refused(FAILED); }
  if (res.ok) return res;
  const r = await reply(res);
  // a function's own refusal (raise exception '...') reads well; anything else gets the general line
  throw new Refused(res.status < 500 && r.message && !/violates|permission|syntax|column|relation/i.test(r.message) ? r.message : FAILED);
}
const get = async <T>(path: string): Promise<T> => (await ask(`/rest/v1/${path}`)).json();
const write = (path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown, prefer = 'return=minimal') =>
  ask(`/rest/v1/${path}`, { method, headers: { Prefer: prefer }, body: body === undefined ? undefined : JSON.stringify(body) });

/** The member of staff signed in, or null when the account is not on the team. */
export async function me(): Promise<Staff | null> {
  const id = session.me();
  return id ? (await get<Staff[]>(`staff?select=user_id,name,role,created_at&user_id=eq.${id}`))[0] ?? null : null;
}
export const team = () => get<Staff[]>('staff?select=user_id,name,role,created_at&order=name');
export const requests = () => get<Request[]>('requests?select=*,orders(id,code)&order=created_at.desc&limit=300');
/** A request as the figures count it. */
export type Counted = Pick<Request, 'id' | 'product' | 'path' | 'source' | 'created_at'> & { orders: { id: number }[] };
/** Every request since a time, for the figures (the inbox list above stops at its newest 300). */
export const requestsSince = (iso: string) =>
  get<Counted[]>(`requests?select=id,product,path,source,created_at,orders(id)&created_at=gte.${encodeURIComponent(iso)}&order=created_at.desc`);
export const messages = () => get<Message[]>('messages?select=*&order=created_at.desc&limit=300');
export const setStatus = (table: 'requests' | 'messages', id: number, status: string) => write(`${table}?id=eq.${id}`, 'PATCH', { status });

export const orders = () => get<OrderRow[]>('orders?select=id,code,name,product,summary,qty,stage,status,due_on,created_at,client_id,clients(brand),'
  + 'order_decisions(id,stage,title,status),photo_requests(stage,answered_at),order_events(id,kind,decision_id)&order=created_at.desc');
export async function order(id: number): Promise<Order | null> {
  const rows = await get<Order[]>(`orders?id=eq.${id}&select=*,clients(id,brand,client_members(id,name,email,whatsapp,created_at)),order_specs(id,key,value,position),`
    + 'order_decisions(*),stage_photos(id,stage,object_path,caption,created_at),photo_requests(id,stage,note,asked_label,created_at,answered_at),'
    + 'order_events(id,kind,side,actor_id,actor_label,stage,to_stage,decision_id,title,note,created_at),order_notifications(id,event,audience,channel,recipient,status,detail,created_at)');
  return rows[0] ?? null;
}
/** Every order with its decisions, photo requests and whole log: what Overview, Production and Approvals read. */
export type BoardOrder = Omit<OrderRow, 'clients' | 'order_decisions' | 'photo_requests' | 'order_events'> & {
  qty: number | null;
  clients: { brand: string; client_members: Pick<Member, 'name' | 'email' | 'whatsapp'>[] } | null;
  order_decisions: Decision[]; photo_requests: PhotoRequest[]; order_events: LogEntry[];
};
export const board = () => get<BoardOrder[]>('orders?select=id,code,name,product,summary,qty,stage,status,due_on,created_at,client_id,clients(brand,client_members(name,email,whatsapp)),'
  + 'order_decisions(*),photo_requests(id,stage,note,asked_label,created_at,answered_at),order_events(id,kind,side,actor_id,actor_label,stage,to_stage,decision_id,title,note,created_at)&order=created_at.desc');

export const updateOrder = (id: number, fields: Partial<Pick<Order, 'name' | 'product' | 'summary' | 'fabric' | 'qty' | 'status' | 'due_on'>>) =>
  write(`orders?id=eq.${id}`, 'PATCH', fields);
/** Replaces an order's spec rows with these, in this order. */
export async function saveSpecs(orderId: number, rows: { key: string; value: string }[]) {
  await write(`order_specs?order_id=eq.${orderId}`, 'DELETE');
  if (rows.length) await write('order_specs', 'POST', rows.map((r, position) => ({ order_id: orderId, key: r.key, value: r.value, position })));
}

export const clients = () => get<Client[]>('clients?select=id,brand,notes,created_at,client_members(id,name,email,whatsapp,created_at),orders(id,code,name,stage,status)&order=brand');
export async function addClient(brand: string): Promise<number> {
  const res = await write('clients?select=id', 'POST', { brand }, 'return=representation');
  return (await res.json())[0].id;
}

/**
 * One of the staff's database functions (create_order, move_stage, open_decision...). The messages
 * it queued are sent straight after, unless `notify` is false (a batch of photos sends once, at the end).
 */
export async function rpc<T = unknown>(fn: string, args: object, notify = true): Promise<T> {
  const res = await ask(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  if (notify) sendQueued();
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Adds a person to a client, or (owners) to staff; they are emailed where to sign in. */
export async function invite(body: { kind: 'client'; client_id: number; name: string; email: string; whatsapp?: string } | { kind: 'staff'; name: string; email: string; role: Role }) {
  const res = await session.call('/functions/v1/invite', { method: 'POST', body: JSON.stringify(body) }).catch((e) => { throw e instanceof SignedOut ? e : new Refused(FAILED); });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Refused(typeof out.error === 'string' ? out.error : FAILED), { field: out.field as string | undefined });
  return out as { ok: true; email: 'sent' | 'failed' | 'skipped' };
}

/** Asks the notify function to send what an action queued; the page does not wait for it. */
export function sendQueued() {
  session.call('/functions/v1/notify', { method: 'POST', body: '{}' }).catch(() => { /* sent with the next call */ });
}

/** Signed links to stage photos (private bucket), good for an hour. */
export async function signed(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const res = await ask('/storage/v1/object/sign/stage-photos', { method: 'POST', body: JSON.stringify({ expiresIn: 3600, paths }) }).catch(() => null);
  const out: { path: string | null; signedURL: string | null }[] = res ? await res.json().catch(() => []) : [];
  return Object.fromEntries(out.filter((x) => x.path && x.signedURL).map((x) => [x.path, `${BACKEND.url}/storage/v1${x.signedURL}`]));
}

/** The longest side a stage photo keeps: phone photos are resized before they are sent. */
const MAX_SIDE = 2000;

/**
 * Resizes a photo in the browser (JPEG, at most MAX_SIDE), stores it under the order, and records it
 * at a stage. The client's email waits for sendQueued(), so a batch of photos is one email.
 */
export async function addPhoto(orderId: number, stage: number, file: File, caption: string) {
  let blob: Blob = file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k); canvas.height = Math.round(bmp.height * k);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => b ? ok(b) : fail(new Error('no image')), 'image/jpeg', 0.86));
  } catch {
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new Refused('That file is not a photo this browser can read (use JPEG or PNG)');
  }
  const path = `${orderId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1]}`;
  await ask(`/storage/v1/object/stage-photos/${path}`, { method: 'POST', headers: { 'Content-Type': blob.type, 'x-upsert': 'false' }, body: blob });
  return rpc<number>('add_stage_photo', { p_order: orderId, p_stage: stage, p_object_path: path, p_caption: caption || null }, false);
}
