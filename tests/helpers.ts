import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { NOTICE } from '../supabase/functions/_shared/forms';
import { FAQ } from '../src/data/site';

export const PROTOTYPE = pathToFileURL(resolve('prototype/index.html')).href;

/** Prototype hash page → production route. */
export const PAGES = [
  { key: 'home', route: '/' },
  { key: 'how', route: '/how-it-works' },
  { key: 'make', route: '/what-we-make' },
  { key: 'about', route: '/about' },
  { key: 'start', route: '/request-a-sample' },
  { key: 'track', route: '/track' },
  { key: 'contact', route: '/contact' },
] as const;

export const isPhone = (info: TestInfo) => (info.project.use.viewport?.width ?? 1440) <= 760;

/** Context options matching the current project (viewport, touch). */
export const contextFor = (info: TestInfo) => ({
  viewport: info.project.use.viewport,
  isMobile: info.project.use.isMobile,
  hasTouch: info.project.use.hasTouch,
  deviceScaleFactor: 1,
});

/** Messages from the headless browser itself, not from the site. */
const NOISE = [/swiftshader/i, /GPU stall/i, /GroupMarkerNotSet/i, /WebGL/i];

/** Collects page errors and console errors so a test can assert there were none. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.some((n) => n.test(m.text()))) errors.push('console: ' + m.text()); });
  return errors;
}

/** Deterministic demo codes, and a handle on intervals so the hero ring can be stopped. */
export async function freeze(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.5;
    const ids: number[] = [];
    const si = window.setInterval.bind(window);
    (window as any).__intervals = ids;
    window.setInterval = ((f: TimerHandler, t?: number, ...a: unknown[]) => { const id = si(f, t, ...a); ids.push(id); return id; }) as typeof setInterval;
  });
}

/**
 * The prototype loads three.js from jsdelivr. Serve the same version (0.160.0, pinned in
 * package.json) from node_modules, so a slow CDN cannot push the prototype onto its flat fallback.
 */
export async function serveThreeLocally(page: Page) {
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/npm/three@0.160.0/', '');
    route.fulfill({ body: readFileSync(resolve('node_modules/three', path)), contentType: 'text/javascript' });
  });
}

/**
 * The approved departures from the prototype (site audit part B, then as dated): the CSS between the
 * markers at the end of src/styles/global.css, and the markup the build uses for them. The parity
 * suite applies them to the prototype, so the build is compared with the prototype as approved.
 */
