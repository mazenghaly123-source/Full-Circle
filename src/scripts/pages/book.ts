// Book a call: the page books on the spot (supabase/functions/book-call; the site keeps its own calendar). It
// asks the function for the free times; once they come, the three kinds become a choice, then the day, the time
// and the details, and "Book it" sends them. The client and staff get the invite by email. If the function cannot
// be reached, the page stays as its markup has it: each kind opens WhatsApp with the request ready.
import type { Feature } from '../core/lifecycle';
import { $, byId, focusHeading, markInvalid, rm, toast, vib } from '../core/util';
import { book } from '../core/state';
import { source } from '../core/source';
import { track } from '../shell/analytics';
import { isProblem, submit } from '../core/send';
import { BACKEND } from '../../data/backend';
import { BOOKING, whatsappLink } from '../../data/site';
import { BOOKING_NOTICE, BOOK_ERRORS, checkBooking, dayShort as dayLabel, timeShort as timeLabel, type BookingData, type Day } from '../../../supabase/functions/_shared/booking';

const SEND = 'Book it', SENDING = 'Booking…';
/** The free times are fetched again when the page comes back after this long. */
const FRESH_MS = 3 * 60_000;
/** What an error line can be about. */
const CHECKED = ['bookKinds', 'bkTimes', 'bName', 'bPhone', 'bEmail', 'bBrand'] as const;
const FIELD: Record<string, string> = { slot: 'bkTimes', name: 'bName', phone: 'bPhone', email: 'bEmail', brand: 'bBrand' };
const FIELDS = [['bName', 'name'], ['bPhone', 'phone'], ['bEmail', 'email'], ['bBrand', 'brand'], ['bNote', 'note']] as const;

const kindName = (k: string) => BOOKING.find((b) => b.kind === k)?.n ?? '';
const dayOf = (date: string): Day | undefined => book.days.find((d) => d.date === date);

