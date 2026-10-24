// The emails the functions send: an alert to staff for each request and message, a receipt to a
// brand that gave an email, the messages about orders (notify) and the invitations to sign in
// (invite). Plain functions of their inputs, so the tests can read them too.
import { REQUEST_QUESTIONS, type Contact, type Source } from './forms.ts';

const SITE = { whatsapp: '+20 101 143 5406', whatsappUrl: 'https://wa.me/201011435406', email: 'fullcircleworks.co@gmail.com' };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** When something arrived, in Cairo time. */
export const cairoTime = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d) + ' (Cairo)';

/** How to reach someone back: a mailto or wa.me link, or the number as typed when its country is unclear. */
export function reachLink(typed: string, reach: Contact): { label: string; href?: string } {
  if (reach.channel === 'email') return { label: reach.email, href: `mailto:${reach.email}` };
  if (reach.whatsapp) return { label: `${reach.whatsapp} on WhatsApp`, href: `https://wa.me/${reach.whatsapp.slice(1)}` };
  return { label: `${typed} (WhatsApp; check the country code)` };
}

type Row = [label: string, value: string, href?: string];

/** The site's look in an email (as the sign-in code email, supabase/templates/sign-in-code.html): dark,
 * the logo, one card. Table layout and inline styles so it holds up in Gmail, Outlook and Apple Mail. */
const LOOK = {
  bg: '#11110F', card: '#1B1B18', line: '#2E2D29', bone: '#E8E2D8', cotton: '#D8D0C3', dim: '#A39C90', faint: '#7E786D', red: '#BC2F29',
  sans: "'Helvetica Neue',Helvetica,Arial,sans-serif", mono: "'IBM Plex Mono',Menlo,Consolas,monospace",
  img: 'https://fullcircle-co.com/email',
};

/**
 * A plain-text and an HTML version of the same rows. A row whose value is its own link (an address to
 * open) shows as a button.
 */
function render(title: string, intro: string, rows: Row[], outro: string[] = []) {
  const text = [title, '', intro, '', ...rows.map(([l, v, h]) => `${l}: ${v}${h && !v.includes(h) ? ` (${h})` : ''}`), ...(outro.length ? ['', ...outro] : []), '', 'Full Circle / Cairo / fullcircle-co.com'].join('\n');
  const L = LOOK;
  const button = (label: string, href: string) =>
    `<tr><td style="padding-top:22px;"><a href="${esc(href)}" style="display:inline-block;background:${L.red};color:#ffffff;font-family:${L.sans};font-size:13px;line-height:16px;font-weight:600;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:14px 22px;border-radius:10px;">${esc(label)}</a></td></tr>`;
  const row = ([l, v, h]: Row) => h && h === v && /^https?:/.test(h)
    ? button(l, h)
    : `<tr><td style="padding:14px 0;border-top:1px solid ${L.line};"><div style="font-family:${L.mono};font-size:11px;line-height:16px;letter-spacing:1.5px;text-transform:uppercase;color:${L.dim};padding-bottom:4px;">${esc(l)}</div><div style="font-family:${L.sans};font-size:15px;line-height:22px;color:${L.bone};">${h ? `<a href="${esc(h)}" style="color:${L.bone};text-decoration:underline;">${esc(v)}</a>` : esc(v).replace(/\n/g, '<br>')}</div></td></tr>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${L.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${L.bg};">${esc(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${L.bg};"><tr><td align="center" style="padding:40px 16px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 28px;"><a href="https://fullcircle-co.com" style="text-decoration:none;"><img src="${L.img}/logo.png" width="180" height="30" alt="Full Circle" style="display:block;border:0;width:180px;height:auto;"></a></td></tr>
<tr><td style="background:${L.card};border:1px solid ${L.line};border-radius:16px;padding:36px 32px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-family:${L.sans};font-size:24px;line-height:29px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:${L.bone};padding-bottom:12px;">${esc(title)}</td></tr>
<tr><td style="font-family:${L.sans};font-size:15px;line-height:23px;color:${L.cotton};padding-bottom:22px;">${esc(intro)}</td></tr>
${rows.map(row).join('\n')}
${outro.map((p) => `<tr><td style="font-family:${L.sans};font-size:13px;line-height:20px;color:${L.dim};padding-top:20px;">${esc(p)}</td></tr>`).join('\n')}
</table></td></tr>
<tr><td style="padding:28px 4px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right:12px;vertical-align:middle;"><img src="${L.img}/mark.png" width="22" height="22" alt="" style="display:block;border:0;width:22px;height:auto;"></td><td style="font-family:${L.sans};font-size:12px;line-height:18px;color:${L.faint};vertical-align:middle;">Full Circle / Cairo / <a href="https://fullcircle-co.com" style="color:${L.dim};text-decoration:none;">fullcircle-co.com</a></td></tr></table></td></tr>
</table></td></tr></table>
</body></html>`;
  return { text, html };
}

