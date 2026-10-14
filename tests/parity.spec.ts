// Parity: every page of the build is screenshotted next to the same page of the prototype and the
// two are compared pixel by pixel. The prototype first gets the approved changes (site audit part B,
// see approvePrototype), so it is the prototype as approved that the build must match.
// - "layout": photos and the 3D canvas are hidden, so only type, spacing, colour and shapes count.
// - "visual": everything, photos and the 3D mark included, compared at 1/8 scale. Photos are
//   re-encoded from the originals, so fine pixel noise is expected and averaged out; a wrong or
//   missing photo, a wrong crop or a different 3D pose still shows.
// - "3D mark": the hero's 3D canvas alone, at full size. The build extrudes the mesh in a worker and
//   the prototype on its main thread; the two must draw the same pixels.
import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { PAGES, PROTOTYPE, approvePrototype, contextFor, freeze, isPhone, serveThreeLocally, settle } from './helpers';

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
      if (side === 'prototype') await approvePrototype(page);
      await settle(page);
      const visual = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
      const style = await page.addStyleTag({ content: HIDE_MEDIA });
      await page.waitForTimeout(300);
      const layout = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
      await style.evaluate((s) => (s as Element).remove());
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

test('parity: 3D mark at full size', async ({ browser }, info) => {
  test.skip(isPhone(info), 'checked once, on desktop');
  test.setTimeout(300_000);
  const shots: Record<string, PNG> = {};
  for (const side of ['prototype', 'build'] as const) {
    const ctx = await browser.newContext(contextFor(info));
    const page = await ctx.newPage();
    await freeze(page);
    if (side === 'prototype') await serveThreeLocally(page);
    await page.goto(side === 'prototype' ? `${PROTOTYPE}#home` : `${info.project.use.baseURL}/`, { waitUntil: 'load' });
    if (side === 'prototype') await approvePrototype(page);
    await settle(page);
    await expect(page.locator('.hero .ringwrap'), `${side}: the 3D mark is up, not the flat one`).toHaveClass(/m3on/);
    await page.addStyleTag({ content: '*{visibility:hidden!important} canvas.mark3{visibility:visible!important}' });
    await page.waitForTimeout(300);
    const clip = (await page.locator('canvas.mark3').boundingBox())!;
    const shot = await page.screenshot({ clip, animations: 'disabled' });
    writeFileSync(info.outputPath(`mark3-${side}.png`), shot);
    shots[side] = PNG.sync.read(shot);
    await ctx.close();
  }
  const a = shots.prototype, b = shots.build;
  expect(`${b.width}×${b.height}`).toBe(`${a.width}×${a.height}`);
  const n = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0 });
  console.log(`[${info.project.name}] 3D mark: ${n} of ${a.width * a.height} pixels differ`);
  expect(n).toBe(0);
});