const APPROVED_CSS = (() => {
  const css = readFileSync(resolve('src/styles/global.css'), 'utf8');
  const m = css.match(/\/\* ===== approved changes[\s\S]*?\*\/([\s\S]*?)\/\* ===== end approved changes ===== \*\//);
  if (!m) throw new Error('the approved changes block is missing from src/styles/global.css');
  return m[1];
})();

/** Field labels the build shows above its fields (B6), by field id. */
const FIELD_LABELS: [string, string][] = [
  ['fBrand', 'Brand name'], ['fContact', 'Email or WhatsApp'], ['fNote', 'Notes (optional)'],
  ['cName', 'Your name'], ['cReach', 'Email or WhatsApp'], ['cMsg', 'Message'],
  ['tId', 'Email or WhatsApp number'], ['tCode', '6-digit code'],
];

/** The form lines (approved 15 Oct 2026): what shows under each form's button. */
const FORM_LINES = { request: NOTICE.request, contact: NOTICE.contact };

/**
 * Call before the prototype is opened. The CSS goes in as soon as the document is parsed, before the
 * prototype's scripts run, as the build has it from the start: the phone size of the 3D mark would
 * otherwise resize its canvas after the mark is drawn, and the prototype does not redraw on a resize,
 * so the mark would vanish. The markup goes in once the page has loaded.
 */
export async function approvePrototype(page: Page) {
  await page.addInitScript(([css, labels, lines, faq]) => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState !== 'interactive') return;
      // last in the document, as the block is last in global.css (the prototype's own styles sit in <body>)
      const style = document.createElement('style'); style.textContent = css; document.body.append(style);
    });
    addEventListener('load', () => {
      // B2: error lines and the red labels become Bone with a red dot
      for (const id of ['err', 'cErr', 'tErr']) { const e = document.getElementById(id)!; e.removeAttribute('style'); e.classList.add('errline'); }
      for (const e of document.querySelectorAll('.yo-top span[style="color:var(--red)"], #oDecT')) { e.removeAttribute('style'); e.classList.add('need'); }
      // B3: the scrim over the hero
      document.querySelector('.hero > .light')!.insertAdjacentHTML('afterend', '<div class="scrim" aria-hidden="true"></div>');
      // B6: a label above each field
      for (const [id, text] of labels) {
        const l = document.createElement('label'); l.className = 'mono dim flabel'; l.htmlFor = id; l.textContent = text;
        document.getElementById(id)!.before(l);
      }
      // the form lines: the privacy line under each form's button (the WhatsApp line, the opt-in and
      // the Turnstile slot stay hidden until used, so they are not added)
      const notice = (text: string, link: boolean) => {
        const p = document.createElement('p'); p.className = 'notice'; p.textContent = text;
        if (link) { const a = document.createElement('a'); a.href = '/privacy'; a.textContent = 'Privacy notice'; p.append(' ', a); }
        return p;
      };
      document.getElementById('err')!.after(notice(lines.request, true));
      document.getElementById('cErr')!.after(notice(lines.contact, true));
      // requests take no files (15 Oct 2026), and a sent request offers WhatsApp with its code
      document.getElementById('fFile')!.closest('label')!.remove();
      document.querySelector('.sent-box')!.insertAdjacentHTML('beforeend', '<a class="btn btn-line" id="sentWa" target="_blank" rel="noopener">Continue on WhatsApp</a>');
      // less text, no TBC left (15 Oct 2026): fabrics, bulk lead times, techniques, the scope list and
      // the sample price go; stage times show only where known; the team waits for its portraits
      const byText = (sel: string, start: string) => [...document.querySelectorAll(sel)].find((e) => e.textContent!.trim().startsWith(start))!;
      for (const tr of document.querySelectorAll('.spec2 tr')) if (['Fabrics', 'Bulk lead time'].includes(tr.querySelector('th')!.textContent!)) tr.remove();
      for (const dt of document.querySelectorAll('.kv2 dt')) if (dt.textContent === 'Typical time' && dt.nextElementSibling!.querySelector('.tbc')) { dt.nextElementSibling!.remove(); dt.remove(); }
      const techs = byText('.sh', 'Techniques').nextElementSibling!;
      techs.previousElementSibling!.remove(); techs.nextElementSibling!.removeAttribute('style'); techs.remove();
      byText('.limits > div', 'Not in scope').remove();
      document.querySelector('.team')!.closest('section')!.remove();
      byText('p.note', 'Free first call').textContent = 'Free first call / we reply quickly';
      byText('.make-foot span', 'Minimums per category').textContent = 'Minimums per category';
      byText('span.mono', '01 / Within one working day').textContent = '01 / We reply quickly';
      byText('b', 'Sunday – Thursday').textContent = 'Sunday – Thursday / 9:00 – 17:00';
      // phase 3 (20 Oct 2026): the real portal replaces Track's demo, and its note goes
      document.querySelector('#tLogin .demo-note')!.remove();
      document.getElementById('faqList')!.innerHTML =faq.map(([q, a], i) => `<details><summary><span class="mono dim">${String(i + 1).padStart(2, '0')}</span><h3>${q}</h3><span class="plus"></span></summary><p class="ans">${a}</p></details>`).join('');
    });
  }, [APPROVED_CSS, FIELD_LABELS, FORM_LINES, FAQ] as const);
}

