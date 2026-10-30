// The admin (/admin, phase 4) against a stand-in for Supabase (mockAdmin): staff sign-in, the overview,
// the inbox, turning a request into an order, an order's page (stage, decision, photos, specs,
// details), production, approvals, analytics, clients and team. Runs at 1440×900, 390×844 and 375×667.
import { expect, test } from '@playwright/test';
import { isPhone, mockAdmin, mockBackend, signInAdmin, watchErrors } from './helpers';

test.beforeEach(async ({ page }) => { await mockBackend(page); });

test('admin: staff sign in by code; someone not on the team is told so', async ({ page }) => {
  const errors = watchErrors(page);
  await mockAdmin(page, { staff: false });
  await page.goto('/admin');
  await expect(page).toHaveTitle('Studio OS / Full Circle');
  expect(await page.locator('meta[name=robots]').getAttribute('content')).toBe('noindex,nofollow');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await expect(page.locator('#si-err')).toHaveText('Add your work email');
  await page.locator('#si-e').fill('someone@x.test');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.locator('#si-c').fill('000000');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#si-err')).toHaveText('That code is wrong or has expired. Check it, or send a new one');
  await page.locator('#si-c').fill('123456');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#si-err')).toHaveText('That email is not on the Full Circle team. An owner can add you under Team.');
  await expect(page.locator('#app')).toBeHidden();
  // the wrong code is a 403 from Auth, which the browser logs
  expect(errors.filter((e) => !/status of 403/.test(e))).toEqual([]);
});

