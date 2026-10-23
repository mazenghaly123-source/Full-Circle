// Sends the queued messages about orders (order_notifications): a client's people hear of a
// decision waiting, a stage move and new photos; staff hear of approvals, change requests and photo
// requests. The portal and the admin call it after each action. Each call sends whatever is queued
// (claimed, so two calls never send the same message), so what a failed call left goes out with
// the next one. Several photos for one person on one order go in one email.
//
// The client's people who opted in hear on WhatsApp too (a template per event, docs/whatsapp.md);
// those rows are marked skipped until Meta is set up.
//
// POST, signed in (as a client's person or staff).
import { orderEmail, type OrderEvent, type OrderMail } from '../_shared/emails.ts';
import { caller, crash, db, preflight, refuse, reply, sendEmail, siteUrl } from '../_shared/server.ts';
import { orderMessage, sendWhatsApp } from '../_shared/whatsapp.ts';

type Queued = { id: number; order_id: number; event: OrderEvent; audience: 'staff' | 'client'; channel: 'email' | 'whatsapp'; recipient: string };
type Order = {
  id: number; code: string; name: string; stage: number; clients: { brand: string } | null;
  order_decisions: { title: string; opened_at: string }[];
  order_events: { id: number; kind: string; stage: number | null; note: string | null }[];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return refuse('Send it with POST', 405);
  try { if (!(await caller(req))) return refuse('Sign in again', 401); } catch (err) { return crash('caller', err, 'Could not check who you are. Try again'); }

  const client = db();
  try {
    const queued = await client.rpc<Queued[]>('claim_order_notifications', { p_limit: 50 });
    if (!queued.length) return reply({ sent: 0 });
    const ids = [...new Set(queued.map((q) => q.order_id))];
    const orders = await client.select<Order>('orders',
      'id,code,name,stage,clients(brand),order_decisions(title,opened_at),order_events(id,kind,stage,note)', { id: `in.(${ids.join(',')})` });

    // one message per person, order, event and channel
    const groups = new Map<string, Queued[]>();
    for (const q of queued) {
      const key = [q.recipient, q.order_id, q.event, q.channel].join('|');
      groups.set(key, [...(groups.get(key) ?? []), q]);
    }
    let sent = 0;
    for (const rows of groups.values()) {
      const q = rows[0], o = orders.find((x) => x.id === q.order_id);
      const wa = o && q.channel === 'whatsapp' ? orderMessage(q.event, mailOf(o, q.event), rows.length) : null;
      const out = !o ? { status: 'skipped' as const, detail: 'The order no longer exists' }
        : q.channel === 'email' ? await sendEmail({ to: [q.recipient], ...orderEmail(q.event, mailOf(o, q.event), siteUrl(), rows.length) })
        : wa ? await sendWhatsApp(q.recipient, wa)
        : { status: 'skipped' as const, detail: 'Staff hear of this by email' };
      await client.update('order_notifications', { id: `in.(${rows.map((r) => r.id).join(',')})` },
        { status: out.status, provider_id: out.providerId ?? null, detail: out.detail ?? null });
      if (out.status === 'sent') sent++;
    }
    return reply({ sent });
  } catch (err) {
    return crash('notify', err, 'Could not send the messages');
  }
});

/** What the email for an event needs: the latest decision, and the client's latest note or photo request. */
function mailOf(o: Order, event: OrderEvent): OrderMail {
  const decision = [...o.order_decisions].sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0];
  const latest = (kind: string) => [...o.order_events].filter((e) => e.kind === kind).sort((a, b) => b.id - a.id)[0];
  const asked = event === 'changes_asked' ? latest('changes_asked') : event === 'photo_asked' ? latest('photo_asked') : undefined;
  return {
    id: o.id, code: o.code, name: o.name, stage: o.stage, brand: o.clients?.brand ?? 'The client',
    decision: decision?.title, note: asked?.note ?? undefined, photoStage: asked?.stage ?? undefined,
  };
}
