// The request and contact forms' rules, in one place for both sides: the site (src/) checks a form
// with them before sending it, and the Edge Functions that receive it check it again. Plain
// TypeScript with no imports, so Vite and Deno both load it as it is.

/** Sample request picks, in the order the form asks for them. The brand stage and the product are required. */
export const REQUEST_QUESTIONS = [
  { k: 'path', label: '01 / The brand is', hint: 'Pick one', summary: 'Brand', options: ['Starting', 'Scaling'] },
  { k: 'product', label: '02 / Product', hint: 'Pick one', summary: 'Product', options: ['Denim', 'Tees', 'Hoodies', 'Shirts', 'Jackets', 'Knitwear', 'Other'] },
  { k: 'qty', label: '03 / Pieces per style', hint: 'Estimate', summary: 'Pieces per style', options: ['60–150', '150–500', '500+'] },
  { k: 'have', label: '04 / You have', hint: 'Pick one', summary: 'You have', options: ['An idea', 'A sketch', 'A tech pack', 'A garment'] },
] as const;

export type RequestKey = (typeof REQUEST_QUESTIONS)[number]['k'];

/**
 * Question 05 (Mazen, 8 Nov 2026): the rest of the circle, optional and any number of them. Branding is the
 * Design arc's brand identity; the photos and the ads are the Launch arc's. By request, no prices.
 */
export const REQUEST_ALSO = { label: '05 / Also want', hint: 'Optional, pick any', summary: 'Also', options: ['Branding', 'Product photos', 'Ad creatives'] } as const;
export type AlsoOption = (typeof REQUEST_ALSO.options)[number];

/** Keeps the known extras, once each, in the form's order. */
export const cleanAlso = (raw: unknown): AlsoOption[] =>
  Array.isArray(raw) ? REQUEST_ALSO.options.filter((o) => raw.includes(o)) : [];

/**
 * Two quick questions on the screen after a request is sent (Mazen, 8 Nov 2026), so the form itself stays short.
 * Optional: one tap each, sent on their own with the request's code and the follow-up key it was given.
 */
export const FOLLOW_UP = [
  { k: 'heard', label: 'How did you hear about us?', options: ['Instagram', 'TikTok', 'Facebook', 'A friend', 'Google', 'Other'] },
  { k: 'sells', label: 'Where do you sell?', options: ['Egypt', 'Gulf', 'Turkey', 'China', 'Elsewhere', 'Not yet'] },
] as const;
export type FollowUpKey = (typeof FOLLOW_UP)[number]['k'];

/** The options of one question, e.g. OptionOf<'qty'>. */
export type OptionOf<K extends RequestKey> = Extract<(typeof REQUEST_QUESTIONS)[number], { k: K }>['options'][number];

/**
 * The quantity is under the product's minimum: under 150 per colour for denim. The form offers nothing under 60
 * (Mazen, 27 Oct 2026); for denim at 60–150 it shows a quiet note, and the staff alert notes it.
 */
export const belowMinimum = (qty: string | null, product: string | null) =>
  qty === ('60–150' satisfies OptionOf<'qty'>) && product === ('Denim' satisfies OptionOf<'product'>);

/** A pick counts only if it is one of that question's own options. */
export const isOption = (k: RequestKey, v: unknown): v is string =>
  typeof v === 'string' && (REQUEST_QUESTIONS.find((q) => q.k === k)!.options as readonly string[]).includes(v);

/** Longest text each field takes. */
export const LIMITS = { brand: 200, name: 200, contact: 200, note: 4000, message: 4000 } as const;