/** Waits for fonts, photos, the 3D mark, intros and count-ups, then stops the hero ring at a fixed stage. */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelectorAll<HTMLImageElement>('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
  // every photo loaded, decoded and faded in (both sides mark a loaded photo with .ok). Generous:
  // on Home the software-WebGL 3D build holds the main thread, and the load handlers wait behind it.
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && (!i.naturalWidth || i.classList.contains('ok'))), null, { timeout: 90_000 });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  // the 3D hero mark is up (or has given up and drawn the flat mark)
  await page.waitForFunction(() => { const w = document.querySelector('.hero .ringwrap'); return !w || w.classList.contains('m3on') || !w.classList.contains('m3wait'); }, null, { timeout: 90_000 });
  await page.waitForTimeout(4000);
  // Chromium's full-page capture on a phone can lay the page out narrower for a moment. That resizes
  // the 3D canvas, and resizing a WebGL canvas clears it (the build redraws a frame later, the
  // prototype not at all), so the capture could miss the mark. Pin the canvas at its laid-out size.
  await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('.ringwrap canvas.mark3'); if (!c) return;
    const { width, height } = getComputedStyle(c); c.style.width = width; c.style.height = height;
  });
  await page.evaluate(() => {
    ((window as any).__intervals as number[]).forEach((id) => clearInterval(id));
    const arc = document.getElementById('heroArc'), dot = document.getElementById('heroDot'), labels = document.getElementById('heroLabels');
    if (arc && dot && labels) {
      arc.style.transition = 'none'; arc.style.strokeDashoffset = '50';
      dot.setAttribute('cx', '350'); dot.setAttribute('cy', '200');
      [...labels.children].forEach((t, k) => t.classList.toggle('on', k < 4));
    }
  });
  await page.waitForTimeout(200);
}

/** What a mocked form function received, and how it should answer. */
export type Sent = { url: string; body: Buffer | null };

/**
 * Stands in for the forms' backend: Cloudflare's Turnstile script (answers at once with its test
 * token) and the submit-request and submit-contact Edge Functions. `answer` decides each reply;
 * by default a request gets FC-2501 and a message is taken. Returns what was posted.
 */
export async function mockBackend(page: Page, answer: (fn: 'submit-request' | 'submit-contact', n: number) => { status?: number; json?: object; abort?: boolean; delayMs?: number } = () => ({})) {
  const sent: Sent[] = [];
  await page.route('https://challenges.cloudflare.com/turnstile/**', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.turnstile = { render(el, o) { setTimeout(() => o.callback("XXXX.DUMMY.TOKEN.XXXX"), 10); return "w"; }, remove() {} };',
  }));
  await page.route(/\/functions\/v1\/submit-(request|contact)$/, async (route) => {
    const req = route.request(), fn = req.url().endsWith('submit-request') ? 'submit-request' : 'submit-contact';
    sent.push({ url: req.url(), body: req.postDataBuffer() });
    const a = answer(fn, sent.filter((s) => s.url.endsWith(fn)).length);
    if (a.delayMs) await new Promise((r) => setTimeout(r, a.delayMs));
    if (a.abort) return route.abort('failed');
    await route.fulfill({ status: a.status ?? 200, contentType: 'application/json', json: a.json ?? (fn === 'submit-request' ? { code: 'FC-2501' } : { ok: true }) });
  });
  return sent;
}

/** The JSON a mocked form function received. */
export const postedData = (s: Sent): Record<string, unknown> => JSON.parse(s.body?.toString('utf8') ?? '');

/** An order as the portal reads it from the database (src/scripts/core/portal.ts). */
type PortalOrder = Record<string, any> & { id: number; code: string; stage: number; order_decisions: any[]; order_events: any[]; stage_photos: any[]; photo_requests: any[] };

