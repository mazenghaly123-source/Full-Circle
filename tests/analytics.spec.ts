// Google Analytics behind the consent bar (src/scripts/shell/analytics.ts): nothing from Google
// before the visitor accepts, page views and events after, and a way back out on /privacy. The bar
// shows only on the live domain, so these tests turn it on here with the flag the script reads.
import { expect, test, type Page } from '@playwright/test';
import { isPhone, mockBackend } from './helpers';

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  // the flat mark: no test here is about the 3D hero
  await page.route(/\/_astro\/three\.module[^/]*\.js$/, (route) => route.fulfill({ body: 'throw new Error("3D off")', contentType: 'text/javascript' }));
});

/** Counts requests for Google's script, answering them with an empty one. */
async function watchGoogle(page: Page) {
  const seen: string[] = [];
  await page.route(/googletagmanager\.com|google-analytics\.com/, (route) => {
    seen.push(route.request().url());
    return route.fulfill({ body: '', contentType: 'text/javascript' });
  });
  return seen;
}

const turnOn = (page: Page) => page.addInitScript(() => localStorage.setItem('fc-analytics-anyhost', '1'));

/** The gtag calls so far, as arrays: ['event', 'page_view', {...}]. */
const calls = (page: Page) => page.evaluate(() => ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((a) => Array.from(a)));
const events = async (page: Page, name: string) => (await calls(page)).filter((c) => c[0] === 'event' && c[1] === name);

test('away from the live domain there is no bar and nothing from Google', async ({ page }) => {
  const google = await watchGoogle(page);
  await page.goto('/');
  await expect(page.locator('#consent')).toBeHidden();
  await page.waitForTimeout(500);
  expect(google).toEqual([]);
});

test('declining: the bar goes for good, and nothing is sent to Google', async ({ page }) => {
  const google = await watchGoogle(page);
  await turnOn(page);
  await page.goto('/');
  const bar = page.locator('#consent');
  await expect(bar).toBeVisible();
  await expect(bar.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute('href', '/privacy');
  await bar.getByRole('button', { name: 'Decline' }).click();
  await expect(bar).toBeHidden();
  await page.reload();
  await expect(page.locator('#consent')).toBeHidden();
  await page.waitForTimeout(500);
  expect(google).toEqual([]);
});

test('accepting: Google is loaded, and page views, sent forms and WhatsApp clicks are counted', async ({ page }, info) => {
  const google = await watchGoogle(page);
  await turnOn(page);
  // a link with an ad tag and a value that is not ours to send
  await page.goto('/about?utm_source=instagram&phone=0101#top');
  const bar = page.locator('#consent');
  // on a phone the bar fits the screen, above everything else
  if (isPhone(info)) {
    const box = (await bar.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
  }
  await bar.getByRole('button', { name: 'Accept' }).click();
  await expect(bar).toBeHidden();
  await expect.poll(() => google.length).toBeGreaterThan(0);
  expect(google[0]).toContain('id=G-XNT9FPB5RQ');
  // the ad tag stays; the phone number and the #part do not
  expect((await events(page, 'page_view')).map((c) => (c[2] as { page_location: string }).page_location)).toEqual([expect.stringMatching(/\/about\?utm_source=instagram$/)]);
  // a page swap counts as a page view of its own
  await page.goto('/about');
  await page.locator('footer a[href="/contact"]').first().click();
  await page.waitForURL('**/contact');
  await expect.poll(async () => (await events(page, 'page_view')).length).toBe(2);
  // the WhatsApp link, without leaving the page
  await page.evaluate(() => document.querySelector('a[href^="https://wa.me/"]')!.addEventListener('click', (e) => e.preventDefault()));
  await page.locator('#cWa').click();
  expect(await events(page, 'whatsapp_click')).toHaveLength(1);
  // a sent message is a lead
  await page.locator('#cName').fill('Laila');
  await page.locator('#cReach').fill('laila@acme.studio');
  await page.locator('#cMsg').fill('Hello');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('#cDone')).toBeVisible();
  expect((await events(page, 'generate_lead')).map((c) => c[2])).toEqual([{ form: 'contact' }]);
});

test('changing your mind on /privacy: the bar comes back, and declining stops counting and removes the cookies', async ({ page, context }) => {
  await watchGoogle(page);
  await turnOn(page);
  await page.addInitScript(() => localStorage.setItem('fc-analytics', 'granted'));
  await page.goto('/privacy');
  await expect(page.locator('#consent')).toBeHidden();
  await context.addCookies([{ name: '_ga', value: 'GA1.1.1', url: page.url() }]);
  await page.getByRole('button', { name: 'Cookie settings' }).click();
  await expect(page.locator('#consent')).toBeVisible();
  await page.locator('#consent').getByRole('button', { name: 'Decline' }).click();
  expect(await page.evaluate(() => localStorage.getItem('fc-analytics'))).toBe('denied');
  expect((await context.cookies()).map((c) => c.name)).not.toContain('_ga');
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>)['ga-disable-G-XNT9FPB5RQ'])).toBe(true);
});
