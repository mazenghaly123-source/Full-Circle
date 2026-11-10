// Booking a call on the site. The site keeps its own calendar (Mazen, 9 Nov 2026): the free times are the
// working hours less the calls already booked (_shared/booking.ts, the bookings table). Two calls, both POST
// application/json:
//
// { slots: true }: the days ahead with their free times, as { calendar: true, days }.
// BookingData (_shared/booking.ts): checks it and the Turnstile token, checks the time is still free, saves the
//   booking (one booking per time, held by the database too), and emails the client a confirmation and staff an
//   alert, each with the calendar invite attached. Answers with the time in words.
import { BOOKING_NOTICE, BOOKING_RULES, BOOK_ERRORS, FLOOR, KIND_TITLES, checkBooking, endOf, freeDays, inviteFile, isFree, whenText, type Busy } from '../_shared/booking.ts';
import { clientBookingEmail, staffBookingEmail } from '../_shared/emails.ts';
import { ERRORS } from '../_shared/forms.ts';
import { crash, db, human, later, preflight, refuse, reply, sendEmail, staffEmails } from '../_shared/server.ts';

/** Bookings from one email in an hour before it is asked to use WhatsApp instead. */
const PER_HOUR = 3;

/** The calls already booked between two moments (a closed one no longer holds its time). */
async function booked(client: ReturnType<typeof db>, from: Date, to: Date): Promise<Busy[]> {
  const rows = await client.select<{ starts_at: string; ends_at: string }>('bookings', 'starts_at,ends_at', {
    starts_at: `lt.${to.toISOString()}`, ends_at: `gt.${from.toISOString()}`, status: 'neq.closed',
  });
  return rows.map((r) => ({ start: new Date(r.starts_at), end: new Date(r.ends_at) }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return refuse('Send it with POST', 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return refuse(ERRORS.failed); }
  const client = db();
  if (raw && typeof raw === 'object' && 'slots' in raw) {
    const now = new Date();
    try {
      return reply({ calendar: true, days: freeDays(now, await booked(client, now, new Date(now.getTime() + (BOOKING_RULES.aheadDays + 2) * 86400_000))) });
    } catch (err) {
      console.error('[booked times]', err);
      return reply({ calendar: false });
    }
  }

  const checked = checkBooking(raw as never);
  if (!checked.ok) return refuse(checked.error, 400, checked.field);
  const b = checked.value;
  if (b.notice !== BOOKING_NOTICE.version) return refuse(ERRORS.failed);

  try {
    if (!(await human(b.turnstile, req))) return refuse(ERRORS.robot, 403, 'robot');
  } catch (err) { return crash('turnstile', err, ERRORS.failed); }

  const now = new Date(), end = endOf(b.start);
  let saved: { id: number; created_at: string };
  try {
    const gap = BOOKING_RULES.gap * 60000, start = new Date(b.start).getTime();
    if (!isFree(b.start, now, await booked(client, new Date(start - gap), new Date(new Date(end).getTime() + gap)))) return refuse(BOOK_ERRORS.taken, 409, 'slot');
    if (await client.count('bookings', { email: `eq.${b.email}`, created_at: `gte.${new Date(Date.now() - 3600_000).toISOString()}` }) >= PER_HOUR) return refuse(ERRORS.tooMany, 429);
    [saved] = await client.insert<typeof saved>('bookings', {
      kind: b.kind, starts_at: b.start, ends_at: end, name: b.name, phone: b.phone, whatsapp: b.whatsapp, email: b.email, brand: b.brand,
      note: b.note || null, source: b.source, notice_version: b.notice,
    }, 'id,created_at');
  } catch (err) {
    // two people sent the same time at once: the database kept one
    if (String(err).includes('bookings_one_per_time')) return refuse(BOOK_ERRORS.taken, 409, 'slot');
    return crash('insert booking', err, ERRORS.failed);
  }

  const when = whenText(b.start), meet: string | null = null;
  later((async () => {
    const reach = b.whatsapp ?? b.phone;
    const invite = (title: string, description: string) => ({
      filename: 'invite.ics', contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
      content: inviteFile({ id: saved.id, kind: b.kind, start: b.start, end, title, description, location: b.kind === 'visit' ? FLOOR : undefined }),
    });
    const toClient = await sendEmail({
      to: [b.email], ...clientBookingEmail({ ...b, when, meet }),
      attachments: [invite(`${KIND_TITLES[b.kind]} with Full Circle`, b.kind === 'phone' ? `We call you on ${reach}.` : b.kind === 'online' ? 'We send the video link on WhatsApp before the call.' : 'At the floor, Gisr El Suez, Cairo.')],
    });
    if (toClient.status !== 'sent') console.error('[booking email to client]', toClient.status, toClient.detail);
    const toStaff = await sendEmail({
      to: staffEmails(), ...staffBookingEmail({ ...b, when, meet, at: new Date(saved.created_at) }), replyTo: b.email,
      attachments: [invite(`${KIND_TITLES[b.kind]}: ${b.brand}`, [`${b.name}, ${b.brand}`, `WhatsApp: ${reach}`, `Email: ${b.email}`, ...(b.note ? ['', b.note] : [])].join('\n'))],
    });
    if (toStaff.status !== 'sent') console.error('[booking email to staff]', toStaff.status, toStaff.detail);
  })());
  return reply({ ok: true, when, meet });
});
