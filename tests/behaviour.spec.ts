// Behaviour of the production build: navigation, motion that carries meaning, the phone
// experience, the demos and the forms. Runs at 1440×900, 390×844 and 375×667.
import { expect, test, type Locator, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { PAGES, isPhone, mockBackend, mockPortal, postedData, signInPortal, watchErrors } from './helpers';
import { ERRORS, NOTICE } from '../supabase/functions/_shared/forms';

// Software WebGL in headless Chromium needs seconds to draw the 3D hero mark and blocks the page
// meanwhile, so tests that are not about it get the flat-mark fallback (three.js refuses to load).
test.beforeEach(async ({ page }, info) => {
  // no test reaches the real backend: the forms' functions and Turnstile are stood in for
  await mockBackend(page);
  if (/3D/.test(info.title)) return;
  await page.route(/\/_astro\/three\.module[^/]*\.js$/, (route) => route.fulfill({ body: 'throw new Error("3D off in this test")', contentType: 'text/javascript' }));
});

const scrollToY = (page: Page, y: number) => page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);

/** Scrolls in steps, so scroll listeners see a real scroll. */
/**
 * Scrolls in steps, each seen by the page as a scroll of its own. A step waits for the frame that
 * reports it: on a busy machine frames come late, and steps taken between two frames reach the page
 * as one scroll event (down 450px and back up 300px reads as a scroll down).
 */
async function scrollBy(page: Page, dy: number, steps = 8) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => new Promise((done) => { window.scrollBy({ top: d, behavior: 'instant' }); requestAnimationFrame(() => requestAnimationFrame(done)); }), dy / steps);
    await page.waitForTimeout(40);
  }
}

/**
 * Clicks an element once it is still: centred (clear of the phone bar) and done with the motion
 * that scrolling it into view sets off (the reveal rise, the bars sliding). Clicking mid-motion can
 * press one element and release on another, and the click then goes to their shared parent.
 */
async function clickStill(target: Locator) {
  await target.evaluate(async (el) => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 120));
    const finite = document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity);
    await Promise.all(finite.map((a) => a.finished.catch(() => {})));
  });
  await target.click();
}

async function openNav(page: Page, href: string, phone: boolean) {
  if (phone) { await page.locator('#burger').click(); await expect(page.locator('#hdr')).toHaveClass(/open/); await page.locator(`.mmenu a[href="${href}"]`).click(); }
  else await page.locator(`header .nav a[href="${href}"], header a.track-link[href="${href}"]`).first().click();
}

test.describe('every page', () => {
  for (const { key, route } of PAGES) {
    test(`${key}: loads without errors, fonts, or sideways scroll`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(route);
      await page.waitForTimeout(800);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const families = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).join('|'); });
      expect(families).toContain('Saira Condensed');
      expect(families).toContain('Geist');
      expect(families).toContain('IBM Plex Mono');
      expect(errors).toEqual([]);
    });
  }
});

test('client-side navigation runs the ring wipe, keeps the shell and updates the page', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => {
    (window as any).__sameDocument = true;
    const t: Record<string, number> = ((window as any).__t = {});
    document.addEventListener('astro:before-preparation', () => { t.start = performance.now(); });
    document.addEventListener('astro:after-swap', () => { t.swap = performance.now(); });
  });
  await openNav(page, '/how-it-works', isPhone(info));
  await expect(page.locator('#wipe')).toHaveClass(/cover/);
  await page.waitForURL('**/how-it-works');
  await expect(page.locator('#wipe')).toHaveClass(/^wipe$/, { timeout: 4000 });
  // the page swaps once the wipe has covered the screen (480ms), as in the prototype
  const t = await page.evaluate(() => (window as any).__t as { start: number; swap: number });
  expect(t.swap - t.start).toBeGreaterThanOrEqual(470);
  expect(t.swap - t.start).toBeLessThan(1200);
  expect(await page.evaluate(() => (window as any).__sameDocument)).toBe(true);
  await expect(page).toHaveTitle('How it works / From idea to bulk / Full Circle');
  await expect(page.locator('#hdr')).not.toHaveClass(/open/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  if (!isPhone(info)) await expect(page.locator('header .nav a[href="/how-it-works"]')).toHaveClass(/on/);
  // back button returns home in the same document
  await page.goBack();
  await page.waitForURL((u) => u.pathname === '/');
  await expect(page.locator('.hero')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__sameDocument)).toBe(true);
  expect(errors).toEqual([]);
});

test('a link to the page you are on does nothing, as in the prototype', async ({ page }) => {
  await page.goto('/request-a-sample?product=Denim');
  await scrollToY(page, 600);
  await page.locator('footer a[href="/request-a-sample"]').click();
  await page.waitForTimeout(700);
  await expect(page.locator('#wipe')).toHaveClass(/^wipe$/);
  expect(await page.evaluate(() => Math.round(scrollY))).toBeGreaterThan(400);
});

test('a link to an anchor on another page lands on it', async ({ page }) => {
  await page.goto('/about');
  await page.locator('footer a[href="/#faq"]').click();
  await page.waitForURL('**/#faq');
  await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('faq')!.getBoundingClientRect().top)), { timeout: 4000 }).toBeLessThan(120);
});

test('header hides on scroll down and comes back on scroll up', async ({ page }) => {
  await page.goto('/about');
  await scrollBy(page, 900);
  await expect(page.locator('#hdr')).toHaveClass(/up/);
  await scrollBy(page, -300);
  await expect(page.locator('#hdr')).not.toHaveClass(/up/);
});

test('phone: full-screen menu opens, closes with Escape, and the bottom bar shows', async ({ page }, info) => {
  test.skip(!isPhone(info), 'phone only');
  await page.goto('/');
  await expect(page.locator('#mbar')).toHaveClass(/show/);
  await page.locator('#burger').click();
  await expect(page.locator('#hdr')).toHaveClass(/open/);
  await expect(page.locator('#burger')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mbar')).not.toHaveClass(/show/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#hdr')).not.toHaveClass(/open/);
  await expect(page.locator('#mbar')).toHaveClass(/show/);
});

test('desktop: the bottom bar stays out of the way', async ({ page }, info) => {
  test.skip(isPhone(info), 'desktop only');
  await page.goto('/');
  await expect(page.locator('#mbar')).toBeHidden();
});

