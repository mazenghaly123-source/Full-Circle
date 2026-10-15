import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { NOTICE } from '../supabase/functions/_shared/forms';

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
 * The approved departures from the prototype (site audit part B): the CSS between the markers at the
 * end of src/styles/global.css, and the markup the build uses for them. The parity suite applies them
 * to the prototype, so the build is compared with the prototype as approved.
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

export async function approvePrototype(page: Page) {
  await page.evaluate(([css, labels, lines]) => {
    // last in the document, as the block is last in global.css (the prototype's own styles sit in <body>)
    const style = document.createElement('style'); style.textContent = css; document.body.append(style);
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
  }, [APPROVED_CSS, FIELD_LABELS, FORM_LINES] as const);
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
