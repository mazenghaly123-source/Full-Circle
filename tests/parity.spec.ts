// Parity: every page of the build is screenshotted next to the same page of the prototype and the
// two are compared pixel by pixel.
// - "layout": photos and the 3D canvas are hidden, so only type, spacing, colour and shapes count.
// - "visual": everything, photos and the 3D mark included, compared at 1/8 scale. Photos are
//   re-encoded from the originals, so fine pixel noise is expected and averaged out; a wrong or
//   missing photo, a wrong crop or a different 3D pose still shows.
import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { PAGES, PROTOTYPE, contextFor, freeze, serveThreeLocally, settle } from './helpers';

const LIMITS = { layout: 0.002, visual: 0.005 };
const SCALE = { layout: 1, visual: 8 };
const HIDE_MEDIA = 'img,picture,canvas{visibility:hidden!important}';

for (const { key, route } of PAGES) {
  test(`parity: ${key}`, async ({ browser }, info) => {
    test.setTimeout(300_000);
    const shots: Record<string, { layout: Buffer; visual: Buffer }> = {};
    for (const side of ['prototype', 'build'] as const) {
      const ctx = await browser.newContext(contextFor(info));
      const page = await ctx.newPage();
      await freeze(page);
      if (side === 'prototype') await serveThreeLocally(page);
      await page.goto(side === 'prototype' ? `${PROTOTYPE}#${key}` : `${info.project.use.baseURL}${route}`, { waitUntil: 'load' });
      await settle(page);
      const visual = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
      const style = await page.addStyleTag({ content: HIDE_MEDIA });
      await page.waitForTimeout(300);
      const layout = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
      await style.evaluate((s) => s.remove());
      shots[side] = { layout, visual };
      await ctx.close();
    }
    const report: string[] = [];
    for (const mode of ['layout', 'visual'] as const) {
      const read = async (buf: Buffer) => {
        if (SCALE[mode] === 1) return PNG.sync.read(buf);
        const { width = 0, height = 0 } = await sharp(buf).metadata();
        return PNG.sync.read(await sharp(buf).resize(Math.round(width / SCALE[mode]), Math.round(height / SCALE[mode]), { kernel: 'cubic' }).png().toBuffer());
      };
      const a = await read(shots.prototype[mode]), b = await read(shots.build[mode]);
      const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
      const crop = (p: PNG) => { const o = new PNG({ width: w, height: h }); PNG.bitblt(p, o, 0, 0, w, h, 0, 0); return o; };
      const A = crop(a), B = crop(b), diff = new PNG({ width: w, height: h });
      const n = pixelmatch(A.data, B.data, diff.data, w, h, { threshold: 0.1 });
      const ratio = n / (w * h);
      for (const [name, body] of [['prototype', shots.prototype[mode]], ['build', shots.build[mode]], ['diff', PNG.sync.write(diff)]] as const) {
        writeFileSync(info.outputPath(`${mode}-${name}.png`), body);
        await info.attach(`${key}-${mode}-${name}.png`, { path: info.outputPath(`${mode}-${name}.png`), contentType: 'image/png' });
      }
      report.push(`${mode}: ${(ratio * 100).toFixed(3)}% of pixels differ (limit ${(LIMITS[mode] * 100).toFixed(1)}%), heights ${a.height * SCALE[mode]} vs ${b.height * SCALE[mode]}`);
      expect.soft(b.height, `${mode}: page height`).toBe(a.height);
      expect.soft(ratio, `${mode}: differing pixels`).toBeLessThanOrEqual(LIMITS[mode]);
    }
    console.log(`[${info.project.name}] ${key}\n  ` + report.join('\n  '));
  });
}
