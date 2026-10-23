// Analytics: how many requests come in and how many become orders, month by month; and, over the
// last 90 days, by where they came from (saved with each request: ad tags, referring site), by
// product and by brand stage. Website visits come with Umami at launch.
import * as api from '../api';
import type { View } from '../app';
import { esc } from '../ui';

const MONTHS = 6;
const WINDOW_DAYS = 90;
const DAY = 86_400_000;
const month = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(new Date(iso)).slice(0, 7);
const monthName = (ym: string, o: Intl.DateTimeFormatOptions) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', ...o });
const pct = (o: number, n: number) => n ? `${Math.round((o / n) * 100)}%` : '—';
/** A round, even number at or above n for the top of the axis (so its middle is a whole number). */
const ceilNice = (n: number) => { const s = [2, 4, 6, 8, 10]; let p = 1; for (;;) { for (const k of s) if (k * p >= n) return k * p; p *= 10; } };

/** Where a request came from: its ad source, else the site that sent it, else unknown. */
function sourceOf(r: api.Counted) {
  if (r.source.utm_source) return r.source.utm_source.toLowerCase();
  try { if (r.source.referrer) return new URL(r.source.referrer).hostname.replace(/^www\./, ''); } catch { /* not a URL */ }
  return 'Direct or unknown';
}

/** A table of groups: how many requests, how many became orders, the rate. */
function groups(list: api.Counted[], key: (r: api.Counted) => string, top = 6) {
  const m = new Map<string, { n: number; o: number }>();
  for (const r of list) { const k = key(r), g = m.get(k) ?? { n: 0, o: 0 }; g.n++; if (r.orders.length) g.o++; m.set(k, g); }
  const rows = [...m].sort((a, b) => b[1].n - a[1].n);
  if (rows.length > top) {
    const rest = rows.splice(top - 1).reduce((t, [, g]) => ({ n: t.n + g.n, o: t.o + g.o }), { n: 0, o: 0 });
    rows.push(['Other', rest]);
  }
  return rows;
}
const table = (rows: [string, { n: number; o: number }][], what: string, total: number) => rows.length
  ? `<table class="tbl"><thead><tr><th>${what}</th><th class="tn" style="text-align:right">Requests</th><th class="tn" style="text-align:right">Became orders</th><th class="tn" style="text-align:right">Rate</th></tr></thead><tbody>${rows.map(([k, g]) => `<tr><td>${esc(k)}<span class="bar" aria-hidden="true"><i style="width:${(g.n / total) * 100}%"></i></span></td><td class="tn" style="text-align:right">${g.n}</td><td class="tn" style="text-align:right">${g.o}</td><td class="tn t2" style="text-align:right">${pct(g.o, g.n)}</td></tr>`).join('')}</tbody></table>`
  : `<div class="empty">No requests in the last ${WINDOW_DAYS} days.</div>`;

