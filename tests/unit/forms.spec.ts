// The forms' rules and emails (supabase/functions/_shared), which the site and the Edge Functions share.
import { expect, test } from '@playwright/test';
import { ERRORS, belowMinimum, checkMessage, checkRequest, readContact, sniffType, toInternational } from '../../supabase/functions/_shared/forms';
import { clientReceiptEmail, staffMessageEmail, staffRequestEmail } from '../../supabase/functions/_shared/emails';

test('a contact is read as an email or a WhatsApp number', () => {
  expect(readContact('  Hello@Acme.Studio ')).toEqual({ channel: 'email', email: 'hello@acme.studio' });
  expect(readContact('hello@acme')).toBeNull();
  expect(readContact('call me maybe')).toBeNull();
  expect(readContact('12345')).toBeNull();
  expect(readContact('0101 143 5406')).toEqual({ channel: 'whatsapp', whatsapp: '+201011435406' });
  // a local number from outside Egypt is still a WhatsApp contact, but its country is for staff to ask
  expect(readContact('050 123 4567')).toEqual({ channel: 'whatsapp', whatsapp: null });
});

test('phone numbers are put in international form', () => {
  for (const typed of ['+20 101 143 5406', '+201011435406', '00201011435406', '0101 143 5406', '01011435406', '201011435406', '+20 (0)10 1143 5406', '+20 010 1143 5406', '+20-101-143-5406'])
    expect(toInternational(typed), typed).toBe('+201011435406');
  expect(toInternational('+966 50 123 4567')).toBe('+966501234567');
  expect(toInternational('0090 532 123 4567')).toBe('+905321234567');
  expect(toInternational('+86 138 0013 8000')).toBe('+8613800138000');
  expect(toInternational('+20 2 2698 7277')).toBe('+20226987277');
  // no country to go on
  expect(toInternational('050 123 4567')).toBeNull();
  expect(toInternational('2698 7277')).toBeNull();
});

test('files are told apart by their first bytes', () => {
  const b = (...x: (number | string)[]) => new Uint8Array(x.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])));
  expect(sniffType(b(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  expect(sniffType(b(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
  expect(sniffType(b('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('image/webp');
  expect(sniffType(b('GIF89a'))).toBe('image/gif');
  expect(sniffType(b('%PDF-1.7'))).toBe('application/pdf');
  expect(sniffType(b(0, 0, 0, 0x18, 'ftypheic'))).toBe('image/heic');
  expect(sniffType(b(0, 0, 0, 0x18, 'ftypmif1'))).toBe('image/heif');
  expect(sniffType(b(0, 0, 0, 0x18, 'ftypavif'))).toBe('image/avif');
  expect(sniffType(b('<html>'))).toBeNull();
  expect(sniffType(b('PK', 3, 4))).toBeNull();
});

test('a request is checked the same way on both sides', () => {
  const ok = { path: 'Scaling', product: 'Denim', qty: '60–150', have: null, brand: ' Acme ', contact: 'a@b.co', note: '', notice: 'v', source: {}, turnstile: 't' };
  const good = checkRequest(ok);
  expect(good.ok && good.value.brand).toBe('Acme');
  expect(checkRequest({ ...ok, product: 'Socks' })).toMatchObject({ ok: false, error: ERRORS.picks, field: 'picks' });
  expect(checkRequest({ ...ok, qty: '7' })).toMatchObject({ ok: false, field: 'picks' });
  expect(checkRequest({ ...ok, brand: '   ' })).toMatchObject({ ok: false, error: ERRORS.brand, field: 'brand' });
  expect(checkRequest({ ...ok, contact: 'nobody' })).toMatchObject({ ok: false, error: ERRORS.contact, field: 'contact' });
  // the WhatsApp opt-in only counts with a WhatsApp number
  const email = checkRequest({ ...ok, whatsappUpdates: true });
  expect(email.ok && email.value.whatsappUpdates).toBeUndefined();
  const wa = checkRequest({ ...ok, contact: '0101 143 5406', whatsappUpdates: false });
  expect(wa.ok && wa.value.whatsappUpdates).toBe(false);
  // only known source keys, as short strings
  const src = checkRequest({ ...ok, source: { utm_source: 'ig', evil: 'x', landing: 'y'.repeat(500) } as never });
  expect(src.ok && src.value.source).toEqual({ utm_source: 'ig', landing: 'y'.repeat(300) });
  expect(checkMessage({ name: 'Sara', contact: 'sara@x.co', text: ' ', notice: 'v', source: {}, turnstile: 't' })).toMatchObject({ ok: false, error: ERRORS.message });
});

test('the minimum order rule', () => {
  expect(belowMinimum('Under 60', 'Tees')).toBe(true);
  expect(belowMinimum('60–150', 'Denim')).toBe(true);
  expect(belowMinimum('60–150', 'Tees')).toBe(false);
  expect(belowMinimum(null, 'Denim')).toBe(false);
});

test('emails escape what brands type, and link back to them', () => {
  const at = new Date('2026-10-15T09:30:00Z');
  const mail = staffRequestEmail({
    code: 'FC-2501', at, brand: 'Acme <script>', picks: { path: 'Scaling', product: 'Denim', qty: '60–150', have: null }, belowMinimum: true,
    typed: '0101 143 5406', reach: { channel: 'whatsapp', whatsapp: '+201011435406' }, whatsappUpdates: true, note: 'Line one\nLine "two"',
    files: [{ name: 'a&b.png', url: 'https://x.test/a?token=1&b=2' }], source: { utm_source: 'instagram', landing: '/what-we-make' },
  });
  expect(mail.subject).toBe('FC-2501 / New sample request: Acme <script> (Denim, Scaling)');
  expect(mail.html).not.toContain('<script>');
  expect(mail.html).toContain('Acme &lt;script&gt;');
  expect(mail.html).toContain('Line one<br>Line &quot;two&quot;');
  expect(mail.html).toContain('href="https://wa.me/201011435406"');
  expect(mail.html).toContain('href="https://x.test/a?token=1&amp;b=2"');
  expect(mail.text).toContain('Pieces per style: 60–150 (below the minimum)');
  expect(mail.text).toContain('You have: —');
  expect(mail.text).toContain('Order updates on WhatsApp: Yes, opted in');
  expect(mail.text).toContain('Came from: source: instagram');
  expect(mail.text).toContain('Received: 15 Oct 2026, 12:30 (Cairo)');

  const receipt = clientReceiptEmail({ code: 'FC-2501', brand: 'Acme' });
  expect(receipt.subject).toBe('Your sample request FC-2501 / Full Circle');
  expect(receipt.text).toContain('Your request code is FC-2501');
  expect(receipt.replyTo).toBe('fullcircleworks.co@gmail.com');

  const msg = staffMessageEmail({ at, name: 'Sara', typed: '050 123 4567', reach: { channel: 'whatsapp', whatsapp: null }, text: 'Hi', source: {} });
  expect(msg.text).toContain('Contact: 050 123 4567 (WhatsApp; check the country code)');
});
