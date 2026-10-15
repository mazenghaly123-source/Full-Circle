// The request and contact forms' rules, in one place for both sides: the site (src/) checks a form
// with them before sending it, and the Edge Functions that receive it check it again. Plain
// TypeScript with no imports, so Vite and Deno both load it as it is.

/** Sample request picks, in the order the form asks for them. The brand stage and the product are required. */
export const REQUEST_QUESTIONS = [
  { k: 'path', label: '01 / The brand is', hint: 'Pick one', summary: 'Brand', options: ['Starting', 'Scaling'] },
  { k: 'product', label: '02 / Product', hint: 'Pick one', summary: 'Product', options: ['Denim', 'Tees', 'Hoodies', 'Shirts', 'Jackets', 'Knitwear', 'Other'] },
  { k: 'qty', label: '03 / Pieces per style', hint: 'Estimate', summary: 'Pieces per style', options: ['Under 60', '60–150', '150–500', '500+'] },
  { k: 'have', label: '04 / You have', hint: 'Pick one', summary: 'You have', options: ['An idea', 'A sketch', 'A tech pack', 'A garment'] },
] as const;

export type RequestKey = (typeof REQUEST_QUESTIONS)[number]['k'];
/** The options of one question, e.g. OptionOf<'qty'>. */
export type OptionOf<K extends RequestKey> = Extract<(typeof REQUEST_QUESTIONS)[number], { k: K }>['options'][number];

/** The quantity is under the product's minimum: under 60 for everything, under 150 per colour for denim. */
export const belowMinimum = (qty: string | null, product: string | null) =>
  qty === ('Under 60' satisfies OptionOf<'qty'>) || (qty === ('60–150' satisfies OptionOf<'qty'>) && product === ('Denim' satisfies OptionOf<'product'>));

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
      path: d.path, product: d.product, qty: d.qty ?? null, have: d.have ?? null, brand, contact: d.contact!.trim(), note, reach,
      whatsappUpdates: reach.channel === 'whatsapp' && typeof d.whatsappUpdates === 'boolean' ? d.whatsappUpdates : undefined,
      notice: String(d.notice ?? ''), source: cleanSource(d.source), turnstile: String(d.turnstile ?? ''),
    },
  };
}

/** Checks a contact message. */
export function checkMessage(d: Partial<MessageData>): Checked<MessageData & { reach: Contact }> {
  const name = typeof d.name === 'string' ? d.name.trim() : '';
  const text = typeof d.text === 'string' ? d.text.trim() : '';
  const reach = typeof d.contact === 'string' ? readContact(d.contact) : null;
  if (!name || name.length > LIMITS.name || !reach || !text || text.length > LIMITS.message) return { ok: false, error: ERRORS.message };
  return { ok: true, value: { name, contact: d.contact!.trim(), text, reach, notice: String(d.notice ?? ''), source: cleanSource(d.source), turnstile: String(d.turnstile ?? '') } };
}