test('home: What we make, the photo you point at grows and the others step back (pointer), the middle card is the big one (phone)', async ({ page }, info) => {
  await page.goto('/');
  const cards = page.locator('#makeGrid .cat');
  await cards.first().scrollIntoViewIfNeeded();
  if (isPhone(info)) {
    await page.locator('#makeGrid').evaluate((r) => { r.scrollLeft = (r.children[2] as HTMLElement).offsetLeft - (r.clientWidth - (r.children[2] as HTMLElement).offsetWidth) / 2; });
    await expect(cards.nth(2)).toHaveClass(/\bon\b/);
    await expect(cards.first()).not.toHaveClass(/\bon\b/);
    expect(Number(await cards.nth(2).evaluate((e) => (e as HTMLElement).style.getPropertyValue('--s')))).toBeGreaterThan(0.99);
    expect(Number(await cards.first().evaluate((e) => (e as HTMLElement).style.getPropertyValue('--s')))).toBeLessThan(0.9);
    return;
  }
  const w = (i: number) => cards.nth(i).evaluate((e) => e.getBoundingClientRect().width);
  const rest = await w(0);
  expect(Math.abs((await w(5)) - rest)).toBeLessThan(2);
  await cards.nth(2).hover();
  await expect.poll(() => w(2), { timeout: 5000 }).toBeGreaterThan(rest * 2);
  await expect.poll(() => w(0), { timeout: 5000 }).toBeLessThan(rest);
  await page.mouse.move(5, 5);
  await expect.poll(() => w(2), { timeout: 5000 }).toBeLessThan(rest * 1.1);
  // a card with keyboard focus is the one open once the mouse leaves the row
  await cards.nth(1).focus();
  await cards.nth(4).hover();
  await expect(cards.nth(4)).toHaveClass(/\bon\b/);
  await page.mouse.move(5, 5);
  await expect(cards.nth(1)).toHaveClass(/\bon\b/);
  await expect(cards.nth(4)).not.toHaveClass(/\bon\b/);
});

test('home: the How it works ring fills with scroll and closes as the mark', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const pinned = await page.evaluate(() => getComputedStyle(document.getElementById('howPin')!).position === 'sticky');
  test.skip(!pinned, 'short screens use the click-through fallback');
  const at = (f: number) => page.evaluate((frac) => {
    const t = document.getElementById('howScroll')!, pin = document.getElementById('howPin')!;
    window.scrollTo({ top: t.getBoundingClientRect().top + scrollY + (t.offsetHeight - pin.offsetHeight) * frac, behavior: 'instant' });
  }, f);
  // the ring eases toward the scroll position frame by frame; software rendering in CI is slow
  const slow = { timeout: 20_000 };
  await at(0.55);
  await expect(page.locator('#howNum')).toHaveText('05', slow);
  await expect(page.locator('#steps .step').nth(4)).toHaveClass(/on/);
  // the photo of the stage sits behind the ring, and goes when the ring closes
  await expect(page.locator('#howPin .hbgs .bgimg.on')).toHaveAttribute('data-img', 'stage-05', slow);
  await expect(page.locator('#howPin .hbgs .bgimg.on')).toHaveCount(1);
  await at(1);
  await expect(page.locator('#h-how .howring')).toHaveClass(/done/, slow);
  await expect(page.locator('#howLbl')).toHaveText('Full circle');
});

test('home: 3D mark appears and is kept when you come back', async ({ page }, info) => {
  test.skip(isPhone(info), 'checked once, on desktop');
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  const worker = page.waitForEvent('worker');
  await page.goto('/');
  // the mesh is extruded off the main thread
  expect((await worker).url()).toMatch(/\/_astro\/hero-mesh\.worker[^/]*\.js$/);
  await expect(page.locator('.hero .ringwrap')).toHaveClass(/m3on/, { timeout: 60_000 });
  await page.evaluate(() => { (document.getElementById('mark3') as any).__kept = true; });
  await openNav(page, '/about', false);
  await page.waitForURL('**/about');
  await page.locator('header a.word').click();
  await page.waitForURL((u) => u.pathname === '/');
  await expect(page.locator('.hero .ringwrap')).toHaveClass(/m3on/);
  expect(await page.evaluate(() => (document.getElementById('mark3') as any).__kept)).toBe(true);
  expect(errors).toEqual([]);
});

/** Records every class the hero's ring wrapper takes, from the first one. */
async function recordMarkStates(page: Page) {
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const w = document.querySelector('.hero .ringwrap')!, seen = ((window as any).__marks = [w.className]);
    new MutationObserver(() => seen.push(w.className)).observe(w, { attributes: true, attributeFilter: ['class'] });
  }));
  return () => page.evaluate(() => (window as any).__marks as string[]);
}

test('home: once three.js is in, the 3D mark waits for a slow mesh build instead of falling back', async ({ page }, info) => {
  test.skip(isPhone(info), 'checked once, on desktop');
  test.setTimeout(120_000);
  const states = await recordMarkStates(page);
  // the worker's script arrives only after the 2.6s limit has passed (and the page is free to notice)
  await page.route(/\/_astro\/hero-mesh\.worker[^/]*\.js$/, async (route) => {
    await page.waitForFunction(() => performance.now() > 4000, null, { timeout: 60_000, polling: 100 });
    await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('.hero .ringwrap')).toHaveClass(/m3on/, { timeout: 60_000 });
  // from the moment it started waiting, the flat mark never showed (the wrapper was never without both)
  const seen = await states();
  const from = seen.findIndex((c) => /\bm3wait\b/.test(c));
  expect(from).toBeGreaterThanOrEqual(0);
  expect(seen.slice(from).filter((c) => !/\bm3(wait|on)\b/.test(c))).toEqual([]);
});

/** A screenshot of the element once it has stopped changing (the 3D mark eases toward its tilt). */
async function stillShot(target: Locator) {
  let last = await target.screenshot();
  for (let i = 0; i < 40; i++) {
    await target.page().waitForTimeout(400);
    const next = await target.screenshot();
    if (next.equals(last)) return PNG.sync.read(next);
    last = next;
  }
  throw new Error('the element never stopped changing');
}

/** Share of pixels that differ between two screenshots of the same size. */
const differ = (a: PNG, b: PNG) => pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0.1 }) / (a.width * a.height);

test('home: on a phone a finger turns the 3D mark sideways, and it settles back when let go', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'phone-390', 'checked once, on a phone');
  test.setTimeout(180_000);
  await page.goto('/');
  await expect(page.locator('.hero .ringwrap')).toHaveClass(/m3on/, { timeout: 90_000 });
  // only the mark: the grain and the lights behind it never stop moving
  await page.addStyleTag({ content: '*{visibility:hidden!important} canvas.mark3{visibility:visible!important}' });
  const mark = page.locator('canvas.mark3');
  const rest = await stillShot(mark);
  const box = (await mark.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await context.newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', dx = 0) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x + dx, y }] });
  await touch('touchStart');
  for (let dx = 5; dx <= 60; dx += 5) await touch('touchMove', dx);
  const turned = await stillShot(mark);
  // a sideways drag turns the mark (well past a slight tilt) and leaves the page where it was
  expect(differ(rest, turned)).toBeGreaterThan(0.1);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await touch('touchEnd');
  expect(differ(rest, await stillShot(mark))).toBeLessThan(0.005);
});