/** The prototype's three demo orders, as the database would hold them. */
function portalOrders(): PortalOrder[] {
  let ev = 100;
  const log = (order: number, rows: [string, string, number?][]) => rows.map(([kind, title, stage]) =>
    ({ id: ++ev, kind, side: kind === 'approved' || kind === 'changes_asked' ? 'client' : 'staff', actor_id: 'me', actor_label: 'Laila', stage: stage ?? null, to_stage: null, decision_id: null, title, note: null, created_at: `2026-10-${String(ev - 99).padStart(2, '0')}T10:00:00Z`, order }));
  const decision = (id: number, stage: number, title: string, body: string) => ({ id, stage, title, body, status: 'open', opened_at: '2026-10-14T09:00:00Z', closed_at: null });
  return [
    { id: 1, code: 'FC-2418', name: 'Overshirt', product: 'Shirts', summary: 'Sample 03 / denim 12 oz / 300 pcs', qty: 300, stage: 5, status: 'active', created_at: '2026-10-03T09:00:00Z',
      order_specs: [['Fabric', 'Denim 12 oz, rinse'], ['Sizes', 'S / M / L / XL'], ['Chest (M)', '56.0 cm'], ['Body length (M)', '74.0 cm']].map(([key, value], position) => ({ key, value, position })),
      order_decisions: [decision(11, 5, 'Approve sample 03', 'Fit and fabric are revised from your notes on sample 02. Once you approve, this sample becomes the reference for bulk cutting.')],
      stage_photos: [3, 4, 5].map((stage, k) => ({ id: 21 + k, stage, object_path: `1/stage-${stage}.jpg`, caption: null, created_at: `2026-10-1${k}T09:00:00Z` })),
      order_events: log(1, [['approved', 'Brief'], ['approved', 'Tech pack'], ['approved', 'Fabric / denim 12 oz'], ['approved', 'Pattern'], ['changes_asked', 'Sample 02'], ['decision_opened', 'Approve sample 03', 5]]),
      photo_requests: [] },
    { id: 2, code: 'FC-2431', name: 'Heavy hoodie', product: 'Hoodies', summary: 'Fleece 400 gsm / 500 pcs', qty: 500, stage: 6, status: 'active', created_at: '2026-10-02T09:00:00Z',
      order_specs: [{ key: 'Fabric', value: 'Fleece 400 gsm, loopback', position: 0 }], order_decisions: [], stage_photos: [],
      order_events: log(2, [['approved', 'Brief'], ['approved', 'Sample 02']]), photo_requests: [] },
    { id: 3, code: 'FC-2455', name: 'Boxy tee', product: 'Tees', summary: 'Jersey 240 gsm / 400 pcs', qty: 400, stage: 3, status: 'active', created_at: '2026-10-01T09:00:00Z',
      order_specs: [{ key: 'Fabric', value: 'Jersey 240 gsm, 3 options', position: 0 }],
      order_decisions: [decision(31, 3, 'Choose the fabric', 'Three jersey swatches were sent on Monday. Pick one so we can cut the first pattern.')], stage_photos: [],
      order_events: log(3, [['approved', 'Brief'], ['decision_opened', 'Choose the fabric', 3]]), photo_requests: [] },
  ];
}

const SUPABASE = 'https://kmsrzeqxgufrodefclty\\.supabase\\.co';
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/**
 * Stands in for Supabase on the portal: sign-in codes (123456 is right, anything else wrong), the
 * client's three orders, signed photo links and the client's actions, which change the orders as
 * the database functions would (approving closes the decision and logs it; the stage stays).
 * Returns the calls made, as { fn, body }.
 */
