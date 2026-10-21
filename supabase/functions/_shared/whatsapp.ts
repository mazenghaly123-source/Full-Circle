// WhatsApp through Meta's Cloud API, from the system number (docs/whatsapp.md): the template
// messages the functions send (sign-in codes, request receipts, invitations, order updates), a plain
// reply in the 24 hours after someone writes to the number, and the checks on what Meta and Supabase
// Auth post to the functions. Nothing goes out until WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are set;
// until then every message is logged as skipped, as email is without its key.
//
// The checks and the message shapes take what they need as arguments, so tests/unit/whatsapp.spec.ts
// runs them without Deno.
import { STAGE_NAMES, type OrderEvent, type OrderMail } from './emails.ts';

// (the site's type check reads this file for the unit tests, and knows no Deno)
const env = (k: string) => (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k)?.trim() || undefined;

/** What happened to a message: as the notifications tables record it. */
export type Sent = { status: 'sent' | 'failed' | 'skipped'; providerId?: string; detail?: string };

/**
 * The templates, as they are submitted to Meta for approval (docs/whatsapp.md has the same words).
 * The body's {{n}} are filled in order; a template with `link` has a button to that page of the site.
 * The sign-in code uses Meta's own wording for codes, with a button that copies it.
 */
export const TEMPLATES = {
  code: { name: 'fc_sign_in_code', category: 'AUTHENTICATION', body: '{{1}} is your verification code. For your security, do not share this code. This code expires in 10 minutes.', button: 'Copy code' },
  request_received: { name: 'fc_request_received', category: 'UTILITY', body: 'Full Circle here. We have your sample request {{1}}. We will message you on this number to book the first call. Keep the code: it stays with your order.' },
  portal_invite: { name: 'fc_portal_invite', category: 'UTILITY', body: 'Hello {{1}}. {{2}} at Full Circle added you to {{3}}. You can now follow its orders, approve samples and see photos of each stage. Sign in with this number or your email.', link: '/track', button: 'Open the portal' },
  decision_opened: { name: 'fc_decision_waiting', category: 'UTILITY', body: 'Full Circle: your answer is needed on {{1}} ({{2}}): {{3}}. Open the order to approve it or ask for changes.', link: '/track', button: 'Open the order' },
  stage_moved: { name: 'fc_stage_moved', category: 'UTILITY', body: 'Full Circle: {{1}} ({{2}}) is now at {{3}}. You can follow each stage on your order page.', link: '/track', button: 'Follow it' },
  photo_added: { name: 'fc_new_photos', category: 'UTILITY', body: 'Full Circle: {{1}} of {{2}} ({{3}}) on your order page. You can ask for a photo of any stage there too.', link: '/track', button: 'See them' },
} as const;
export type TemplateKey = keyof typeof TEMPLATES;

/** The language the templates are approved in. */
const LANG = 'en';

/** A template's value: Meta turns away new lines, tabs, runs of spaces and empty values. */
const param = (s: string) => ({ type: 'text', text: s.replace(/\s+/g, ' ').trim().slice(0, 900) || '—' });

/** A template message with its body filled in. */
export function template(key: Exclude<TemplateKey, 'code'>, values: string[]) {
  return { type: 'template', template: { name: TEMPLATES[key].name, language: { code: LANG }, components: [{ type: 'body', parameters: values.map(param) }] } };
}

/** The sign-in code: the code fills the body and the button that copies it. */
export function codeMessage(code: string) {
  return {
    type: 'template',
    template: {
      name: TEMPLATES.code.name, language: { code: LANG },
      components: [{ type: 'body', parameters: [param(code)] }, { type: 'button', sub_type: 'url', index: '0', parameters: [param(code)] }],
    },
  };
}

/** A plain message: only inside the 24 hours after the person wrote to the number. */
export const textMessage = (body: string) => ({ type: 'text', text: { preview_url: false, body } });

const stageName = (n: number) => `${String(n).padStart(2, '0')} ${STAGE_NAMES[Math.min(Math.max(n, 1), 8) - 1]}`;

/** The template for an event on an order the client's people hear of; null for the ones only staff hear of. */
export function orderMessage(event: OrderEvent, o: OrderMail, count = 1) {
  switch (event) {
    case 'decision_opened': return template('decision_opened', [o.name, o.code, o.decision ?? 'a decision']);
    case 'stage_moved': return template('stage_moved', [o.name, o.code, stageName(o.stage)]);
    case 'photo_added': return template('photo_added', [count > 1 ? `There are ${count} new photos` : 'There is a new photo', o.name, o.code]);
    default: return null;
  }
}

type Message = ReturnType<typeof template> | ReturnType<typeof codeMessage> | ReturnType<typeof textMessage>;