test('home: if the 3D mesh worker fails, the flat mark draws itself', async ({ page }) => {
  await page.route(/\/_astro\/hero-mesh\.worker[^/]*\.js$/, (route) => route.fulfill({ body: 'throw new Error("mesh worker off in this test")', contentType: 'text/javascript' }));
  await page.goto('/');
  await expect(page.locator('.hero .ringwrap')).not.toHaveClass(/m3wait/, { timeout: 60_000 });
  await expect(page.locator('.hero .ringwrap')).not.toHaveClass(/m3on/);
  await expect(page.locator('.hero svg.heromark')).toBeVisible();
});

test('home: without three.js the flat mark draws itself instead', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero .ringwrap')).not.toHaveClass(/m3wait/, { timeout: 5000 });
  await expect(page.locator('.hero svg.heromark')).toBeVisible();
});

test('home: portal demo approves and resets', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pApprove').click();
  await expect(page.locator('#pStamp')).toHaveClass(/show/);
  await expect(page.locator('#pChipT')).toHaveText('Approved');
  await expect(page.locator('#pLog')).toContainText('Sample 03 approved');
  await page.locator('#pApprove').click();
  await expect(page.locator('#pChipT')).toHaveText('Awaiting approval');
  await expect(page.locator('#pLog')).toBeHidden();
});

test('how it works: the sample gate holds production until you approve', async ({ page }, info) => {
  await page.goto('/how-it-works');
  // stage 06 sits a little above the line that picks the current stage (the count-up runs only
  // there); aligned to the top, a short stage 06 on a phone could hand over to stage 07
  await page.locator('.yo-st[data-i="5"]').evaluate((el) => scrollTo({ top: scrollY + el.getBoundingClientRect().top - innerHeight * 0.4, behavior: 'instant' }));
  await scrollBy(page, 60, 2);
  await expect(page.locator('#yoLabels > *').nth(5)).toHaveClass(/here/);
  await expect(page.locator('#toast')).toHaveText('Production is waiting on your approval');
  await expect(page.locator('#yoGate')).toBeVisible();
  await expect(page.locator('#yoNext')).toHaveText('Approve sample 03');
  await expect(page.locator('#yoTicket')).toHaveClass(/show/);
  if (isPhone(info)) await expect(page.locator('#mbar')).not.toHaveClass(/show/);
  await page.locator('[data-yoapprove]').click();
  await expect(page.locator('#yoGate')).toBeHidden();
  await expect(page.locator('#yoUnits')).toHaveText('300', { timeout: 5000 });
});