/** Asks the function for the free times. False when the calendar cannot be used. */
async function fetchDays(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND.functions}/book-call`, { method: 'POST', body: JSON.stringify({ slots: true }) });
    const out = await res.json();
    if (!res.ok || out.calendar !== true || !Array.isArray(out.days) || !out.days.length) return false;
    book.days = out.days; book.fetched = Date.now();
    // a picked time that has gone since is dropped
    if (book.day && !dayOf(book.day)) book.day = '';
    if (book.start && !book.days.some((d) => d.slots.includes(book.start))) book.start = '';
    return true;
  } catch {
    return false;
  }
}

function opt(doc: Document, label: string, value: string, on: boolean) {
  const b = doc.createElement('button');
  b.type = 'button'; b.className = 'opt'; b.dataset.v = value; b.textContent = label; b.setAttribute('aria-pressed', String(on));
  return b;
}

/** Days, times and the summary rows, from the state. */
function renderPicks(doc: Document) {
  const g = byId(doc);
  if (!book.day && book.days.length) book.day = book.days[0].date;
  g('bkDays').replaceChildren(...book.days.map((d) => opt(doc, dayLabel(d.date), d.date, d.date === book.day)));
  g('bkTimes').replaceChildren(...(dayOf(book.day)?.slots ?? []).map((s) => opt(doc, timeLabel(s), s, s === book.start)));
  doc.querySelectorAll<HTMLElement>('#bookKinds [data-kind]').forEach((c) => {
    const on = c.dataset.kind === book.kind;
    c.classList.toggle('on', on); c.querySelector('.cal-go')!.setAttribute('aria-pressed', String(on));
  });
  const k = g('bkKind'), w = g('bkWhen');
  k.textContent = kindName(book.kind) || '—'; k.className = book.kind ? '' : 'empty';
  w.textContent = book.start ? `${dayLabel(book.day)}, ${timeLabel(book.start)}` : '—'; w.className = book.start ? '' : 'empty';
}

/** The calendar is on: the page books itself. */
function showCalendar(doc: Document) {
  const g = byId(doc);
  g('book').dataset.cal = 'on';
  g('bookCal').hidden = false;
  g('bookHow').textContent = 'Pick a time: it is booked on the spot, and the invite comes by email.';
  renderPicks(doc);
}

function showSending(doc: Document) {
  const b = doc.getElementById('bSend')!;
  b.textContent = book.sending ? SENDING : SEND; b.setAttribute('aria-disabled', String(book.sending));
}

function showSent(doc: Document) {
  const g = byId(doc);
  const where = book.kind === 'visit' ? 'See you at the floor in Gisr El Suez.' : book.kind === 'phone' ? `We call you on ${book.phone.trim()}.` : book.meet ? 'The video link is in the invite.' : 'We send the video link on WhatsApp before the call.';
  g('bSentLine').textContent = `${book.when}, Cairo time. The invite is on its way to ${book.email.trim().toLowerCase()}. ${where}`;
  (g('bSentWa') as HTMLAnchorElement).href = whatsappLink(`Hi Full Circle, I just booked ${kindName(book.kind).toLowerCase()} for ${book.when} (${book.brand.trim()}).`);
  g('bkBox').classList.add('is-sent');
  g('bookKinds').inert = true; doc.querySelector<HTMLElement>('.bk-pick')!.inert = true;
}

function restore(doc: Document) {
  if (!doc.getElementById('bookCal')) return;
  for (const [id, k] of FIELDS) (doc.getElementById(id) as HTMLInputElement).value = book[k];
  doc.getElementById('bErr')!.textContent = book.err; markInvalid(doc, CHECKED, book.bad, 'bErr');
  showSending(doc);
  if (book.calendar) showCalendar(doc);
  if (book.sent) showSent(doc);
}

/** The booking as the function takes it. */
const payload = (turnstile: string): string => JSON.stringify({
  kind: book.kind, start: book.start, name: book.name, phone: book.phone, email: book.email, brand: book.brand, note: book.note,
  notice: BOOKING_NOTICE.version, source, turnstile,
} satisfies BookingData);

export const bookFeature: Feature = {
  prepare: restore,
  mount(signal) {
    if (!document.getElementById('bookCal')) return;
    restore(document);
    if (!book.sent && (book.calendar === null || Date.now() - book.fetched > FRESH_MS)) {
      if (book.calendar === null) $('bookHow').textContent = 'Checking the calendar…';
      fetchDays().then((ok) => {
        book.calendar = ok;
        if (signal.aborted) return;
        if (ok) showCalendar(document);
        else { $('bookHow').textContent = 'You pick the time with us on WhatsApp.'; $('book').dataset.cal = 'off'; $('bookCal').hidden = true; }
      });
    }

    $('bookKinds').addEventListener('click', (e) => {
      // once the calendar is on, the whole card picks its kind
      const c = (e.target as Element).closest<HTMLElement>('[data-kind]');
      if (!c || !book.calendar || book.sent) return;
      vib(); book.kind = c.dataset.kind!; renderPicks(document);
    }, { signal });
    $('bkDays').addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('.opt');
      if (!b || book.sent) return;
      vib(); book.day = b.dataset.v!; if (!dayOf(book.day)?.slots.includes(book.start)) book.start = ''; renderPicks(document);
    }, { signal });
    $('bkTimes').addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('.opt');
      if (!b || book.sent) return;
      vib(); book.start = b.dataset.v!; renderPicks(document);
    }, { signal });
    for (const [id, k] of FIELDS) $(id).addEventListener('input', (e) => { book[k] = (e.target as HTMLInputElement).value; }, { signal });

    const fail = (msg: string, bad: string[]) => {
      book.err = msg; book.bad = bad; $('bErr').textContent = msg; markInvalid(document, CHECKED, bad, 'bErr');
      const first = bad[0] && $(bad[0]);
      if (!first) return;
      if (first.matches('input, textarea')) { first.focus(); return; }
      (first.querySelector('button') as HTMLElement | null)?.focus({ preventScroll: true });
      // scrolled to only when it is off the screen, so nothing moves under the finger
      const r = first.getBoundingClientRect();
      if (r.top < 80 || r.bottom > innerHeight - 80) first.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'center' });
    };
    $('bSend').addEventListener('click', async () => {
      if (book.sending || book.sent) return;
      vib();
      if (!book.kind) return fail(BOOK_ERRORS.kind, ['bookKinds']);
      if (!book.start) return fail(BOOK_ERRORS.slot, ['bkTimes']);
      const checked = checkBooking(JSON.parse(payload('')));
      if (!checked.ok) return fail(checked.error, [FIELD[checked.field]]);
      book.sending = true; book.err = ''; book.bad = []; $('bErr').textContent = ''; markInvalid(document, CHECKED, [], 'bErr'); showSending(document);
      const out = await submit<{ ok: true; when: string; meet: string | null }>('book-call', $('bTs'), payload);
      book.sending = false;
      const here = !!document.getElementById('bookCal');
      if (here) showSending(document);
      if (isProblem(out)) {
        const bad = out.field && FIELD[out.field] ? [FIELD[out.field]] : [];
        // the time was just taken: the free times are fetched again, without it
        if (out.field === 'slot') { book.start = ''; await fetchDays(); if (here) renderPicks(document); }
        if (here) fail(out.error, bad); else { book.err = out.error; book.bad = bad; }
        return;
      }
      book.sent = true; book.when = out.when; book.meet = out.meet;
      track('generate_lead', { form: 'book_call', kind: book.kind });
      toast(`Booked / ${out.when}`);
      if (!here) return;
      showSent(document);
      focusHeading($('bSentH'));
    }, { signal });
  },
};
