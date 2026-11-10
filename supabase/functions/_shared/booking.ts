// Booking a call on the site (Mazen, 9 Nov 2026, after Factory 21's /book): the kinds, the hours, the free
// times (the working hours less the calls already booked: the site keeps its own calendar), the checks on a
// booking and the calendar invite emailed with it. Plain TypeScript, so the site (src/) and the book-call Edge
// Function load the same copy, as with forms.ts.
import { LIMITS, cleanSource, toInternational, type Source } from './forms.ts';

/** The three kinds, in the page's order. */
export const BOOKING_KINDS = ['visit', 'phone', 'online'] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

/**
 * When a call can be booked: Sunday to Thursday, 9:00 to 17:00 in Cairo, 30 minutes, at least 15 minutes
 * between two meetings, starting on the hour or the half hour, from 3 hours ahead to 3 weeks ahead.
 */
export const BOOKING_RULES = {
  tz: 'Africa/Cairo',
  /** days of the week, 0 = Sunday */
  days: [0, 1, 2, 3, 4],
  /** opening and closing, in minutes after midnight */
  open: 9 * 60, close: 17 * 60,
  minutes: 30, gap: 15, step: 30,
  noticeHours: 3, aheadDays: 21,
} as const;

type Rules = typeof BOOKING_RULES;
export type Busy = { start: Date; end: Date };
/** A day with its free start times (ISO, UTC). `date` is the Cairo date, YYYY-MM-DD. */
export type Day = { date: string; slots: string[] };

/** The wall clock in a time zone at a moment. */
function wall(at: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

/** How far a time zone is ahead of UTC at a moment, in minutes (Cairo: 120, or 180 in summer time). */
function offset(at: Date, tz: string) {
  const w = wall(at, tz);
  return Math.round((Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s) - at.getTime()) / 60000);
}

/** The moment a wall-clock time in the zone happens: y-m-d at `minutes` after midnight. */
export function zoned(y: number, m: number, d: number, minutes: number, tz: string = BOOKING_RULES.tz): Date {
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let t = guess - offset(new Date(guess), tz) * 60000;
  const again = offset(new Date(t), tz);
  if (again !== offset(new Date(guess), tz)) t = guess - again * 60000;
  return new Date(t);
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Whether a meeting from `start` keeps its distance from every call already booked. */
const clear = (start: Date, busy: Busy[], r: Rules) => {
  const from = start.getTime() - r.gap * 60000, to = start.getTime() + (r.minutes + r.gap) * 60000;
  return busy.every((b) => b.end.getTime() <= from || b.start.getTime() >= to);
};

/** The days ahead with their free start times. Days without one are left out. */
export function freeDays(now: Date, busy: Busy[], r: Rules = BOOKING_RULES): Day[] {
  const today = wall(now, r.tz), earliest = now.getTime() + r.noticeHours * 3600_000, out: Day[] = [];
  for (let i = 0; i <= r.aheadDays; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    if (!(r.days as readonly number[]).includes(day.getUTCDay())) continue;
    const [y, m, d] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()];
    const slots: string[] = [];
    for (let t = r.open; t + r.minutes <= r.close; t += r.step) {
      const start = zoned(y, m, d, t, r.tz);
      if (start.getTime() >= earliest && clear(start, busy, r)) slots.push(start.toISOString());
    }
    if (slots.length) out.push({ date: iso(y, m, d), slots });
  }
  return out;
}

/** Whether a start time is one the page could offer now: on the grid, in the hours and free. */
export const isFree = (start: string, now: Date, busy: Busy[], r: Rules = BOOKING_RULES) =>
  freeDays(now, busy, r).some((d) => d.slots.includes(start));

/** The end of a meeting that starts at `start`. */
export const endOf = (start: string, r: Rules = BOOKING_RULES) => new Date(new Date(start).getTime() + r.minutes * 60000).toISOString();

/**
 * A moment's parts in Cairo time. Put together by hand: engines join them differently ("Mon 16 Nov" in one,
 * "Mon, 16 Nov" in another), and the site, the admin and the emails must read the same.
 */
function cairo(at: Date, tz: string = BOOKING_RULES.tz) {
  const p = (o: Intl.DateTimeFormatOptions) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...o }).formatToParts(at).map((x) => [x.type, x.value]));
  const long = p({ weekday: 'long', day: 'numeric', month: 'long' }), short = p({ weekday: 'short', month: 'short' }), w = wall(at, tz);
  return { weekday: long.weekday, wd: short.weekday, day: long.day, month: long.month, mon: short.month, time: `${String(w.h).padStart(2, '0')}:${String(w.min).padStart(2, '0')}` };
}

