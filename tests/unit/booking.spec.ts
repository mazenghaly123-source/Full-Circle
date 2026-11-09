// Booking a call (supabase/functions/_shared/booking.ts): the free times worked out from the calendar's
// booked times, Cairo time all year, the checks on a booking, its emails and its calendar invite.
import { expect, test } from '@playwright/test';
import { BOOK_ERRORS, checkBooking, dayShort, endOf, freeDays, inviteFile, isFree, timeShort, whenShort, whenText, zoned } from '../../supabase/functions/_shared/booking';
import { clientBookingEmail, staffBookingEmail } from '../../supabase/functions/_shared/emails';

const cairo = (s: string) => new Date(`${s}+02:00`);
const at = (iso: string) => new Date(iso).toISOString();

test('a Cairo wall-clock time is the right moment, in winter and in summer time', () => {
  expect(zoned(2026, 11, 10, 9 * 60).toISOString()).toBe('2026-11-10T07:00:00.000Z');
  expect(zoned(2026, 7, 14, 9 * 60).toISOString()).toBe('2026-07-14T06:00:00.000Z');
});

test('free times: Sunday to Thursday, 9:00 to 17:00, on the half hour, from 3 hours ahead to 3 weeks', () => {
  const now = cairo('2026-11-08T08:00:00'); // a Sunday, 8:00 in Cairo
  const days = freeDays(now, []);
  // today starts 3 hours on, at 11:00; the last meeting starts at 16:30
  expect(days[0].date).toBe('2026-11-08');
  expect(days[0].slots[0]).toBe(at('2026-11-08T09:00:00Z'));
  expect(days[0].slots.at(-1)).toBe(at('2026-11-08T14:30:00Z'));
  // a full day has 16 times; Friday and Saturday have none
  expect(days[1]).toEqual({ date: '2026-11-09', slots: Array.from({ length: 16 }, (_, i) => new Date(Date.UTC(2026, 10, 9, 7, i * 30)).toISOString()) });
  expect(days.map((d) => d.date)).not.toContain('2026-11-13');
  expect(days.map((d) => d.date)).not.toContain('2026-11-14');
  expect(days.at(-1)!.date).toBe('2026-11-29'); // 21 days on, a Sunday
});

test('anything in the calendar closes its time, with 15 minutes either side', () => {
  const now = cairo('2026-11-08T08:00:00');
  const busy = [{ start: cairo('2026-11-09T10:00:00'), end: cairo('2026-11-09T10:30:00') }];
  const monday = freeDays(now, busy).find((d) => d.date === '2026-11-09')!.slots.map((s) => new Date(s).getUTCHours() * 60 + new Date(s).getUTCMinutes() + 120);
  expect(monday).toContain(9 * 60);
  for (const gone of [9 * 60 + 30, 10 * 60, 10 * 60 + 30]) expect(monday).not.toContain(gone);
  expect(monday).toContain(11 * 60);
  // a whole day away closes the day
  const away = [{ start: cairo('2026-11-10T00:00:00'), end: cairo('2026-11-11T00:00:00') }];
  expect(freeDays(now, away).map((d) => d.date)).not.toContain('2026-11-10');
});

test('a time is bookable only on the grid, in the hours, ahead and free', () => {
  const now = cairo('2026-11-08T08:00:00');
  expect(isFree(at('2026-11-09T08:00:00Z'), now, [])).toBe(true);
  expect(isFree(at('2026-11-09T08:10:00Z'), now, [])).toBe(false);
  expect(isFree(at('2026-11-09T15:00:00Z'), now, [])).toBe(false); // 17:00
  expect(isFree(at('2026-11-08T08:00:00Z'), now, [])).toBe(false); // in two hours
  expect(isFree(at('2026-11-13T08:00:00Z'), now, [])).toBe(false); // a Friday
  expect(isFree(at('2026-11-09T08:00:00Z'), now, [{ start: cairo('2026-11-09T10:00:00'), end: cairo('2026-11-09T11:00:00') }])).toBe(false);
  expect(endOf(at('2026-11-09T08:00:00Z'))).toBe(at('2026-11-09T08:30:00Z'));
});

test('the time in words is Cairo time', () => {
  expect(whenText(at('2026-11-16T08:30:00Z'))).toBe('Monday 16 November, 10:30');
  expect(whenShort(at('2026-11-16T08:30:00Z'))).toBe('Mon 16 Nov, 10:30');
  expect(whenShort(at('2026-07-14T06:00:00Z'))).toBe('Tue 14 Jul, 09:00');
  expect(dayShort('2026-11-16')).toBe('Mon 16 Nov');
  expect(timeShort(at('2026-11-16T07:00:00Z'))).toBe('09:00');
});

