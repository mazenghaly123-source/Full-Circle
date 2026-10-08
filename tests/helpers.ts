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