test('admin: the inbox, marking replied, and converting a request into an order', async ({ page }, info) => {
  const { calls, requests } = await mockAdmin(page);
  await page.goto('/admin#/inbox');
  await signInAdmin(page);
  await expect(page.locator('#main h1')).toHaveText('Inbox');
  await expect(page.locator(isPhone(info) ? '.tabbar [data-count="inbox"]' : '.side [data-count="inbox"]')).toHaveText('3');
  await page.locator('.li', { hasText: 'Atelier Sahel' }).click();
  await expect(page.locator('#detail h2')).toHaveText('Atelier Sahel');
  await expect(page.locator('#detail')).toContainText('Raw selvedge, two washes');
  await page.getByRole('button', { name: 'Mark replied' }).click();
  await expect.poll(() => requests[0].status).toBe('replied');
  await page.locator('[data-tab="replied"]').click();
  await page.locator('.li', { hasText: 'Atelier Sahel' }).click();
  await page.getByRole('button', { name: 'Convert to order' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('[name=brand]')).toHaveValue('Atelier Sahel');
  await expect(dlg.locator('[name=stage]')).toHaveValue('4');
  await dlg.locator('[name=name]').fill('Selvedge jean');
  await dlg.locator('[name=qty]').fill('300');
  await dlg.locator('[name=person]').fill('Laila');
  await dlg.getByRole('button', { name: 'Open the order' }).click();
  await page.waitForURL(/#\/order\/\d+$/);
  await expect(page.locator('#main h1')).toHaveText('Selvedge jean');
  await expect(page.locator('.mast .kick')).toHaveText('FC-2510 · Atelier Sahel');
  expect(calls.find((c) => c.fn === 'rpc/create_order')!.body).toMatchObject({ p_request: 1, p_entry_stage: 4, p_qty: 300, p_name: 'Selvedge jean', p_product: 'Denim' });
  expect(calls.find((c) => c.fn === 'invite')!.body).toMatchObject({ kind: 'client', name: 'Laila', email: 'laila@sahel.test' });
  expect(requests[0].status).toBe('converted');
});

test('admin: an order moves on after an approval, and not past the sample gate without one', async ({ page }) => {
  const { calls, orders } = await mockAdmin(page);
  await page.goto('/admin#/orders');
  await signInAdmin(page);
  await expect(page.locator('#main h1')).toHaveText('Orders');
  // waiting on us comes first: the approved sample, then the photo asked for
  await expect(page.locator('tbody tr').first()).toContainText('FC-2418');
  await page.locator('[data-f="client"]').click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('FC-2455');
  await page.goto('/admin#/order/1');
  await expect(page.locator('#n-h')).toHaveText('One thing to do');
  await page.getByRole('button', { name: 'Move to 06 Production' }).click();
  await expect(page.locator('#s-h')).toHaveText('06 Production');
  await expect(page.locator('#n-h')).toHaveCount(0);
  expect(calls.find((c) => c.fn === 'rpc/move_stage')!.body).toEqual({ p_order: 1, p_to: 6, p_note: null });
  expect(calls.some((c) => c.fn === 'notify')).toBe(true);
  // order 3 has no approved sample: the server refuses, and the page says why
  await page.goto('/admin#/order/3');
  await page.locator('#mv [name=to]').selectOption('7');
  await page.locator('#mv').getByRole('button', { name: 'Move' }).click();
  await expect(page.locator('#toast')).toHaveText('The client has not approved a sample yet');
  expect(orders.find((o) => o.id === 3).stage).toBe(2);
});

test('admin: ask for a decision with a photo, answer a photo request, and edit specs and details', async ({ page }) => {
  const { calls, orders } = await mockAdmin(page);
  await page.goto('/admin#/order/3');
  await signInAdmin(page);
  await expect(page.locator('#n-h')).toHaveText('One thing to do');
  await expect(page.locator('#main')).toContainText('Laila asked for a photo of 02 Design support');
  // a photo at the stage asked about answers the request (the file picker opens on that stage)
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add a photo' }).click();
  await (await chooser).setFiles({ name: 'collar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') });
  await expect(page.locator('.photos .thumb')).toHaveCount(1);
  await expect(page.locator('#n-h')).toHaveCount(0);
  expect(calls.find((c) => c.fn === 'rpc/add_stage_photo')!.body).toMatchObject({ p_order: 3, p_stage: 2 });
  expect(calls.find((c) => c.fn === 'upload')!.body).toMatch(/^\/storage\/v1\/object\/stage-photos\/3\/.+\.jpg$/);

  await page.getByRole('button', { name: 'Ask for a decision' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('[name=title]').fill('Approve the collar');
  await dlg.locator('input[name=photo]').check();
  await dlg.getByRole('button', { name: 'Send it to the client' }).click();
  await expect(page.locator('#d-h')).toHaveText('Approve the collar');
  expect(calls.find((c) => c.fn === 'rpc/open_decision')!.body).toMatchObject({ p_order: 3, p_title: 'Approve the collar', p_photo_ids: [orders[2].stage_photos[0].id] });

  await page.getByRole('button', { name: 'Add a row' }).click();
  await page.locator('#sp .kv').last().locator('[name=k]').fill('Fabric');
  await page.locator('#sp .kv').last().locator('[name=v]').fill('Fleece 400 gsm');
  await page.getByRole('button', { name: 'Save specs' }).click();
  await expect.poll(() => orders[2].order_specs).toEqual([expect.objectContaining({ key: 'Fabric', value: 'Fleece 400 gsm', position: 0 })]);
  // the page is drawn again once saved: only then is the details form the one to fill
  await expect(page.locator('#toast')).toHaveText('Specs saved');
  await page.locator('#det [name=summary]').fill('Sample 01 / fleece');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect.poll(() => orders[2].summary).toBe('Sample 01 / fleece');
});

test('admin: add someone to a client, and an owner adds staff', async ({ page }) => {
  const { clients, staff } = await mockAdmin(page);
  await page.goto('/admin#/clients/1');
  await signInAdmin(page);
  await expect(page.locator('#detail h2')).toHaveText('Demo Studio');
  await page.locator('#inv [name=name]').fill('Karim');
  await page.locator('#inv [name=email]').fill('Karim@Demo.test');
  await page.getByRole('button', { name: 'Add and email the link' }).click();
  await expect(page.locator('#toast')).toHaveText('Karim was emailed the portal link');
  expect(clients[0].client_members.map((m: { email: string }) => m.email)).toContain('karim@demo.test');
  await page.goto('/admin#/team');
  await page.locator('#add [name=name]').fill('Salma');
  await page.locator('#add [name=email]').fill('salma@fullcircle.test');
  await page.getByRole('button', { name: 'Add and email the link' }).click();
  await expect(page.locator('#main')).toContainText('Salma');
  expect(staff.map((s) => s.name)).toEqual(['Mazen', 'Salma']);
});

test('admin: a developer is named so, and can add people as an owner can', async ({ page }) => {
  const { staff } = await mockAdmin(page, { role: 'developer' });
  await page.goto('/admin#/team');
  await signInAdmin(page);
  await expect(page.locator('#main .row', { hasText: 'Mazen' }).locator('.pillS')).toHaveText('Developer');
  await page.locator('#add [name=name]').fill('Salma');
  await page.locator('#add [name=email]').fill('salma@fullcircle.test');
  await page.getByRole('button', { name: 'Add and email the link' }).click();
  await expect(page.locator('#main')).toContainText('Salma');
  expect(staff.map((s) => s.name)).toEqual(['Mazen', 'Salma']);
});

test('admin: the overview says what needs us, and an approval moves the order on from it', async ({ page }) => {
  const { calls, orders } = await mockAdmin(page);
  await page.goto('/admin');
  await signInAdmin(page);
  await expect(page.locator('#main h1')).toHaveText('Overview');
  // three in the inbox, and two orders: the approved sample and the photo asked for
  await expect(page.locator('.kp').first()).toContainText(/Needs you\s*5things/);
  await expect(page.locator('.kp', { hasText: 'Running late' })).toContainText('FC-2390');
  await expect(page.locator('.fcol').nth(4).locator('.blk')).toHaveText(['FC-2418300 pcs']);
  await expect(page.locator('.blk', { hasText: 'FC-2301' })).toHaveCount(0);
  await page.locator('[data-needs="orders"]').click();
  await expect(page.locator('.focus .q')).toHaveCount(2);
  await page.getByRole('button', { name: 'Move to 06 Production' }).click();
  await expect(page.locator('#toast')).toHaveText('FC-2418 moved to 06 Production');
  expect(calls.find((c) => c.fn === 'rpc/move_stage')!.body).toEqual({ p_order: 1, p_to: 6, p_note: null });
  expect(orders[0].stage).toBe(6);
  await expect(page.locator('.focus .q')).toHaveCount(1);
  await expect(page.locator('a.dlr.late')).toContainText('FC-2390');
  await expect(page.locator('.log')).toContainText('Moved to 06 Production');
});

test('admin: the production board, its filters, and the approvals screen', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin#/production');
  await signInAdmin(page);
  await expect(page.locator('#main h1')).toHaveText('Production');
  await expect(page.locator('.bcl')).toHaveCount(8);
  await expect(page.locator('.bcl').nth(5).locator('.oc')).toContainText('past the delivery date');
  await expect(page.locator('.bcl').nth(1).locator('.oc')).toContainText('Photo asked of 02');
  await page.locator('[data-show="late"]').click();
  await expect(page.locator('.oc:not(.dim)')).toHaveText([/FC-2390/]);

  await page.goto('/admin#/approvals');
  await expect(page.locator('#main h1')).toHaveText('Approvals');
  const theirs = page.locator('#w-h').locator('xpath=ancestor::section[1]');
  await expect(theirs.locator('.q')).toHaveCount(1);
  await expect(theirs.locator('.q')).toContainText('Choose the fabric');
  expect(await theirs.getByRole('link', { name: 'WhatsApp Laila' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/201011435406\?text=Hello%20Laila%2C/);
  await expect(page.locator('.focus .q')).toHaveCount(2);
  // answered in the last 30 days: the two samples of FC-2390 and the approved one of FC-2418
  await expect(page.locator('section:has(#h-h) tbody tr')).toHaveCount(3);
  await page.locator('[data-t="changes_asked"]').click();
  await expect(page.locator('section:has(#h-h) tbody tr')).toHaveText([/Shorter sleeves/]);
  // two samples approved, one at the first try
  await expect(page.locator('section:has(#g-h) .facts')).toContainText('First try50%1 of 2');
});

test('admin: analytics counts requests, and which became orders, by source', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin#/analytics');
  await signInAdmin(page);
  await expect(page.locator('#main h1')).toHaveText('Analytics');
  await expect(page.locator('.kp').first()).toContainText('Requests, 30 days3');
  await expect(page.locator('.kp').nth(2)).toContainText('25%1 of 4 requests');
  const sources = page.locator('section:has(#sr-h) tbody tr');
  await expect(sources).toHaveText([/Direct or unknown\s*2\s*0/, /instagram\s*1\s*0/, /google\.com\s*1\s*1\s*100%/]);
  await expect(page.locator('.bcol')).toHaveCount(6);
});

test('admin: a reply to the WhatsApp number waits in the inbox, and an order shows what was read', async ({ page }) => {
  const { messages, orders } = await mockAdmin(page);
  messages.push({ id: 2, name: 'Laila (Demo Studio)', contact: '+201011435406', contact_channel: 'whatsapp', email: null, whatsapp: '+201011435406', text: 'Is the jacket sample ready?', status: 'new', created_at: new Date().toISOString(), via: 'whatsapp' });
  const o1 = orders.find((o) => o.id === 1);
  o1.order_notifications.push(
    { id: 901, event: 'stage_moved', audience: 'client', channel: 'whatsapp', recipient: '+201011435406', status: 'sent', detail: null, created_at: new Date().toISOString(), delivered_at: new Date().toISOString(), read_at: new Date().toISOString() },
    { id: 902, event: 'stage_moved', audience: 'client', channel: 'email', recipient: 'laila@demo.test', status: 'sent', detail: null, created_at: new Date().toISOString(), delivered_at: null, read_at: null });
  await page.goto('/admin#/inbox/m/2');
  await signInAdmin(page);
  await expect(page.locator('.li', { hasText: 'Laila (Demo Studio)' })).toContainText('WhatsApp');
  await expect(page.locator('#detail .kick')).toHaveText('02 — WhatsApp reply');
  await expect(page.locator('#detail')).toContainText('Is the jacket sample ready?');
  expect(await page.getByRole('link', { name: 'Reply on WhatsApp' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/201011435406\?text=/);
  // the figures count the contact page's messages, not the replies
  await page.goto('/admin#/analytics');
  await expect(page.locator('.kp').nth(3)).toContainText('Messages, 30 days1');
  await page.goto('/admin#/order/1');
  await expect(page.locator('tr', { hasText: '+201011435406 · whatsapp' }).first()).toContainText('read');
  await expect(page.locator('tr', { hasText: 'laila@demo.test · email' }).first()).toContainText('sent');
});

test('admin: on a phone the sidebar becomes a tab bar', async ({ page }, info) => {
  test.skip(!isPhone(info), 'phones only');
  await mockAdmin(page);
  await page.goto('/admin');
  await signInAdmin(page);
  await expect(page.locator('.side')).toBeHidden();
  await expect(page.locator('.tabbar')).toBeVisible();
  await page.locator('.tabbar a', { hasText: 'Orders' }).click();
  await expect(page.locator('#main h1')).toHaveText('Orders');
  await expect(page.locator('.tabbar a[aria-current="page"]')).toHaveText(/Orders/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // the rest are under More
  await page.locator('#more-tab').click();
  await page.getByRole('dialog').getByRole('link', { name: /Approvals/ }).click();
  await expect(page.locator('#main h1')).toHaveText('Approvals');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#more-tab')).toHaveAttribute('aria-current', 'page');
  for (const screen of ['overview', 'production', 'approvals', 'analytics']) {
    await page.goto(`/admin#/${screen}`);
    await page.locator('#main h1').waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), screen).toBe(true);
  }
});