export async function analyticsView(v: View) {
  // the last six months, this one included; every request from the first of them is read
  const thisMonth = month(new Date().toISOString());
  const yms = Array.from({ length: MONTHS }, (_, i) => { const d = new Date(`${thisMonth}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - (MONTHS - 1 - i)); return d.toISOString().slice(0, 7); });
  // a day early, so the first hours of the month in Cairo (UTC+2 or +3) are in
  const from = new Date(Date.parse(`${yms[0]}-01T00:00:00Z`) - DAY).toISOString();
  const [requests, messages, orders] = await Promise.all([api.requestsSince(from), api.messages(), api.orders()]);
  const now = Date.now(), within = (iso: string, from: number, to = 0) => { const t = now - Date.parse(iso); return t >= to * DAY && t < from * DAY; };
  const r30 = requests.filter((r) => within(r.created_at, 30)), r60 = requests.filter((r) => within(r.created_at, 60, 30));
  const r90 = requests.filter((r) => within(r.created_at, WINDOW_DAYS)), o90 = r90.filter((r) => r.orders.length).length;
  const opened30 = orders.filter((o) => within(o.created_at, 30)).length, m30 = messages.filter((m) => within(m.created_at, 30)).length;

  const months = yms.map((ym) => { const list = requests.filter((r) => month(r.created_at) === ym); return { ym, n: list.length, o: list.filter((r) => r.orders.length).length }; });
  const top = ceilNice(Math.max(4, ...months.map((m) => m.n)));

  const kpis = [
    { label: 'Requests, 30 days', n: r30.length, sub: r60.length ? `${r30.length >= r60.length ? '+' : ''}${Math.round(((r30.length - r60.length) / r60.length) * 100)}% on the 30 before` : `${r60.length} in the 30 before` },
    { label: 'Orders opened, 30 days', n: opened30, sub: 'From requests, WhatsApp and repeat clients' },
    { label: `Became orders, ${WINDOW_DAYS} days`, n: pct(o90, r90.length), sub: `${o90} of ${r90.length} requests` },
    { label: 'Messages, 30 days', n: m30, sub: 'From the contact page' },
  ];

  v.main.innerHTML = `<section class="mast"><div style="display:flex;flex-direction:column;gap:6px"><span class="kick">Whole studio · from the requests saved</span><h1 class="sc">Analytics</h1></div>
<p>${r30.length} ${r30.length === 1 ? 'request' : 'requests'} in the last 30 days. Over ${WINDOW_DAYS} days, ${pct(o90, r90.length)} of requests became orders. A request becomes an order when staff convert it, and the order keeps its code.</p></section>
<section class="ledger l4" aria-label="Headline figures">${kpis.map((k) => `<div class="kp"><span class="kick" style="color:var(--t2);grid-column:span 2">${k.label}</span><span class="kn tn" style="grid-column:span 2">${k.n}</span><span class="dl" style="grid-column:span 2">${esc(k.sub)}</span></div>`).join('')}</section>
<div class="grid">
<section class="card hero c8" aria-labelledby="dm-h"><div class="ch"><span style="display:flex;flex-direction:column;gap:6px"><span class="kick">01 — Demand</span><h2 id="dm-h" class="sc ct">Requests and orders</h2></span><span class="cm">Last ${MONTHS} months</span></div>
<div class="row" style="padding:14px 22px 0;gap:6px 14px"><span class="leg"><span class="sw" style="background:#6E6B65"></span>Requests</span><span class="leg"><span class="sw" style="background:#E3DDD2"></span>Became orders</span><span class="leg t3" style="margin-left:auto">Under each month: the share that became orders</span></div>
<div style="padding:26px 22px 0"><div class="plot" style="height:200px">
<span class="gy" style="top:0"></span><span class="gy" style="top:50%"></span><span class="gy" style="top:100%;border-top-style:solid;border-color:rgba(255,246,232,.16)"></span>
<span class="yl" style="top:0">${top}</span><span class="yl" style="top:50%">${top / 2}</span><span class="yl" style="top:100%">0</span>
<div class="bars" style="grid-template-columns:repeat(${MONTHS},minmax(0,1fr))">${months.map((m) => `<button type="button" class="bcol" aria-label="${monthName(m.ym, { month: 'long', year: 'numeric' })}: ${m.n} requests, ${m.o} became orders">
<span class="tip"><b>${monthName(m.ym, { month: 'long', year: 'numeric' })}</b><br>${m.n} requests · ${m.o} became orders<br>${pct(m.o, m.n)} converted</span>
<span class="mono tn t2" style="margin-bottom:4px">${m.n || ''}</span>
<span class="bseg" style="width:46%;height:${((m.n - m.o) / top) * 100}%;background:#6E6B65${m.o ? '' : ';border-radius:4px 4px 0 0'}"></span>
<span class="bseg" style="width:46%;height:${(m.o / top) * 100}%;background:#E3DDD2;border-radius:${m.n - m.o ? '0' : '4px 4px'} 0 0"></span></button>`).join('')}</div></div>
<div style="display:grid;grid-template-columns:repeat(${MONTHS},minmax(0,1fr));margin-left:26px;padding-top:8px">${months.map((m) => `<span style="display:flex;flex-direction:column;align-items:center;gap:2px"><span class="mono t3">${monthName(m.ym, { month: 'short' })}</span><span class="mono tn t2">${m.n ? pct(m.o, m.n) : '—'}</span></span>`).join('')}</div></div>
<p class="hint" style="margin:14px 22px 20px;padding-top:12px;border-top:1px solid var(--bd)">Recent months convert later: a request can take weeks to become an order.</p></section>
<section class="card c4" aria-labelledby="sr-h"><div class="ch"><span style="display:flex;flex-direction:column;gap:6px"><span class="kick">02 — Sources</span><h2 id="sr-h" class="sc ct">Where they come from</h2></span><span class="cm">${WINDOW_DAYS} days</span></div>
<div class="cb scroll-x">${table(groups(r90, sourceOf), 'Source', r90.length)}<span class="hint">From the ad tags (utm_source) on the link, else the site that sent the visitor.</span></div></section>
<section class="card c6" aria-labelledby="pr-h"><div class="ch"><span style="display:flex;flex-direction:column;gap:6px"><span class="kick">03 — Products</span><h2 id="pr-h" class="sc ct">By product</h2></span><span class="cm">${WINDOW_DAYS} days</span></div>
<div class="cb scroll-x">${table(groups(r90, (r) => r.product, 8), 'Product', r90.length)}</div></section>
<section class="card c6" aria-labelledby="bs-h"><div class="ch"><span style="display:flex;flex-direction:column;gap:6px"><span class="kick">04 — Brand stage</span><h2 id="bs-h" class="sc ct">Starting or scaling</h2></span><span class="cm">${WINDOW_DAYS} days</span></div>
<div class="cb scroll-x">${table(groups(r90, (r) => r.path), 'The brand is', r90.length)}</div></section>
<section class="card c12" aria-labelledby="wb-h"><div class="ch"><span style="display:flex;flex-direction:column;gap:6px"><span class="kick">05 — Website</span><h2 id="wb-h" class="sc ct">Website visits</h2></span><span class="tag">At launch</span></div>
<div class="cb"><span class="t2">Visits per day, top pages and sources arrive with Umami when the site goes live on its domain. No cookies; the admin and the portal are never counted. The sources above do not wait for it: each request saves its own.</span></div></section>
</div>`;
}