test('how it works: your demo choices carry over to the sample request', async ({ page }) => {
  await page.goto('/how-it-works');
  await page.locator('[data-yopath="Scaling"]').click();
  await page.locator('#yoProducts .opt', { hasText: 'Outerwear' }).click();
  // get there first (passing the gate shows its own toast), then ask for the real request
  await page.locator('#yoReal').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.locator('#yoReal').click();
  await page.waitForURL((u) => u.pathname === '/request-a-sample');
  await expect(page.locator('.q[data-k="path"] .opt', { hasText: 'Scaling' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.q[data-k="product"] .opt', { hasText: 'Jackets' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#toast')).toHaveText('Your choices are carried over');
});

test('request a sample: back and forward keep a pick changed after arriving', async ({ page }, info) => {
  await page.goto('/');
  await page.locator('.who-card a', { hasText: 'Move production to us' }).click();
  await page.waitForURL((u) => u.pathname === '/request-a-sample');
  await expect(page.locator('.q[data-k="path"] .opt', { hasText: 'Scaling' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.q[data-k="path"] .opt', { hasText: 'Starting' }).click();
  await expect(page.locator('.q[data-k="path"] .opt', { hasText: 'Starting' })).toHaveAttribute('aria-pressed', 'true');
  await openNav(page, '/about', isPhone(info));
  await page.waitForURL('**/about');
  await page.goBack();
  await page.waitForURL((u) => u.pathname === '/request-a-sample');
  await expect(page.locator('.q[data-k="path"] .opt', { hasText: 'Starting' })).toHaveAttribute('aria-pressed', 'true');
});

test('home and what we make: buttons start the request with the right pick', async ({ page }) => {
  await page.goto('/');
  await page.locator('.who-card a', { hasText: 'Move production to us' }).click();
  await page.waitForURL((u) => u.pathname === '/request-a-sample');
  await expect(page.locator('.q[data-k="path"] .opt', { hasText: 'Scaling' })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/what-we-make');
  await page.locator('#cat-denim a', { hasText: 'Request a sample for this' }).click();
  await page.waitForURL((u) => u.pathname === '/request-a-sample');
  await expect(page.locator('.q[data-k="product"] .opt', { hasText: 'Denim' })).toHaveAttribute('aria-pressed', 'true');
});

test('what we make: category buttons jump to their panel', async ({ page }) => {
  await page.goto('/what-we-make');
  await page.locator('#catNav [data-cat="knit"]').click();
  await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('cat-knit')!.getBoundingClientRect().top)), { timeout: 4000 }).toBeLessThan(140);
});

test('request a sample: checks, counts picks, and confirms with a code', async ({ page }, info) => {
  await page.goto('/request-a-sample');
  if (isPhone(info)) await expect(page.locator('#mbarGo')).toHaveText('Continue / 0 of 4 picked');
  await page.locator('#send').click();
  await expect(page.locator('#err')).toHaveText('Pick the brand stage and a product');
  for (const [k, v] of [['path', 'Starting'], ['product', 'Denim'], ['qty', '60–150'], ['have', 'A sketch']]) await clickStill(page.locator(`.q[data-k="${k}"] .opt`, { hasText: v }));
  await expect(page.locator('#qtyWarn')).toBeVisible();
  await expect(page.locator('#meter i.on')).toHaveCount(4);
  if (isPhone(info)) await expect(page.locator('#mbarGo')).toHaveText('Add your details');
  await page.locator('#send').click();
  await expect(page.locator('#err')).toHaveText('Add the brand name');
  await page.locator('#fBrand').fill('Acme Studio');
  await page.locator('#fContact').fill('hello@acme.test');
  // clicked once still: a scroll after sending hides the phone bar
  await clickStill(page.locator('#send'));
  await expect(page.locator('.sent-box')).toBeVisible();
  await expect(page.locator('#sentCode')).toHaveText(/^FC-\d{4}$/);
  if (isPhone(info)) {
    // the bar reads "Request sent" until the next scroll, then slides away
    await expect(page.locator('#mbarGo')).toHaveText('Request sent');
    await expect(page.locator('#mbar')).toHaveClass(/show/);
    await scrollBy(page, 120, 3);
    await expect(page.locator('#mbar')).not.toHaveClass(/show/);
  }
});

test('request a sample: only real options are taken from the link', async ({ page }) => {
  let dialog = false;
  page.on('dialog', (d) => { dialog = true; d.dismiss(); });
  await page.goto('/request-a-sample?product=%3Cimg%20src%3Dx%20onerror%3D%22alert(1)%22%3E&path=Martian');
  await page.waitForTimeout(800);
  expect(dialog).toBe(false);
  await expect(page.locator('#srows .srow .empty')).toHaveCount(4);
  await expect(page.locator('#srows img')).toHaveCount(0);
  await page.goto('/request-a-sample?path=Scaling&product=Knitwear');
  await expect(page.locator('#srows')).toContainText('Scaling');
  await expect(page.locator('#srows')).toContainText('Knitwear');
});

test('request a sample: picks and typing survive a trip to another page', async ({ page }, info) => {
  await page.goto('/request-a-sample');
  await page.locator('.q[data-k="path"] .opt', { hasText: 'Starting' }).click();
  await page.locator('#fBrand').fill('Acme Studio');
  await openNav(page, '/about', isPhone(info));
  await page.waitForURL('**/about');
  if (isPhone(info)) await page.locator('#mbarGo').click(); else await page.locator('header .hdr-r a.btn-red').click();
  await page.waitForURL((u) => u.pathname === '/request-a-sample');
  await expect(page.locator('.q[data-k="path"] .opt', { hasText: 'Starting' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#fBrand')).toHaveValue('Acme Studio');
});

test('track: sign-in by code, order view and approval', async ({ page }) => {
  const { calls } = await mockPortal(page);
  await page.goto('/track');
  await page.locator('#tSendCode').click();
  await expect(page.locator('#tErr')).toHaveText('Add the email or WhatsApp number on your order');
  await page.locator('#tId').fill('Laila@Demo.test');
  await page.locator('#tSendCode').click();
  await expect(page.locator('#tLoginH')).toHaveText('Enter the code');
  // the code goes to existing people only, and the page does not say whether the email is known
  expect(calls.find((c) => c.fn === 'auth/otp')!.body).toMatchObject({ email: 'laila@demo.test', create_user: false });
  await page.locator('#tCode').fill('12345');
  await page.locator('#tVerify').click();
  await expect(page.locator('#tErr')).toHaveText('Enter the 6 digits from the message');
  await page.locator('#tCode').fill('000000');
  await page.locator('#tVerify').click();
  await expect(page.locator('#tErr')).toHaveText('That code is wrong or has expired. Check it, or send a new one');
  await page.locator('#tCode').fill('123456');
  await page.locator('#tVerify').click();
  await expect(page.locator('#tOrders')).toBeVisible();
  await expect(page.locator('#tWho')).toHaveText('Signed in / Demo Studio');
  await expect(page.locator('#tList .ord')).toHaveCount(3);
  await expect(page.locator('#tList .ord').first()).toContainText('Approve sample 03');
  await page.locator('#tList .ord').first().click();
  await expect(page.locator('#tTitle')).toHaveText('FC-2418.');
  await expect(page.locator('#oPhotos .ph')).toHaveCount(3);
  await expect(page.locator('#oPhotos img.ok')).toHaveCount(3);
  await page.locator('#oApprove').click();
  await expect(page.locator('#oDecision')).toHaveClass(/done/);
  expect(calls.find((c) => c.fn === 'approve_decision')!.body).toEqual({ p_decision: 11 });
  await expect(page.locator('#oDecT')).toHaveText('Approved');
  // approving does not move the stage: staff do (docs/adr/0005)
  await expect(page.locator('#oNum')).toHaveText('05');
  await page.locator('.tabs2 [data-tab="log"]').click();
  await expect(page.locator('#oLog tr').first()).toContainText('Approve sample 03 / approved');
  await expect(page.locator('#oLog tr').first()).toContainText('You');
  await page.locator('#tAll').click();
  await expect(page.locator('#tList .ord').first()).toContainText('Approved / waiting on us');
});

test('track: a session is kept, order updates on WhatsApp can be turned on, and sign-out ends it', async ({ page }) => {
  const { calls } = await mockPortal(page);
  await page.goto('/track');
  await signInPortal(page);
  await page.reload();
  await expect(page.locator('#tList .ord')).toHaveCount(3);
  await page.locator('#tUpdates').check();
  await expect.poll(() => calls.find((c) => c.fn === 'set_updates_consent')?.body).toEqual({ p_channel: 'whatsapp', p_opted_in: true, p_wording: NOTICE.whatsappUpdates, p_version: NOTICE.version });
  await page.locator('#tOut').click();
  await expect(page.locator('#tLogin')).toBeVisible();
  await page.reload();
  await expect(page.locator('#tLogin')).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('track: a WhatsApp number asks for its code on WhatsApp, and says so when that is not switched on or does not go', async ({ page }) => {
  await mockPortal(page);
  // this route comes after mockPortal's, so it answers every code request: it keeps what was asked
  const asked: Record<string, unknown>[] = [];
  await page.route(/\/auth\/v1\/otp$/, (route) => {
    asked.push(route.request().postDataJSON());
    return route.fulfill(asked.length === 1
      ? { status: 400, json: { code: 400, error_code: 'phone_provider_disabled', msg: 'Unsupported phone provider' } }
      : { status: 422, json: { code: 422, msg: 'whatsapp_send_failed: WhatsApp did not take the message' } });
  });
  await page.goto('/track');
  await page.locator('#tId').fill('0101 143 5406');
  await page.locator('#tSendCode').click();
  await expect(page.locator('#tErr')).toHaveText('Codes on WhatsApp are not switched on yet. Use the email on your order');
  expect(asked).toHaveLength(1);
  expect(asked[0]).toMatchObject({ phone: '+201011435406', channel: 'whatsapp', create_user: false });
  // switched on, but WhatsApp would not take it (the send-sms function's answer, through Auth)
  await page.locator('#tSendCode').click();
  await expect(page.locator('#tErr')).toHaveText('Could not send a code on WhatsApp. Check the number, or use the email on your order');
  // too short to be a number: nothing is asked
  await page.locator('#tId').fill('5406');
  await page.locator('#tSendCode').click();
  await expect(page.locator('#tErr')).toHaveText('Add the email or WhatsApp number on your order');
  expect(asked).toHaveLength(2);
});

test('contact: copy, and the form checks before sending', async ({ page }) => {
  await page.goto('/contact');
  await page.locator('#cForm button[type=submit]').click();
  await expect(page.locator('#cErr')).toHaveText('Fill in your name, contact and message');
  await page.locator('#cName').fill('Sara');
  await page.locator('#cReach').fill('+20 100 000 0000');
  await page.locator('#cMsg').fill('Hello');
  await page.locator('#cForm button[type=submit]').click();
  await expect(page.locator('#cDone')).toBeVisible();
  await expect(page.locator('#cForm')).toBeHidden();
});

test('links from the prototype (/#how) land on the real pages', async ({ page }) => {
  await page.goto('/#how');
  await page.waitForURL('**/how-it-works');
  await page.goto('/#cat-denim');
  await page.waitForURL('**/what-we-make#cat-denim');
});

test('reduced motion: no wipe, and the hero ring is shown complete', async ({ browser }, info) => {
  test.skip(isPhone(info), 'checked once, on desktop');
  const ctx = await browser.newContext({ viewport: info.project.use.viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${info.project.use.baseURL}/`);
  await expect(page.locator('#heroArc')).toHaveCSS('stroke-dashoffset', '14px');
  await expect(page.locator('#heroLabels .st.on')).toHaveCount(8);
  // the dot is back at the top, where the circle closes
  await expect(page.locator('#heroDot')).toHaveAttribute('cx', '200');
  await expect(page.locator('#heroDot')).toHaveAttribute('cy', '50');
  await page.locator('header .nav a[href="/about"]').click();
  await page.waitForURL('**/about');
  await expect(page.locator('#wipe')).toBeHidden();
  await ctx.close();
});

test.describe('pages you come back to (the prototype was one document)', () => {
  test('home is drawn at the first stage before any script runs', async ({ browser }, info) => {
    const ctx = await browser.newContext({ viewport: info.project.use.viewport, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${info.project.use.baseURL}/`);
    await expect(page.locator('#heroArc')).toHaveCSS('stroke-dashoffset', '87.5px');
    await expect(page.locator('#heroLabels .st.on')).toHaveCount(1);
    await ctx.close();
  });

  test('the flat mark shows straight away on a return when three.js is unavailable', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.locator('.hero .ringwrap')).not.toHaveClass(/m3wait/, { timeout: 6000 });
    await openNav(page, '/about', isPhone(info));
    await page.waitForURL('**/about');
    await page.locator('header a.word').click();
    await page.waitForURL((u) => u.pathname === '/');
    await expect(page.locator('.hero .ringwrap')).not.toHaveClass(/m3wait/, { timeout: 1500 });
  });

  test('reveals replay, FAQ answers stay open, carousels keep their place', async ({ page }, info) => {
    await page.goto('/');
    const fact = page.locator('.facts > div').first();
    await fact.scrollIntoViewIfNeeded();
    await expect(fact).toHaveClass(/rv in/);
    await page.locator('#faqList summary').nth(1).click();
    await expect(page.locator('#faqList details').nth(1)).toHaveAttribute('open', '');
    if (isPhone(info)) await page.locator('#makeGrid').evaluate((r) => { r.scrollLeft = 300; });
    await page.waitForTimeout(300);
    await openNav(page, '/contact', isPhone(info));
    await page.waitForURL('**/contact');
    await page.locator('header a.word').click();
    await page.waitForURL((u) => u.pathname === '/');
    await expect(fact).toHaveClass(/rv in/);
    await expect(page.locator('#faqList details').nth(1)).toHaveAttribute('open', '');
    if (isPhone(info)) expect(await page.locator('#makeGrid').evaluate((r) => r.scrollLeft)).toBeGreaterThan(150);
  });

  test('the demo count-up finishes even if you leave mid-way', async ({ page }, info) => {
    await page.goto('/how-it-works');
    await page.locator('#yoApprove').click();
    // stage 06 is current when its top is above the middle of the screen and stage 07's is not
    await page.locator('.yo-st[data-i="5"]').evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - innerHeight * 0.45, behavior: 'instant' }));
    await scrollBy(page, 20, 2);
    await expect(page.locator('#yoStage')).toHaveText('06 / Production');
    await expect(page.locator('#yoUnits')).not.toHaveText('000');
    await openNav(page, '/about', isPhone(info));
    await page.waitForURL('**/about');
    await page.goBack();
    await page.waitForURL('**/how-it-works');
    await expect(page.locator('#yoUnits')).toHaveText('300', { timeout: 6000 });
  });

  test('a reload starts at the top, without scrolling through the page', async ({ page }) => {
    await page.goto('/how-it-works');
    await page.locator('.yo-st[data-i="7"]').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(800);
    await page.reload();
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => scrollY)).toBeLessThan(5);
    await expect(page.locator('#toast')).not.toHaveClass(/show/);
  });
});