/** A start time in words, in Cairo time: "Sunday 16 November, 10:30". */
export const whenText = (start: string, tz: string = BOOKING_RULES.tz) => { const c = cairo(new Date(start), tz); return `${c.weekday} ${c.day} ${c.month}, ${c.time}`; };
/** A start time in short, in Cairo time: "Sun 16 Nov, 10:30". */
export const whenShort = (start: string, tz: string = BOOKING_RULES.tz) => { const c = cairo(new Date(start), tz); return `${c.wd} ${c.day} ${c.mon}, ${c.time}`; };
/** A Cairo date (YYYY-MM-DD) in short: "Sun 16 Nov". */
export const dayShort = (date: string) => { const c = cairo(new Date(`${date}T12:00:00Z`), 'UTC'); return `${c.wd} ${c.day} ${c.mon}`; };
/** A start time's clock, in Cairo time: "10:30". */
export const timeShort = (start: string, tz: string = BOOKING_RULES.tz) => cairo(new Date(start), tz).time;

/** The privacy line under the button, with its own version, stored with each booking (as NOTICE in forms.ts). */
export const BOOKING_NOTICE = {
  version: '2026-11-09',
  text: 'We use these details to book the call and send you the invite. They are stored mainly in Frankfurt, Germany; some of our providers in the US and elsewhere also process them.',
} as const;

/** What the booking form sends. */
export type BookingData = {
  kind: string; start: string; name: string; phone: string; email: string; brand: string; note: string;
  notice: string; source: Source; turnstile: string;
};

/** The error lines of the booking form. */
export const BOOK_ERRORS = {
  kind: 'Pick how we meet',
  slot: 'Pick a day and a time',
  taken: 'That time was just taken. Pick another',
  name: 'Add your name',
  phone: 'Add a WhatsApp or phone number',
  email: 'Add your email: the invite goes there',
  brand: 'Add the brand name',
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type Checked<T> = { ok: true; value: T } | { ok: false; error: string; field: string };

/**
 * Checks a booking's fields (not whether the time is still free: the function checks the bookings). The
 * number is kept as typed, and in international form when its country can be told.
 */
export function checkBooking(d: Partial<BookingData>): Checked<BookingData & { kind: BookingKind; whatsapp: string | null }> {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  if (!(BOOKING_KINDS as readonly string[]).includes(String(d.kind)) || !s(d.start) || Number.isNaN(Date.parse(s(d.start)))) return { ok: false, error: BOOK_ERRORS.slot, field: 'slot' };
  const name = s(d.name), phone = s(d.phone), email = s(d.email).toLowerCase(), brand = s(d.brand);
  if (!name || name.length > LIMITS.name) return { ok: false, error: BOOK_ERRORS.name, field: 'name' };
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[\d\s().\-/]+$/.test(phone) || digits.length < 7 || digits.length > 15) return { ok: false, error: BOOK_ERRORS.phone, field: 'phone' };
  if (!EMAIL.test(email) || email.length > LIMITS.contact) return { ok: false, error: BOOK_ERRORS.email, field: 'email' };
  if (!brand || brand.length > LIMITS.brand) return { ok: false, error: BOOK_ERRORS.brand, field: 'brand' };
  return {
    ok: true,
    value: {
      kind: d.kind as BookingKind, start: new Date(s(d.start)).toISOString(), name, phone, whatsapp: toInternational(phone), email, brand,
      note: s(d.note).slice(0, LIMITS.note), notice: s(d.notice), source: cleanSource(d.source), turnstile: s(d.turnstile),
    },
  };
}

/** What the meeting is called, by kind. */
export const KIND_TITLES = { visit: 'Visit at the floor', phone: 'Phone call', online: 'Online meeting' } as const;
/** Where a visit is. */
export const FLOOR = 'Full Circle, Gisr El Suez, Cairo';

const icsTime = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (t: string) => t.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
/** Lines over 75 characters go on, after a space, on the next line (RFC 5545). */
const fold = (line: string) => line.match(/.{1,73}/g)!.join('\r\n ');

/**
 * The calendar file sent with the booking's emails (Gmail, Outlook and Apple Mail show "Add to calendar"). PUBLISH:
 * a meeting to add, with no replies to send back.
 */
export function inviteFile(b: { id: number; kind: BookingKind; start: string; end: string; title: string; description: string; location?: string; url?: string }, now = new Date()) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Full Circle//Book a call//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:booking-${b.id}@fullcircle-co.com`, `DTSTAMP:${icsTime(now.toISOString())}`,
    `DTSTART:${icsTime(b.start)}`, `DTEND:${icsTime(b.end)}`, `SUMMARY:${icsText(b.title)}`, `DESCRIPTION:${icsText(b.description)}`,
    ...(b.location ? [`LOCATION:${icsText(b.location)}`] : []), ...(b.url ? [`URL:${b.url}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'TRIGGER:-PT30M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n';
}
