// The emails the forms send: an alert to staff for each request and message, and a receipt to a
// brand that gave an email. Plain functions of their inputs, so the tests can read them too.
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

/** A plain-text and an HTML version of the same rows, in a quiet layout that survives any mail app. */
function render(title: string, intro: string, rows: Row[], outro: string[] = []) {
  const text = [title, '', intro, '', ...rows.map(([l, v, h]) => `${l}: ${v}${h && !v.includes(h) ? ` (${h})` : ''}`), ...(outro.length ? ['', ...outro] : [])].join('\n');
  const cell = 'padding:6px 12px 6px 0;vertical-align:top;font-size:14px;line-height:1.45';
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f1ec;color:#11110F;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:28px;border-top:4px solid #11110F">
<h1 style="margin:0 0 12px;font-size:22px;letter-spacing:.01em">${esc(title)}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5">${esc(intro)}</p>
<table role="presentation" style="border-collapse:collapse">${rows.map(([l, v, h]) =>
    `<tr><td style="${cell};color:#6b6458;white-space:nowrap">${esc(l)}</td><td style="${cell}">${h ? `<a href="${esc(h)}" style="color:#11110F">${esc(v)}</a>` : esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>
${outro.map((p) => `<p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:#3d3a34">${esc(p)}</p>`).join('')}
</div></body></html>`;
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
    ], [`Questions? Reply to this email, or message us on WhatsApp: ${SITE.whatsapp} (${SITE.whatsappUrl}).`, 'Full Circle, Cairo']),
    replyTo: SITE.email,
  };
}

export type MessageMail = { at: Date; name: string; typed: string; reach: Contact; text: string; source: Source };

/** The alert staff get for a contact message. */
export function staffMessageEmail(m: MessageMail) {
  const reach = reachLink(m.typed, m.reach);
  const rows: Row[] = [['From', m.name], ['Contact', reach.label, reach.href], ['Message', m.text]];
  const from = sourceLine(m.source);
  if (from) rows.push(['Came from', from]);
  rows.push(['Received', cairoTime(m.at)]);
  return { subject: `New message from ${m.name}`, ...render(`Message from ${m.name}`, 'Sent from the contact page.', rows) };
}