test('request and track: errors and a pending photo survive a trip to another page', async ({ page }, info) => {
  await page.goto('/request-a-sample');
  await page.locator('#send').click();
  await expect(page.locator('#err')).toHaveText('Pick the brand stage and a product');
  await openNav(page, '/about', isPhone(info));
  await page.waitForURL('**/about');
  await page.goBack();
  await page.waitForURL((u) => u.pathname === '/request-a-sample');
  await expect(page.locator('#err')).toHaveText('Pick the brand stage and a product');

  await mockPortal(page);
  await page.goto('/track');
  await signInPortal(page);
  await page.locator('#tList .ord').first().click();
  await page.locator('#oPhoto').click();
  await expect(page.locator('#oPhoto')).toBeDisabled();
  await openNav(page, '/about', isPhone(info));
  await page.waitForURL('**/about');
  await page.goBack();
  await page.waitForURL('**/track');
  // still on the order, and the photo is still on its way (staff answer it from the admin)
  await expect(page.locator('#tTitle')).toHaveText('FC-2418.');
  await expect(page.locator('#oPhoto')).toBeDisabled();
  await expect(page.locator('#oLog tr').first()).toContainText('Photo requested / Sampling');
});

test('links back to the page you are on: from an anchor, and on Home, go to the top', async ({ page }, info) => {
  await page.goto('/');
  await page.locator('#makeGrid a.cat').nth(3).click();
  await page.waitForURL('**/what-we-make#cat-shirts');
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 4000 }).toBeGreaterThan(300);
  await page.locator('footer a[href="/what-we-make"]').click();
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 10_000 }).toBeLessThan(5);
  expect(new URL(page.url()).hash).toBe('');
  await expect(page.locator('#wipe')).toHaveClass(/^wipe$/);
  await page.goto('/');
  await scrollToY(page, 1800);
  if (isPhone(info)) { await page.locator('#burger').click(); await page.locator('.mmenu a[href="/"]').click(); }
  else await page.locator('footer a.word').click();
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 10_000 }).toBeLessThan(5);
});

test('a page opened while a smooth scroll is running starts at the top', async ({ page }, info) => {
  test.skip(isPhone(info), 'checked once, on desktop');
  await page.goto('/what-we-make');
  await page.locator('#catNav [data-cat="knit"]').click();
  await page.waitForTimeout(120);
  await page.locator('header .hdr-r a.btn-red').click();
  await page.waitForURL((u) => u.pathname === '/request-a-sample');
  await expect(page.locator('#wipe')).toHaveClass(/^wipe$/, { timeout: 4000 });
  expect(await page.evaluate(() => scrollY)).toBeLessThan(5);
});