const sourceLine = (s: Source) => Object.entries(s).filter(([k]) => k !== 'landing').map(([k, v]) => `${k.replace('utm_', '')}: ${v}`).join(', ');

export type RequestMail = {
  code: string; at: Date; brand: string; picks: Record<string, string | null>; belowMinimum: boolean;
  typed: string; reach: Contact; whatsappUpdates?: boolean; note: string; source: Source;
};

/** The alert staff get for a new request. */
export function staffRequestEmail(r: RequestMail) {
  const reach = reachLink(r.typed, r.reach);
  const rows: Row[] = [
    ['Brand', r.brand],
    ...REQUEST_QUESTIONS.map((q): Row => [q.k === 'path' ? 'The brand is' : q.summary, (r.picks[q.k] ?? '—') + (q.k === 'qty' && r.belowMinimum ? ' (below the minimum)' : '')]),
    ['Contact', reach.label, reach.href],
  ];
  if (r.whatsappUpdates !== undefined) rows.push(['Order updates on WhatsApp', r.whatsappUpdates ? 'Yes, opted in' : 'No']);
  if (r.note) rows.push(['Notes', r.note]);
  const from = sourceLine(r.source);
  if (from) rows.push(['Came from', from]);
  if (r.source.landing) rows.push(['First page', r.source.landing]);
  rows.push(['Received', cairoTime(r.at)]);
  const products = [r.picks.product, r.picks.path].filter(Boolean).join(', ');
  return {
    subject: `${r.code} / New sample request: ${r.brand} (${products})`,
    ...render(`New sample request ${r.code}`, `${r.brand} asked for a sample. Reply on the contact below to book the first call.`, rows),
  };
}

/** The receipt a brand gets when it gave an email. */
export function clientReceiptEmail(r: { code: string; brand: string }) {
  return {
    subject: `Your sample request ${r.code} / Full Circle`,
    ...render('Received.', `Thank you, ${r.brand}. Your request code is ${r.code}. Keep it: it stays with your order.`, [
      ['First call', 'We will message you to book it. We go through the product, the quantity and where you are now.'],
      ['Price range', 'A sample price and a range for bulk, before you commit to anything.'],
      ['Your order code', 'Once you approve, your order opens on the tracking page, at the stage where you enter.'],
    ], [`Questions? Reply to this email, or message us on WhatsApp: ${SITE.whatsapp} (${SITE.whatsappUrl}).`]),
    replyTo: SITE.email,
  };
}

export type MessageMail = { at: Date; name: string; typed: string; reach: Contact; text: string; source: Source; via?: 'contact' | 'whatsapp' };

/** The alert staff get for a contact message, or for a reply to the WhatsApp number. */
export function staffMessageEmail(m: MessageMail) {
  const reach = reachLink(m.typed, m.reach);
  const rows: Row[] = [['From', m.name], ['Contact', reach.label, reach.href], ['Message', m.text]];
  const from = sourceLine(m.source);
  if (from) rows.push(['Came from', from]);
  rows.push(['Received', cairoTime(m.at)]);
  return m.via === 'whatsapp'
    ? { subject: `WhatsApp reply from ${m.name}`, ...render(`WhatsApp from ${m.name}`, `Sent to the number that sends order updates. Answer from the main WhatsApp line (${SITE.whatsapp}); it is in the admin's inbox.`, rows) }
    : { subject: `New message from ${m.name}`, ...render(`Message from ${m.name}`, 'Sent from the contact page.', rows) };
}

/** The eight stages, as the site names them (src/data/site.ts). */
export const STAGE_NAMES = ['Research', 'Design support', 'Sourcing', 'Development', 'Sampling', 'Production', 'QC', 'Delivery'] as const;
const stageName = (n: number) => `${String(n).padStart(2, '0')} ${STAGE_NAMES[Math.min(Math.max(n, 1), 8) - 1]}`;