/** How someone can be reached: an email, or a WhatsApp number (null when its country cannot be told). */
export type Contact = { channel: 'email'; email: string } | { channel: 'whatsapp'; whatsapp: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Reads what was typed into "Email or WhatsApp". Null when it is neither. */
export function readContact(typed: string): Contact | null {
  const s = typed.trim();
  if (s.length > LIMITS.contact) return null;
  if (s.includes('@')) return EMAIL.test(s) ? { channel: 'email', email: s.toLowerCase() } : null;
  const digits = s.replace(/\D/g, '');
  if (!/^\+?[\d\s().\-/]+$/.test(s) || digits.length < 7 || digits.length > 15) return null;
  return { channel: 'whatsapp', whatsapp: toInternational(s) };
}

/**
 * A phone number in international form (+201011435406), or null when its country cannot be told.
 * Numbers are typed every which way: "+20 101 143 5406", "00201011435406", "+20 (0)10…" and, in
 * Egypt, "0101 143 5406". Only Egyptian mobiles are read without a country code; a local number
 * from anywhere else is left for staff to ask about. The sign-in (phase 3) uses this too.
 */
export function toInternational(typed: string): string | null {
  let s = typed.trim().replace(/\(0\)/g, '').replace(/[\s().\-/]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  const egypt = s.match(/^(?:\+?20)?0?(1[0125]\d{8})$/);
  if (egypt && (s.startsWith('+') || s.startsWith('20') || s.startsWith('01'))) return '+20' + egypt[1];
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

/**
 * The words shown with the forms (docs/production-plan.md §7). Their version is stored with each
 * request and message, and the opt-in's exact wording with each consent record, so change the
 * version whenever the words change.
 */
export const NOTICE = {
  version: '2026-10-15',
  request: 'We use these details to reply to your request. They are stored mainly in Frankfurt, Germany; some of our providers in the US and elsewhere also process them.',
  contact: 'We use these details to reply to your message. They are stored mainly in Frankfurt, Germany; some of our providers in the US and elsewhere also process them.',
  whatsappReply: 'We’ll reply on WhatsApp.',
  whatsappUpdates: 'Also send me updates on my order from Full Circle on WhatsApp. I can stop them at any time.',
} as const;

/** Where a visitor came from, taken on the first page they open and sent with a request or message. */
export type Source = Partial<Record<(typeof SOURCE_KEYS)[number], string>>;
export const SOURCE_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer', 'landing'] as const;

/** Keeps the known keys of a source, as short strings. */
export function cleanSource(raw: unknown): Source {
  const out: Source = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of SOURCE_KEYS) { const v = (raw as Record<string, unknown>)[k]; if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 300); }
  return out;
}

/** What the request form sends. Files are not taken: they come later, on WhatsApp. */
export type RequestData = {
  path: string; product: string; qty: string | null; have: string | null;
  /** question 05: what else the brand wants (absent from forms sent before it existed) */
  also?: string[];
  brand: string; contact: string; note: string;
  /** the opt-in box under a WhatsApp number (absent when it was not shown) */
  whatsappUpdates?: boolean;
  notice: string; source: Source; turnstile: string;
};

/** What the contact form sends. */
export type MessageData = { name: string; contact: string; text: string; notice: string; source: Source; turnstile: string };

/** A form the server turned away: the message for the error line, and the field it is about. */
export type Problem = { error: string; field?: string };

/** The error lines, the same on both sides. */
export const ERRORS = {
  picks: 'Pick the brand stage and a product',
  brand: 'Add the brand name',
  contact: 'Add an email or WhatsApp number',
  message: 'Fill in your name, contact and message',
  robot: 'We could not check that you are not a robot. Try again',
  failed: 'Could not send. Check your connection and try again, or message us on WhatsApp',
  tooMany: 'We already have several requests from this contact. Message us on WhatsApp instead',
} as const;

type Checked<T> = { ok: true; value: T } | ({ ok: false } & Problem);

/** Checks a request's fields. */
export function checkRequest(d: Partial<RequestData>): Checked<RequestData & { reach: Contact }> {
  if (!isOption('path', d.path) || !isOption('product', d.product)) return { ok: false, error: ERRORS.picks, field: 'picks' };
  if (d.qty != null && !isOption('qty', d.qty)) return { ok: false, error: ERRORS.picks, field: 'picks' };
  if (d.have != null && !isOption('have', d.have)) return { ok: false, error: ERRORS.picks, field: 'picks' };
  const brand = typeof d.brand === 'string' ? d.brand.trim() : '';
  if (!brand || brand.length > LIMITS.brand) return { ok: false, error: ERRORS.brand, field: 'brand' };
  const reach = typeof d.contact === 'string' ? readContact(d.contact) : null;
  if (!reach) return { ok: false, error: ERRORS.contact, field: 'contact' };
  const note = typeof d.note === 'string' ? d.note.trim().slice(0, LIMITS.note) : '';
  return {
    ok: true,
    value: {
      path: d.path, product: d.product, qty: d.qty ?? null, have: d.have ?? null, also: cleanAlso(d.also), brand, contact: d.contact!.trim(), note, reach,
      whatsappUpdates: reach.channel === 'whatsapp' && typeof d.whatsappUpdates === 'boolean' ? d.whatsappUpdates : undefined,
      notice: String(d.notice ?? ''), source: cleanSource(d.source), turnstile: String(d.turnstile ?? ''),
    },
  };
}

/** The answers to the questions after sending, with what proves the sender: the code and its key. */
export type FollowUpData = { code: string; key: string } & Partial<Record<FollowUpKey, string>>;

/** Checks the answers after sending. At least one answer, each one of its question's options. */
export function checkFollowUp(d: Partial<FollowUpData>): Checked<FollowUpData> {
  const code = typeof d.code === 'string' ? d.code.trim() : '', key = typeof d.key === 'string' ? d.key.trim() : '';
  if (!/^FC-\d{4,}$/.test(code) || !/^[0-9a-f-]{36}$/.test(key)) return { ok: false, error: ERRORS.failed };
  const value: FollowUpData = { code, key };
  for (const q of FOLLOW_UP) {
    const v = d[q.k];
    if (v == null) continue;
    if (!(q.options as readonly string[]).includes(v)) return { ok: false, error: ERRORS.failed };
    value[q.k] = v;
  }
  if (!FOLLOW_UP.some((q) => value[q.k])) return { ok: false, error: ERRORS.failed };
  return { ok: true, value };
}

/** Checks a contact message. */
export function checkMessage(d: Partial<MessageData>): Checked<MessageData & { reach: Contact }> {
  const name = typeof d.name === 'string' ? d.name.trim() : '';
  const text = typeof d.text === 'string' ? d.text.trim() : '';
  const reach = typeof d.contact === 'string' ? readContact(d.contact) : null;
  if (!name || name.length > LIMITS.name || !reach || !text || text.length > LIMITS.message) return { ok: false, error: ERRORS.message };
  return { ok: true, value: { name, contact: d.contact!.trim(), text, reach, notice: String(d.notice ?? ''), source: cleanSource(d.source), turnstile: String(d.turnstile ?? '') } };
}