test('a new page can be scrolled at once, while the wipe is still going', async ({ page }, info) => {
  test.skip(isPhone(info), 'checked once, on desktop');
  await page.goto('/what-we-make');
  await page.locator('header .hdr-r a.btn-red').click();
  await page.waitForURL((u) => u.pathname === '/request-a-sample');
  await expect(page.locator('#wipe')).toHaveClass(/ring/);
  await page.mouse.wheel(0, 400);
  await expect(page.locator('#wipe')).toHaveClass(/^wipe$/, { timeout: 4000 });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
});

test('a stray % in the address does not stop the page', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto('/about#%');
  await page.waitForTimeout(500);
  if (isPhone(info)) { await page.locator('#burger').click(); await expect(page.locator('#hdr')).toHaveClass(/open/); }
  expect(errors).toEqual([]);
});

test('contact: the error line is kept when you come back', async ({ page }, info) => {
  await page.goto('/contact');
  await page.locator('#cName').fill('Sara');
  await page.locator('#cForm button[type=submit]').click();
  await expect(page.locator('#cErr')).toHaveText('Fill in your name, contact and message');
  await openNav(page, '/about', isPhone(info));
  await page.waitForURL('**/about');
  await page.goBack();
  await page.waitForURL('**/contact');
  await expect(page.locator('#cErr')).toHaveText('Fill in your name, contact and message');
  await expect(page.locator('#cName')).toHaveValue('Sara');
});

test('a photo slot reads "Photo" until its photo has loaded', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await page.route(/\/_astro\/cat-denim[^/]*\.(avif|webp|jpg)$/, async (route) => { await gate; await route.continue(); });
  await page.goto('/what-we-make', { waitUntil: 'domcontentloaded' });
  const cap = page.locator('#cat-denim .cap span', { hasText: 'Photo' });
  await expect(cap).toBeVisible();
  release();
  await expect(cap).toBeHidden({ timeout: 10_000 });
});