/** Sends one message to a number in international form (+20…). */
export async function sendWhatsApp(to: string, message: Message): Promise<Sent> {
  const token = env('WHATSAPP_TOKEN'), phone = env('WHATSAPP_PHONE_ID');
  if (!token || !phone) return { status: 'skipped', detail: 'WhatsApp is not set up yet (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID)' };
  try {
    const res = await fetch(`${(env('WHATSAPP_API_URL') ?? 'https://graph.facebook.com/v23.0').replace(/\/$/, '')}/${phone}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace(/^\+/, ''), ...message }),
    });
    const out = await res.json().catch(() => ({}));
    const id = out.messages?.[0]?.id;
    return res.ok && id ? { status: 'sent', providerId: id } : { status: 'failed', detail: `${res.status} ${out.error?.message ?? ''}`.trim() };
  } catch (err) {
    return { status: 'failed', detail: String(err) };
  }
}

// Checks -------------------------------------------------------------------------------------------------

const bytes = (s: string) => new TextEncoder().encode(s);
const hmac = async (key: BufferSource, data: string) =>
  new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), bytes(data)));
/** Compares two strings in a time that does not depend on where they differ. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Meta signs each webhook call with the app secret: X-Hub-Signature-256 is sha256= and the hex HMAC of the body. */
export async function fromMeta(body: string, header: string | null, appSecret: string) {
  if (!header?.startsWith('sha256=') || !appSecret) return false;
  const hex = [...await hmac(bytes(appSecret), body)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return same(header.slice(7).toLowerCase(), hex);
}

/**
 * Supabase Auth signs each hook call the Standard Webhooks way: webhook-signature holds one or more
 * "v1,<base64 HMAC of id.timestamp.body>", keyed with the secret given as "v1,whsec_<base64>". A call
 * older or newer than five minutes is turned away, so one cannot be replayed later.
 */
export async function fromAuth(body: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get('webhook-id'), ts = headers.get('webhook-timestamp'), sigs = headers.get('webhook-signature');
  const key = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
  if (!id || !ts || !sigs || !key || !/^\d+$/.test(ts) || Math.abs(now / 1000 - Number(ts)) > 300) return false;
  let raw: BufferSource;
  try { raw = Uint8Array.from(atob(key), (c) => c.charCodeAt(0)); } catch { return false; }
  const want = btoa(String.fromCharCode(...await hmac(raw, `${id}.${ts}.${body}`)));
  return sigs.split(/[\s,]+/).filter((s, i, all) => all[i - 1] === 'v1').some((s) => same(s, want));
}

// What Meta posts --------------------------------------------------------------------------------------------

/** A message someone sent to the number. */
export type Inbound = { wamid: string; from: string; name: string | null; at: Date; text: string };
/** What happened to a message the number sent. */
export type Status = { wamid: string; status: 'sent' | 'delivered' | 'read' | 'failed'; at: Date; error?: string };

/** The messages and the statuses in one webhook call (Meta batches them). Anything else is left out. */
export function readWebhook(payload: unknown): { inbound: Inbound[]; statuses: Status[] } {
  const inbound: Inbound[] = [], statuses: Status[] = [];
  const entries = (payload as { object?: string; entry?: unknown[] })?.object === 'whatsapp_business_account' ? (payload as { entry: unknown[] }).entry ?? [] : [];
  for (const entry of entries as { changes?: { field?: string; value?: Record<string, unknown> }[] }[]) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages' || !change.value) continue;
      const v = change.value as { contacts?: { wa_id?: string; profile?: { name?: string } }[]; messages?: Record<string, any>[]; statuses?: Record<string, any>[] };
      for (const m of v.messages ?? []) {
        if (typeof m.id !== 'string' || typeof m.from !== 'string') continue;
        const who = v.contacts?.find((c) => c.wa_id === m.from) ?? v.contacts?.[0];
        inbound.push({ wamid: m.id, from: `+${m.from.replace(/\D/g, '')}`, name: who?.profile?.name?.trim() || null, at: seconds(m.timestamp), text: textOf(m) });
      }
      for (const s of v.statuses ?? []) {
        if (typeof s.id !== 'string' || !['sent', 'delivered', 'read', 'failed'].includes(s.status)) continue;
        const e = s.errors?.[0];
        statuses.push({ wamid: s.id, status: s.status, at: seconds(s.timestamp), ...(e ? { error: [e.code, e.title, e.error_data?.details].filter(Boolean).join(' ') } : {}) });
      }
    }
  }
  return { inbound, statuses };
}

const seconds = (t: unknown) => { const n = Number(t); return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date(); };

/** The words of a message, or what it was when it has none (a photo, a voice note). */
function textOf(m: Record<string, any>): string {
  const caption = (k: string) => m[k]?.caption ? `: ${m[k].caption}` : '';
  switch (m.type) {
    case 'text': return String(m.text?.body ?? '');
    case 'button': return String(m.button?.text ?? '[A button]');
    case 'interactive': return String(m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '[A reply]');
    case 'image': return `[A photo${caption('image')}]`;
    case 'video': return `[A video${caption('video')}]`;
    case 'document': return `[A file${m.document?.filename ? ` (${m.document.filename})` : ''}${caption('document')}]`;
    case 'audio': return '[A voice note]';
    case 'sticker': return '[A sticker]';
    case 'location': return '[A location]';
    case 'contacts': return '[A contact card]';
    case 'reaction': return `[A reaction${m.reaction?.emoji ? `: ${m.reaction.emoji}` : ''}]`;
    default: return `[A ${String(m.type ?? 'message')}]`;
  }
}

/** A reply that asks for the updates to stop (English and Arabic). */
export const asksToStop = (text: string) => /^\s*(stop|unsubscribe|cancel|إيقاف|ايقاف|توقف|الغاء|إلغاء)\s*[.!]*\s*$/i.test(text);
