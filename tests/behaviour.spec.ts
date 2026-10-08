// Behaviour of the production build: navigation, motion that carries meaning, the phone
// experience, the demos and the forms. Runs at 1440×900, 390×844 and 375×667.
import { expect, test, type Page } from '@playwright/test';
import { PAGES, isPhone, watchErrors } from './helpers';

// Software WebGL in headless Chromium needs seconds to draw the 3D hero mark and blocks the page
// meanwhile, so tests that are not about it get the flat-mark fallback (three.js refuses to load).
test.beforeEach(async ({ page }, info) => {
  if (/3D/.test(info.title)) return;
  await page.route(/\/_astro\/three\.module[^/]*\.js$/, (route) => route.fulfill({ body: 'throw new Error("3D off in this test")', contentType: 'text/javascript' }));
});

const scrollToY = (page: Page, y: number) => page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);

/** Scrolls in steps, so scroll listeners see a real scroll. */
async function scrollBy(page: Page, dy: number, steps = 8) {
  for (let i = 0; i < steps; i++) { await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'instant' }), dy / steps); await page.waitForTimeout(40); }
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
  await expect(page).toHaveTitle('How it works / Full Circle');
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
  await at(1);
  await expect(page.locator('#h-how .howring')).toHaveClass(/done/, slow);
  await expect(page.locator('#howLbl')).toHaveText('Full circle');
});

test('home: 3D mark appears and is kept when you come back', async ({ page }, info) => {
  test.skip(isPhone(info), 'checked once, on desktop');
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto('/');
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
  await page.locator('.yo-st[data-i="5"]').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await scrollBy(page, 60, 2);
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
  for (const [k, v] of [['path', 'Starting'], ['product', 'Denim'], ['qty', '60–150'], ['have', 'A sketch']]) await page.locator(`.q[data-k="${k}"] .opt`, { hasText: v }).click();
  await expect(page.locator('#qtyWarn')).toBeVisible();
  await expect(page.locator('#meter i.on')).toHaveCount(4);
  if (isPhone(info)) await expect(page.locator('#mbarGo')).toHaveText('Add your details');
  await page.locator('#send').click();
  await expect(page.locator('#err')).toHaveText('Add the brand name');
  await page.locator('#fBrand').fill('Acme Studio');
  await page.locator('#fContact').fill('hello@acme.test');
  // let any scroll settle first: the next scroll after sending hides the phone bar
  await page.locator('#send').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('#send').click();
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

test('track: demo sign-in, order view and approval', async ({ page }) => {
  await page.goto('/track');
  await page.locator('#tSendCode').click();
  await expect(page.locator('#tErr')).toHaveText('Add the email or WhatsApp number on your order');
  await page.locator('#tId').fill('demo@brand.test');
  await page.locator('#tSendCode').click();
  await expect(page.locator('#tLoginH')).toHaveText('Enter the code');
  await page.locator('#tCode').fill('123456');
  await page.locator('#tVerify').click();
  await expect(page.locator('#tOrders')).toBeVisible();
  await expect(page.locator('#tList .ord')).toHaveCount(3);
  await page.locator('#tList .ord').first().click();
  await expect(page.locator('#tTitle')).toHaveText('FC-2418.');
  await expect(page.locator('#oPhotos .ph')).toHaveCount(3);
  await page.locator('#oApprove').click();
  await expect(page.locator('#oNum')).toHaveText('06');
  await expect(page.locator('#oDecision')).toHaveClass(/done/);
  await page.locator('.tabs2 [data-tab="log"]').click();
  await expect(page.locator('#oLog tr').first()).toContainText('Approve sample 03 / approved');
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

test('request and track: files, errors and a pending photo survive a trip to another page', async ({ page }, info) => {
  await page.goto('/request-a-sample');
  await page.locator('#fFile').setInputFiles([{ name: 'sketch.png', mimeType: 'image/png', buffer: Buffer.from('x') }, { name: 'pack.pdf', mimeType: 'application/pdf', buffer: Buffer.from('y') }]);
  await page.locator('#send').click();
  await expect(page.locator('#err')).toHaveText('Pick the brand stage and a product');
  await openNav(page, '/about', isPhone(info));
  await page.waitForURL('**/about');
  await page.goBack();
  await page.waitForURL((u) => u.pathname === '/request-a-sample');
  await expect(page.locator('#fFileT')).toHaveText('sketch.png, pack.pdf');
  expect(await page.locator('#fFile').evaluate((i: HTMLInputElement) => i.files?.length)).toBe(2);
  await expect(page.locator('#err')).toHaveText('Pick the brand stage and a product');

  await page.goto('/track');
  await page.locator('#tDemo').click();
  await page.locator('#tList .ord').first().click();
  await page.locator('#oPhoto').click();
  await openNav(page, '/about', isPhone(info));
  await page.waitForURL('**/about');
  await page.waitForTimeout(2600);
  await page.goBack();
  await page.waitForURL('**/track');
  await expect(page.locator('#oPhotos .ph')).toHaveCount(4);
  await expect(page.locator('#oPhoto')).toBeEnabled();
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