/** An order as the notify function reads it, with what the messages about it need. */
export type OrderMail = {
  id: number; code: string; name: string; stage: number; brand: string;
  /** the latest decision, and the latest client note or photo request, if any */
  decision?: string; note?: string; photoStage?: number;
};
export type OrderEvent = 'decision_opened' | 'stage_moved' | 'photo_added' | 'decision_approved' | 'changes_asked' | 'photo_asked';

/**
 * The email for one event on an order. The client's people get the first three, with a link to the
 * portal; staff get the last three, with a link to the order in the admin. `count` groups several
 * photos added at once into one email.
 */
export function orderEmail(event: OrderEvent, o: OrderMail, site: string, count = 1) {
  const portal = `${site}/track`, admin = `${site}/admin#/order/${o.id}`;
  const order: Row = ['Order', `${o.code} / ${o.name}`];
  const signIn = 'Sign in with this email address; we send you a 6-digit code.';
  switch (event) {
    case 'decision_opened': return {
      subject: `${o.code} / Your decision: ${o.decision ?? 'waiting for you'}`,
      ...render('A decision is waiting for you.', `${o.brand}, we need your answer on ${o.name} before it moves on.`,
        [order, ['Decision', o.decision ?? '—'], ['Open it', portal, portal]], [signIn]),
    };
    case 'stage_moved': return {
      subject: `${o.code} / ${o.name} is at ${stageName(o.stage)}`,
      ...render(`Now at ${stageName(o.stage)}.`, `${o.brand}, your order moved to its next stage.`,
        [order, ['Stage', stageName(o.stage)], ['Follow it', portal, portal]], [signIn]),
    };
    case 'photo_added': return {
      subject: `${o.code} / ${count > 1 ? `${count} new photos` : 'A new photo'} of ${o.name}`,
      ...render(count > 1 ? `${count} new photos.` : 'A new photo.', `${o.brand}, there ${count > 1 ? 'are new photos' : 'is a new photo'} of ${o.name} on your order page.`,
        [order, ['See them', portal, portal]], [signIn]),
    };
    case 'decision_approved': return {
      subject: `${o.code} / ${o.brand} approved: ${o.decision ?? 'a decision'}`,
      ...render(`${o.brand} approved.`, 'The order waits for you to move it on (approving does not move the stage).',
        [order, ['Approved', o.decision ?? '—'], ['Stage', stageName(o.stage)], ['Open the order', admin, admin]]),
    };
    case 'changes_asked': return {
      subject: `${o.code} / ${o.brand} asked for changes: ${o.decision ?? 'a decision'}`,
      ...render(`${o.brand} asked for changes.`, 'Make the changes, then open the revised version as a new decision.',
        [order, ['Decision', o.decision ?? '—'], ...(o.note ? [['Their note', o.note] as Row] : []), ['Open the order', admin, admin]]),
    };
    case 'photo_asked': return {
      subject: `${o.code} / ${o.brand} asked for a photo of ${stageName(o.photoStage ?? o.stage)}`,
      ...render(`${o.brand} asked for a photo.`, 'Add one to the order; adding a photo of that stage answers the request.',
        [order, ['Stage', stageName(o.photoStage ?? o.stage)], ...(o.note ? [['Their note', o.note] as Row] : []), ['Open the order', admin, admin]]),
    };
  }
}

/** The email someone gets when staff add them: a client's person (to the portal) or staff (to the admin). */
export function inviteEmail(i: { kind: 'client' | 'staff'; name: string; brand?: string; url: string; by: string }) {
  return i.kind === 'client'
    ? {
      subject: `Follow your orders with Full Circle`,
      ...render(`Hello ${i.name}.`, `${i.by} at Full Circle added you to ${i.brand}. You can now follow its orders: each stage, the decisions waiting for you, photos and the approval log.`,
        [['Sign in at', i.url, i.url], ['With', 'this email address; we send you a 6-digit code each time']]),
    }
    : {
      subject: 'You are on the Full Circle team',
      ...render(`Hello ${i.name}.`, `${i.by} added you to Full Circle's admin.`,
        [['Sign in at', i.url, i.url], ['With', 'this email address; we send you a 6-digit code each time']]),
    };
}
