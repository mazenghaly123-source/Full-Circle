// WhatsApp's pieces that need no server (supabase/functions/_shared/whatsapp.ts): the signature
// checks on what Meta and Supabase Auth post, reading Meta's webhook, the templates' values, and the
// replies that stop the updates. The functions' end-to-end tests are in backend.spec.ts.
import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { asksToStop, codeMessage, fromAuth, fromMeta, orderMessage, readWebhook, template, TEMPLATES } from '../../supabase/functions/_shared/whatsapp';

const body = '{"object":"whatsapp_business_account"}';

test('a call from Meta is read only when signed with the app secret', async () => {
  const sig = (secret: string, b = body) => `sha256=${createHmac('sha256', secret).update(b).digest('hex')}`;
  expect(await fromMeta(body, sig('app-secret'), 'app-secret')).toBe(true);
  expect(await fromMeta(body, sig('app-secret').toUpperCase().replace('SHA256=', 'sha256='), 'app-secret')).toBe(true);
  expect(await fromMeta(body, sig('other'), 'app-secret')).toBe(false);
  expect(await fromMeta(body + ' ', sig('app-secret'), 'app-secret')).toBe(false);
  expect(await fromMeta(body, null, 'app-secret')).toBe(false);
  expect(await fromMeta(body, sig(''), '')).toBe(false); // no secret set: nothing is taken
});

test('a call from Supabase Auth is read only when signed, and only for five minutes', async () => {
  const key = Buffer.from('a test key for the hook, 32 byte').toString('base64'), secret = `v1,whsec_${key}`;
  const now = Date.UTC(2026, 9, 21, 9, 0, 0), ts = String(now / 1000);
  const sign = (k: string, id = 'msg_1', t = ts) => `v1,${createHmac('sha256', Buffer.from(k, 'base64')).update(`${id}.${t}.${body}`).digest('base64')}`;
  const headers = (signature: string, t = ts) => new Headers({ 'webhook-id': 'msg_1', 'webhook-timestamp': t, 'webhook-signature': signature });
  expect(await fromAuth(body, headers(sign(key)), secret, now)).toBe(true);
  // Auth lists one signature per secret, joined by ", "
  expect(await fromAuth(body, headers(`v1,${'A'.repeat(44)}, ${sign(key)}`), secret, now)).toBe(true);
  expect(await fromAuth(body, headers(sign(Buffer.from('another key').toString('base64'))), secret, now)).toBe(false);
  expect(await fromAuth(body, headers(sign(key, 'msg_1', String(now / 1000 - 301)), String(now / 1000 - 301)), secret, now)).toBe(false);
  expect(await fromAuth(body, headers(sign(key)), '', now)).toBe(false);
  expect(await fromAuth(body, new Headers(), secret, now)).toBe(false);
});

test('a webhook call gives the replies and what happened to each message sent', () => {
  const at = 1792573200;
  const { inbound, statuses } = readWebhook({
    object: 'whatsapp_business_account',
    entry: [{ changes: [
      { field: 'messages', value: {
        contacts: [{ wa_id: '201011435406', profile: { name: ' Laila ' } }],
        messages: [
          { from: '201011435406', id: 'wamid.1', timestamp: String(at), type: 'text', text: { body: 'Approved, thank you' } },
          { from: '201011435406', id: 'wamid.2', timestamp: String(at), type: 'image', image: { caption: 'the collar' } },
          { from: '201011435406', id: 'wamid.3', timestamp: String(at), type: 'audio', audio: {} },
          { id: 'wamid.4', type: 'text' },
        ],
        statuses: [
          { id: 'wamid.out', status: 'read', timestamp: String(at) },
          { id: 'wamid.bad', status: 'failed', timestamp: String(at), errors: [{ code: 131047, title: 'Re-engagement message', error_data: { details: 'More than 24 hours have passed' } }] },
          { id: 'wamid.odd', status: 'deleted', timestamp: String(at) },
        ],
      } },
      { field: 'account_update', value: { messages: [{ from: '1', id: 'x' }] } },
    ] }],
  });
  expect(inbound).toEqual([
    { wamid: 'wamid.1', from: '+201011435406', name: 'Laila', at: new Date(at * 1000), text: 'Approved, thank you' },
    { wamid: 'wamid.2', from: '+201011435406', name: 'Laila', at: new Date(at * 1000), text: '[A photo: the collar]' },
    { wamid: 'wamid.3', from: '+201011435406', name: 'Laila', at: new Date(at * 1000), text: '[A voice note]' },
  ]);
  expect(statuses).toEqual([
    { wamid: 'wamid.out', status: 'read', at: new Date(at * 1000) },
    { wamid: 'wamid.bad', status: 'failed', at: new Date(at * 1000), error: '131047 Re-engagement message More than 24 hours have passed' },
  ]);
  expect(readWebhook({ object: 'page', entry: [] })).toEqual({ inbound: [], statuses: [] });
  expect(readWebhook(null)).toEqual({ inbound: [], statuses: [] });
});

test('templates get values Meta takes, and only the client\'s events have one', () => {
  const t = template('decision_opened', ['Overshirt', 'FC-2418', 'Sample 05:\n  collar\tand  cuffs', '']);
  expect(t.template.name).toBe(TEMPLATES.decision_opened.name);
  expect(t.template.components[0].parameters.map((p) => p.text)).toEqual(['Overshirt', 'FC-2418', 'Sample 05: collar and cuffs', '—']);
  const o = { id: 1, code: 'FC-2418', name: 'Overshirt', stage: 5, brand: 'Atelier', decision: 'Approve sample 05' };
  expect(orderMessage('stage_moved', o)?.template.components[0].parameters.map((p) => p.text)).toEqual(['Overshirt', 'FC-2418', '05 Sampling']);
  expect(orderMessage('photo_added', o, 1)?.template.components[0].parameters[0].text).toBe('There is a new photo');
  expect(orderMessage('changes_asked', o)).toBeNull();
  const code = codeMessage('482913').template.components;
  expect(code.map((c) => [c.type, c.parameters[0].text])).toEqual([['body', '482913'], ['button', '482913']]);
  // every template's words have as many values as its builders fill
  for (const [k, n] of [['request_received', 1], ['portal_invite', 3], ['decision_opened', 3], ['stage_moved', 3], ['photo_added', 3]] as const) {
    expect(TEMPLATES[k].body.match(/\{\{\d\}\}/g)?.length, k).toBe(n);
  }
});

test('a reply of STOP, in English or Arabic, stops the updates; a sentence with it does not', () => {
  for (const s of ['STOP', 'stop', ' Stop. ', 'unsubscribe', 'إيقاف', 'الغاء']) expect(asksToStop(s), s).toBe(true);
  for (const s of ['Please don\'t stop the order', 'stop sending the old photos?', 'Hello']) expect(asksToStop(s), s).toBe(false);
});