test('a booking needs a time, a name, a number, an email and the brand', () => {
  const ok = { kind: 'online', start: '2026-11-16T08:30:00.000Z', name: ' Sara ', phone: '0101 143 5406', email: ' Sara@Kind.Studio ', brand: 'Kind', note: '', notice: 'v', source: {}, turnstile: 't' };
  const c = checkBooking(ok);
  expect(c.ok && c.value).toMatchObject({ kind: 'online', name: 'Sara', email: 'sara@kind.studio', whatsapp: '+201011435406', phone: '0101 143 5406' });
  expect(checkBooking({ ...ok, kind: 'lunch' })).toMatchObject({ ok: false, field: 'slot', error: BOOK_ERRORS.slot });
  expect(checkBooking({ ...ok, start: 'soon' })).toMatchObject({ ok: false, field: 'slot' });
  expect(checkBooking({ ...ok, name: ' ' })).toMatchObject({ ok: false, field: 'name' });
  expect(checkBooking({ ...ok, phone: 'call me' })).toMatchObject({ ok: false, field: 'phone' });
  expect(checkBooking({ ...ok, email: 'sara@kind' })).toMatchObject({ ok: false, field: 'email', error: BOOK_ERRORS.email });
  expect(checkBooking({ ...ok, brand: '' })).toMatchObject({ ok: false, field: 'brand' });
  // a number from outside Egypt without its country code is kept as typed, for staff to check
  const abroad = checkBooking({ ...ok, phone: '050 123 4567' });
  expect(abroad.ok && abroad.value.whatsapp).toBeNull();
});

test('staff are told what was booked, with the Meet link for an online meeting', () => {
  const m = staffBookingEmail({ kind: 'online', when: 'Monday 16 November, 10:30', name: 'Sara', brand: 'Kind', phone: '0101 143 5406', whatsapp: '+201011435406', email: 'sara@kind.studio', note: 'Jeans line', meet: 'https://meet.google.com/abc-defg-hij', at: new Date(), source: {} });
  expect(m.subject).toBe('Online meeting booked: Kind, Monday 16 November, 10:30');
  for (const s of ['https://wa.me/201011435406', 'sara@kind.studio', 'https://meet.google.com/abc-defg-hij', 'Jeans line', '30 minutes']) expect(m.text).toContain(s);
  expect(m.html).toContain('https://meet.google.com/abc-defg-hij');
});

test('the client is told when, how and how to change it; a call without a link says it comes on WhatsApp', () => {
  const m = clientBookingEmail({ kind: 'online', when: 'Monday 16 November, 10:30', name: 'Sara', phone: '0101 143 5406', whatsapp: '+201011435406', meet: null });
  expect(m.subject).toBe('Booked: online meeting with Full Circle, Monday 16 November, 10:30');
  for (const s of ['Hello Sara', 'Monday 16 November, 10:30, Cairo time', 'We send it on WhatsApp before the call', 'https://wa.me/201011435406']) expect(m.text).toContain(s);
  expect(clientBookingEmail({ kind: 'phone', when: 'x', name: 'Sara', phone: '050 123 4567', whatsapp: null, meet: null }).text).toContain('We call you on: 050 123 4567');
  expect(clientBookingEmail({ kind: 'visit', when: 'x', name: 'Sara', phone: 'p', whatsapp: null, meet: null }).text).toContain('Where: Full Circle, Gisr El Suez, Cairo');
});

test('the calendar invite: the time in UTC, the text escaped, long lines folded', () => {
  const f = inviteFile({ id: 12, kind: 'visit', start: '2026-11-16T08:30:00.000Z', end: '2026-11-16T09:00:00.000Z', title: 'Visit at the floor with Full Circle', description: 'Line one, with a comma; and more\nLine two '.repeat(3), location: 'Full Circle, Gisr El Suez, Cairo' }, new Date('2026-11-09T10:00:00Z'));
  const lines = f.split('\r\n');
  expect(lines).toContain('UID:booking-12@fullcircle-co.com');
  expect(lines).toContain('DTSTART:20261116T083000Z');
  expect(lines).toContain('DTEND:20261116T090000Z');
  expect(lines).toContain('LOCATION:Full Circle\\, Gisr El Suez\\, Cairo');
  expect(lines).toContain('METHOD:PUBLISH');
  expect(f.endsWith('END:VCALENDAR\r\n')).toBe(true);
  for (const l of lines) expect(l.length).toBeLessThanOrEqual(75);
  // a folded line goes on after a space, and reads back whole
  expect(f.replace(/\r\n /g, '')).toContain('DESCRIPTION:Line one\\, with a comma\\; and more\\nLine two Line one');
});