export async function mockPortal(page: Page) {
  const calls: { fn: string; body: any }[] = [];
  const orders = portalOrders();
  let updates = false, next = 500;
  const now = () => new Date().toISOString();
  const logRow = (o: PortalOrder, kind: string, extra: object) => o.order_events.push({ id: ++next, kind, side: 'client', actor_id: 'me', actor_label: 'Laila', stage: o.stage, to_stage: null, decision_id: null, title: null, note: null, created_at: now(), ...extra });
  const rpcs: Record<string, (b: any) => { status: number; json?: object }> = {
    my_updates_consent: () => ({ status: 200, json: updates ? [{ channel: 'whatsapp', opted_in: true }] : [] }),
    set_updates_consent: (b) => { updates = b.p_opted_in; return { status: 200 }; },
    approve_decision: (b) => {
      const o = orders.find((x) => x.order_decisions.some((d) => d.id === b.p_decision))!, d = o.order_decisions.find((x) => x.id === b.p_decision);
      if (d.status !== 'open') return { status: 400, json: { code: '55000', message: 'This decision is already closed' } };
      Object.assign(d, { status: 'approved', closed_at: now() }); logRow(o, 'approved', { decision_id: d.id, title: d.title, stage: d.stage });
      return { status: 200 };
    },
    request_changes: (b) => {
      const o = orders.find((x) => x.order_decisions.some((d) => d.id === b.p_decision))!, d = o.order_decisions.find((x) => x.id === b.p_decision);
      Object.assign(d, { status: 'changes_asked', closed_at: now() }); logRow(o, 'changes_asked', { decision_id: d.id, title: d.title, stage: d.stage });
      return { status: 200 };
    },
    request_photo: (b) => {
      const o = orders.find((x) => x.id === b.p_order)!;
      if (o.photo_requests.some((r) => r.stage === o.stage && !r.answered_at)) return { status: 400, json: { code: '55000', message: 'A photo of this stage is already on its way' } };
      o.photo_requests.push({ stage: o.stage, answered_at: null }); logRow(o, 'photo_asked', {});
      return { status: 200 };
    },
  };
  await page.route(new RegExp(`^${SUPABASE}/auth/v1/`), async (route) => {
    const req = route.request(), fn = new URL(req.url()).pathname.split('/').pop()!, body = req.postDataJSON?.() ?? null;
    calls.push({ fn: `auth/${fn}`, body });
    if (fn === 'verify') {
      return body.token === '123456'
        ? route.fulfill({ json: { access_token: 'token', refresh_token: 'refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'me' } } })
        : route.fulfill({ status: 403, json: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' } });
    }
    return route.fulfill({ status: fn === 'logout' ? 204 : 200, json: {} });
  });
  await page.route(new RegExp(`^${SUPABASE}/rest/v1/`), async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname.replace('/rest/v1/', '');
    if (path.startsWith('rpc/')) {
      const fn = path.slice(4), body = req.postDataJSON?.() ?? {};
      calls.push({ fn, body });
      const a = rpcs[fn]?.(body) ?? { status: 404 };
      return route.fulfill({ status: a.status, json: a.json ?? null });
    }
    calls.push({ fn: path, body: null });
    if (path === 'clients') return route.fulfill({ json: [{ brand: 'Demo Studio' }] });
    if (path === 'client_members') return route.fulfill({ json: [{ whatsapp: '+201011435406' }] });
    if (path === 'orders') return route.fulfill({ json: JSON.parse(JSON.stringify(orders)) });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.route(new RegExp(`^${SUPABASE}/storage/v1/object/sign/`), async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ contentType: 'image/png', body: PIXEL });
    const { paths } = req.postDataJSON();
    return route.fulfill({ json: paths.map((p: string) => ({ path: p, signedURL: `/object/sign/stage-photos/${p}?token=t`, error: null })) });
  });
  return { calls, orders };
}

/** Signs in to the mocked portal (mockPortal) with the right code. */
export async function signInPortal(page: Page, id = 'laila@demo.test') {
  await page.locator('#tId').fill(id);
  await page.locator('#tSendCode').click();
  await page.locator('#tCode').fill('123456');
  await page.locator('#tVerify').click();
  await page.locator('#tList .ord').first().waitFor();
}