// Accessibility fixes from the site audit (docs/audits/2026-10-08-site-audit.md, fix plan A).
test.describe('accessibility', () => {
  test('a skip link appears on the first Tab and moves past the header', async ({ page }) => {
    await page.goto('/about');
    const skip = page.locator('a.skip');
    expect(await skip.evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    // it slides in (the buttons' transform transition)
    await expect.poll(() => skip.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('phone: the open menu shuts out the page behind it, and Escape returns to the burger', async ({ page }, info) => {
    test.skip(!isPhone(info), 'phone only');
    await page.goto('/');
    await page.locator('#burger').click();
    await expect(page.locator('#hdr')).toHaveClass(/open/);
    for (const sel of ['main', 'footer', '#mbar']) expect(await page.locator(sel).evaluate((el) => (el as HTMLElement).inert)).toBe(true);
    await expect(page.locator('.mmenu')).toHaveCSS('overflow-y', 'auto');
    await page.keyboard.press('Escape');
    await expect(page.locator('#burger')).toBeFocused();
    for (const sel of ['main', 'footer', '#mbar']) expect(await page.locator(sel).evaluate((el) => (el as HTMLElement).inert)).toBe(false);
  });

  test('request a sample: questions are named groups, and errors point at their fields', async ({ page }) => {
    await page.goto('/request-a-sample');
    await expect(page.getByRole('group', { name: '01 / The brand is' })).toBeVisible();
    await expect(page.getByRole('group', { name: '02 / Product' }).getByRole('button')).toHaveCount(7);
    await page.locator('#send').click();
    // a missing pick: focus on its first option, the group described by the error line
    await expect(page.locator('#opts-path .opt').first()).toBeFocused();
    await expect(page.locator('#opts-path')).toHaveAttribute('aria-describedby', 'err');
    await expect(page.locator('#opts-product')).toHaveAttribute('aria-describedby', 'err');
    await clickStill(page.locator('#opts-path .opt', { hasText: 'Starting' }));
    await clickStill(page.locator('#opts-product .opt', { hasText: 'Tees' }));
    await clickStill(page.locator('#send'));
    await expect(page.locator('#fBrand')).toBeFocused();
    await expect(page.locator('#fBrand')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#fBrand')).toHaveAttribute('aria-describedby', 'err');
    await expect(page.locator('#opts-path')).not.toHaveAttribute('aria-describedby');
    await page.locator('#fBrand').fill('Acme Studio');
    await page.locator('#fContact').fill('hello@acme.test');
    await clickStill(page.locator('#send'));
    await expect(page.locator('#sentH')).toBeFocused();
    await expect(page.locator('#fBrand')).not.toHaveAttribute('aria-invalid');
  });

  test('contact: every missing field is marked, focus goes to the first, then to "Sent."', async ({ page }) => {
    await page.goto('/contact');
    await page.locator('#cName').fill('Sara');
    await page.locator('#cForm button[type=submit]').click();
    await expect(page.locator('#cReach')).toBeFocused();
    for (const id of ['cReach', 'cMsg']) await expect(page.locator(`#${id}`)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#cName')).not.toHaveAttribute('aria-invalid');
    await page.locator('#cReach').fill('+20 100 000 0000');
    await page.locator('#cMsg').fill('Hello');
    await page.locator('#cForm button[type=submit]').click();
    await expect(page.locator('#cDoneH')).toBeFocused();
  });

  test('track: focus follows the view, and the tabs work with arrow keys', async ({ page }) => {
    await mockPortal(page);
    await page.goto('/track');
    await page.locator('#tSendCode').click();
    await expect(page.locator('#tId')).toBeFocused();
    await expect(page.locator('#tId')).toHaveAttribute('aria-invalid', 'true');
    await page.locator('#tId').fill('laila@demo.test');
    await page.locator('#tSendCode').click();
    await expect(page.locator('#tCode')).toBeFocused();
    await page.locator('#tCode').fill('123456');
    await page.keyboard.press('Enter');
    await expect(page.locator('#tTitle')).toBeFocused();
    await page.locator('#tList .ord').first().waitFor();
    await page.locator('#tList .ord').first().click();
    await expect(page.locator('#tTitle')).toBeFocused();
    await page.locator('#oApprove').click();
    await expect(page.locator('#oDecH')).toBeFocused();
    const tab = (name: string) => page.getByRole('tab', { name });
    await tab('Photos').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab('Specs')).toBeFocused();
    await expect(tab('Specs')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Specs' })).toBeVisible();
    await page.keyboard.press('End');
    await expect(tab('Approval log')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tab('Photos')).toBeFocused();
    await expect(page.getByRole('tabpanel', { name: 'Photos' })).toBeVisible();
    await expect(page.locator('.tabs2 [tabindex="0"]')).toHaveCount(1);
  });
});

// Mazen's decisions on the site audit, part B (docs/audits/2026-10-08-site-audit.md). The parity
// suite covers how they look; these cover how they behave.
test.describe('approved changes', () => {
  test('home: the hero ring fills once and rests on the full circle', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.clock.runFor(8 * 1100);
    await expect(page.locator('#heroLabels .st.on')).toHaveCount(8);
    await expect(page.locator('#heroArc')).toHaveCSS('stroke-dashoffset', '0px');
    await expect(page.locator('#heroDot')).toHaveAttribute('cy', '50');
    // and it does not start again
    await page.clock.runFor(5000);
    await expect(page.locator('#heroLabels .st.on')).toHaveCount(8);
  });

  test('every field has a visible label above it', async ({ page }) => {
    for (const [route, names] of [
      ['/request-a-sample', ['Brand name', 'Email or WhatsApp', 'Notes (optional)']],
      ['/contact', ['Your name', 'Email or WhatsApp', 'Message']],
      ['/track', ['Email or WhatsApp number']],
    ] as const) {
      await page.goto(route);
      for (const name of names) {
        await expect(page.getByLabel(name, { exact: true })).toBeVisible();
        await expect(page.locator('label.flabel', { hasText: name })).toBeVisible();
      }
    }
  });

  test('phone: option buttons are at least 44px tall', async ({ page }, info) => {
    test.skip(!isPhone(info), 'phone only');
    await page.goto('/request-a-sample');
    // the laid-out height: a box measured while the page's entrance still moves it can read 43.99997
    expect(await page.locator('.opt').first().evaluate((e) => parseFloat(getComputedStyle(e).height))).toBeGreaterThanOrEqual(44);
  });

  test('an error line is Bone with a red dot, and the dot shows only with a message', async ({ page }) => {
    await page.goto('/request-a-sample');
    const err = page.locator('#err');
    expect(await err.evaluate((e) => getComputedStyle(e, '::before').content)).toBe('none');
    await page.locator('#send').click();
    await expect(err).toHaveText('Pick the brand stage and a product');
    await expect(err).toHaveCSS('color', 'rgb(232, 226, 216)');
    expect(await err.evaluate((e) => getComputedStyle(e, '::before').backgroundColor)).toBe('rgb(197, 50, 43)');
  });

  test('track: the decision label carries the red dot only while a decision is waiting', async ({ page }) => {
    await mockPortal(page);
    await page.goto('/track');
    await signInPortal(page);
    await page.locator('#tList .ord').first().click();
    await expect(page.locator('#oDecT')).toHaveClass(/\bneed\b/);
    await page.locator('#oApprove').click();
    await expect(page.locator('#oDecT')).toHaveText('Approved');
    await expect(page.locator('#oDecT')).not.toHaveClass(/\bneed\b/);
    await page.locator('#tAll').click();
    await page.locator('#tList .ord').nth(1).click();
    await expect(page.locator('#oDecT')).toHaveText('Next decision');
    await expect(page.locator('#oDecT')).not.toHaveClass(/\bneed\b/);
  });

  test('search titles, and product photos described where no link names them', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Full Circle / Clothing manufacturer in Cairo, Egypt');
    await expect(page.locator('.promise .ph img').first()).toHaveAttribute('alt', /black hoodie sample/);
    await expect(page.locator('#makeGrid img').first()).toHaveAttribute('alt', '');
    await page.goto('/what-we-make');
    await expect(page.locator('#cat-denim img')).toHaveAttribute('alt', /washed wide-leg jeans/);
  });

  test('search engines and shares: the address on the domain, the share card, the business, the sitemap', async ({ page, request }) => {
    await page.goto('/about');
    const head = (sel: string, attr = 'content') => page.locator(`head ${sel}`).getAttribute(attr);
    expect(await head('link[rel=canonical]', 'href')).toBe('https://fullcircle-co.com/about');
    expect(await head('meta[property="og:url"]')).toBe('https://fullcircle-co.com/about');
    expect(await head('meta[property="og:title"]')).toBe(await page.title());
    expect(await head('meta[property="og:description"]')).toBe(await head('meta[name=description]'));
    expect(await head('meta[property="og:image"]')).toBe('https://fullcircle-co.com/og.jpg');
    expect((await request.get('/og.jpg')).headers()['content-type']).toBe('image/jpeg');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    // the business, on Home
    await page.goto('/');
    const org = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(org).toMatchObject({ '@type': 'Organization', name: 'Full Circle', url: 'https://fullcircle-co.com/', telephone: '+20226987277', address: { addressLocality: 'Cairo', addressCountry: 'EG' } });
    expect(await head('link[rel=canonical]', 'href')).toBe('https://fullcircle-co.com/');
    // moving to another page without a reload swaps them too
    await clickStill(page.locator('footer a[href="/about"]').first());
    await page.waitForURL('**/about');
    await expect.poll(() => head('link[rel=canonical]', 'href')).toBe('https://fullcircle-co.com/about');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    // a missing page is not indexed
    await page.goto('/no-such-page');
    expect(await head('meta[name=robots]')).toBe('noindex');
    await expect(page.locator('head link[rel=canonical]')).toHaveCount(0);
    // every page in the menu is in the sitemap; the admin is kept out of search
    const sitemap = await (await request.get('/sitemap.xml')).text();
    for (const p of ['/', '/how-it-works', '/what-we-make', '/about', '/request-a-sample', '/track', '/contact', '/privacy']) expect(sitemap).toContain(`<loc>https://fullcircle-co.com${p}</loc>`);
    expect(sitemap).not.toContain('admin');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Sitemap: https://fullcircle-co.com/sitemap.xml');
  });
});

test.describe('the forms send to the backend', () => {
  /** Fills the request form: four picks, the brand and a contact. */
  async function fillRequest(page: Page, contact: string) {
    for (const [k, v] of [['path', 'Scaling'], ['product', 'Denim'], ['qty', '60–150'], ['have', 'A sketch']]) await clickStill(page.locator(`.q[data-k="${k}"] .opt`, { hasText: v }));
    await page.locator('#fBrand').fill('Acme Studio');
    await page.locator('#fContact').fill(contact);
  }

  test('request: the picks, contact, opt-in and source go to the function, its code shows, and WhatsApp opens with it', async ({ page }) => {
    const sent = await mockBackend(page);
    await page.goto('/request-a-sample');
    await fillRequest(page, 'hello@acme.test');
    // an email: no WhatsApp line or opt-in
    await expect(page.locator('#waOpt')).toBeHidden();
    await page.locator('#fContact').fill('0101 143 5406');
    await expect(page.locator('#waOpt')).toBeVisible();
    await expect(page.locator('#waOpt')).toContainText(NOTICE.whatsappReply);
    await expect(page.locator('#fWaUpdates')).not.toBeChecked();
    await page.locator('#fWaUpdates').check();
    await page.locator('#fNote').fill('Raw selvedge');
    // requests take no files: they come later, on WhatsApp
    await expect(page.locator('input[type=file]')).toHaveCount(0);
    await expect(page.locator('#sentWa')).toBeHidden();
    await clickStill(page.locator('#send'));
    await expect(page.locator('#sentCode')).toHaveText('FC-2501');
    await expect(page.locator('#reqCode')).toHaveText('FC-2501');
    expect(sent).toHaveLength(1);
    const data = postedData(sent[0]);
    expect(data).toMatchObject({
      path: 'Scaling', product: 'Denim', qty: '60–150', have: 'A sketch', brand: 'Acme Studio', contact: '0101 143 5406', note: 'Raw selvedge',
      whatsappUpdates: true, notice: NOTICE.version, turnstile: 'XXXX.DUMMY.TOKEN.XXXX',
    });
    // where the visitor came from: here, straight to the form
    expect(data.source).toEqual({ landing: '/request-a-sample' });
    // once sent, the conversation carries on on WhatsApp, with the code ready to send
    await expect(page.locator('#sentWa')).toBeVisible();
    await expect(page.locator('#sentWa')).toHaveText('Continue on WhatsApp');
    await expect(page.locator('#sentWa')).toHaveAttribute('href', 'https://wa.me/201011435406?text=Hi%20Full%20Circle%2C%20I%20just%20sent%20sample%20request%20FC-2501%20(Acme%20Studio).');
    await expect(page.locator('#sentWa')).toHaveAttribute('target', '_blank');
    // once sent, the picks cannot change and the request is not sent twice
    expect(await page.locator('#qs').evaluate((e) => (e as HTMLElement).inert)).toBe(true);
    await expect(page.locator('#send')).toBeHidden();
  });

  test('request: ad tags from the first page travel with the request', async ({ page }, info) => {
    const sent = await mockBackend(page);
    await page.goto('/what-we-make?utm_source=instagram&utm_campaign=denim-drop');
    // to the form without a full load, as a visitor would
    if (isPhone(info)) await page.locator('#mbarGo').click(); else await page.locator('header .hdr-r a.btn-red').click();
    await page.waitForURL((u) => u.pathname === '/request-a-sample');
    await fillRequest(page, 'hello@acme.test');
    await clickStill(page.locator('#send'));
    await expect(page.locator('#sentCode')).toHaveText('FC-2501');
    expect(postedData(sent[0]).source).toEqual({ utm_source: 'instagram', utm_campaign: 'denim-drop', landing: '/what-we-make' });
    expect(postedData(sent[0]).whatsappUpdates).toBeUndefined();
  });

  test('request: the server can turn it away, and a failed send can be tried again', async ({ page }) => {
    let n = 0;
    await mockBackend(page, () => (++n === 1 ? { status: 400, json: { error: ERRORS.contact, field: 'contact' } } : n === 2 ? { abort: true } : { delayMs: 600 }));
    await page.goto('/request-a-sample');
    await fillRequest(page, 'hello@acme.test');
    await clickStill(page.locator('#send'));
    await expect(page.locator('#err')).toHaveText(ERRORS.contact);
    await expect(page.locator('#fContact')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#fContact')).toBeFocused();
    await clickStill(page.locator('#send'));
    await expect(page.locator('#err')).toHaveText(ERRORS.failed);
    await expect(page.locator('#send')).toHaveText('Request a sample');
    // while it is on its way, the button says so and a second press does nothing
    await page.locator('#send').click();
    await expect(page.locator('#send')).toHaveText('Sending…');
    await expect(page.locator('#send')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('#send').click({ force: true });
    await expect(page.locator('#sentCode')).toHaveText('FC-2501');
    expect(n).toBe(3);
    await expect(page.locator('#err')).toHaveText('');
  });

  test('request: a contact that is neither an email nor a number is caught', async ({ page }) => {
    await page.goto('/request-a-sample');
    await fillRequest(page, 'call me maybe');
    await clickStill(page.locator('#send'));
    await expect(page.locator('#err')).toHaveText(ERRORS.contact);
  });

  test('a send that ends after leaving the page shows on the way back', async ({ page }, info) => {
    await mockBackend(page, () => ({ delayMs: 1500 }));
    await page.goto('/request-a-sample');
    await fillRequest(page, 'hello@acme.test');
    await clickStill(page.locator('#send'));
    await expect(page.locator('#send')).toHaveText('Sending…');
    await openNav(page, '/about', isPhone(info));
    await page.waitForURL('**/about');
    await expect(page.locator('#toast')).toHaveText('FC-2501 / request received', { timeout: 5000 });
    await page.goBack();
    await page.waitForURL((u) => u.pathname === '/request-a-sample');
    await expect(page.locator('#sentCode')).toHaveText('FC-2501');
    await expect(page.locator('.sent-box')).toBeVisible();
    await expect(page.locator('#sentWa')).toHaveAttribute('href', 'https://wa.me/201011435406?text=Hi%20Full%20Circle%2C%20I%20just%20sent%20sample%20request%20FC-2501%20(Acme%20Studio).');
  });

  test('contact: the message goes to the function, with a WhatsApp line for a number', async ({ page }) => {
    const sent = await mockBackend(page);
    await page.goto('/contact');
    await page.locator('#cName').fill('Sara');
    await page.locator('#cReach').fill('sara@brand.test');
    await expect(page.locator('#cWaLine')).toBeHidden();
    await page.locator('#cReach').fill('+966 50 123 4567');
    await expect(page.locator('#cWaLine')).toHaveText(NOTICE.whatsappReply);
    await page.locator('#cMsg').fill('Hello');
    await page.locator('#cForm button[type=submit]').click();
    await expect(page.locator('#cDone')).toBeVisible();
    expect(postedData(sent[0])).toMatchObject({ name: 'Sara', contact: '+966 50 123 4567', text: 'Hello', notice: NOTICE.version, turnstile: 'XXXX.DUMMY.TOKEN.XXXX' });
  });

  test('contact: a failed send keeps the message and says so', async ({ page }) => {
    await mockBackend(page, () => ({ status: 500, json: { error: ERRORS.failed } }));
    await page.goto('/contact');
    await page.locator('#cName').fill('Sara');
    await page.locator('#cReach').fill('sara@brand.test');
    await page.locator('#cMsg').fill('Hello');
    await page.locator('#cForm button[type=submit]').click();
    await expect(page.locator('#cErr')).toHaveText(ERRORS.failed);
    await expect(page.locator('#cForm')).toBeVisible();
    await expect(page.locator('#cMsg')).toHaveValue('Hello');
  });

  test('both forms carry the privacy line, and the privacy notice opens', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/request-a-sample');
    await expect(page.locator('#summary .notice', { hasText: NOTICE.request })).toBeVisible();
    await page.goto('/contact');
    await expect(page.locator('#cForm .notice', { hasText: NOTICE.contact })).toBeVisible();
    await page.locator('#cForm .notice a').click();
    await page.waitForURL('**/privacy');
    await expect(page.locator('h1')).toHaveText('Privacy notice.');
    await expect(page).toHaveTitle('Privacy notice / Full Circle');
    expect(errors).toEqual([]);
  });
});
