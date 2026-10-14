import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

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

/**
 * Call before the prototype is opened. The CSS goes in as soon as the document is parsed, before the
 * prototype's scripts run, as the build has it from the start: the phone size of the 3D mark would
 * otherwise resize its canvas after the mark is drawn, and the prototype does not redraw on a resize,
 * so the mark would vanish. The markup goes in once the page has loaded.
 */
export async function approvePrototype(page: Page) {
  await page.addInitScript(([css, labels]) => {
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
    });
  }, [APPROVED_CSS, FIELD_LABELS] as const);
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
