// Renders the picture shown when a page of the site is shared (public/og.jpg, 1200×630): the
// horizontal logo, the home page's line and the eight-stage ring with the mark, in the site's
// colours and fonts. Run it again when one of them changes: node scripts/og-image.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const svg = (name) => readFileSync(`${root}assets/logos/${name}`, 'utf8').replace(/<metadata>[\s\S]*?<\/metadata>/, '');
// inlined: a page set from a string may not load fonts from file:// paths
const font = (pkg, file) => `url(data:font/woff2;base64,${readFileSync(`${root}node_modules/@fontsource/${pkg}/files/${file}`).toString('base64')})`;

const html = `<!doctype html><html><head><style>
@font-face{font-family:Saira;font-weight:700;src:${font('saira-condensed', 'saira-condensed-latin-700-normal.woff2')}}
@font-face{font-family:Plex;font-weight:400;src:${font('ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff2')}}
*{box-sizing:border-box}html,body{margin:0}
body{width:1200px;height:630px;overflow:hidden;position:relative;background:#11110F;color:#E8E2D8}
.light{position:absolute;inset:0;background:radial-gradient(42% 60% at 88% 18%,rgba(201,104,50,.42),transparent 70%),radial-gradient(40% 55% at 8% 100%,rgba(36,62,143,.55),transparent 72%)}
.grain{position:absolute;inset:0;opacity:.18;mix-blend-mode:overlay}
.logo{position:absolute;left:84px;top:78px;width:300px}.logo svg{width:100%;height:auto;display:block}
.label{position:absolute;left:84px;top:262px;font:400 22px/1 Plex,monospace;letter-spacing:.02em;color:rgba(232,226,216,.72);display:flex;align-items:center;gap:14px}
.label i{width:11px;height:11px;border-radius:50%;background:#C5322B}
h1{position:absolute;left:84px;top:318px;margin:0;font:700 92px/.9 Saira,sans-serif;white-space:nowrap;text-transform:uppercase;letter-spacing:-.005em}
.ring{position:absolute;right:70px;top:115px;width:400px;height:400px}
.ring svg.r{position:absolute;inset:0}
.ring .mark{position:absolute;left:50%;top:50%;width:150px;transform:translate(-50%,-50%)}.ring .mark svg{width:100%;height:auto;display:block}
</style></head><body>
<div class="light"></div>
<svg class="grain" width="1200" height="630"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
<div class="logo">${svg('fullcircle-horizontal-bone.svg')}</div>
<div class="label"><i></i>Development + manufacturing / Cairo, Egypt</div>
<h1>Idea to product.<br>Full circle.</h1>
<div class="ring">
  <svg class="r" viewBox="0 0 400 400"><g transform="rotate(-90 200 200)">
    <circle cx="200" cy="200" r="170" fill="none" stroke="rgba(232,226,216,.16)" stroke-width="3"/>
    <circle cx="200" cy="200" r="170" fill="none" stroke="#E8E2D8" stroke-width="3" pathLength="100" stroke-dasharray="87.5 100"/>
    ${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * 2 * Math.PI; return `<circle cx="${200 + 170 * Math.cos(a)}" cy="${200 + 170 * Math.sin(a)}" r="6" fill="${i === 7 ? '#C5322B' : '#E8E2D8'}"/>`; }).join('')}
  </g></svg>
  <div class="mark">${svg('fullcircle-mark-bone.svg')}</div>
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${root}public/og.jpg`, type: 'jpeg', quality: 86 });
await browser.close();
console.log('public/og.jpg written');
