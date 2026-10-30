// The Worker's twice-daily call that keeps the free-plan Supabase project from pausing (src/keep-awake.ts).
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import worker from '../../src/worker';
import { PROJECT } from '../../src/data/project';

test('twice a day the Worker makes one call to the project, with the publishable key', async () => {
  const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  expect(wrangler.triggers.crons).toHaveLength(2);
  const calls: Request[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => { calls.push(new Request(input, init)); return new Response('true'); }) as typeof fetch;
  try {
    const waits: Promise<unknown>[] = [];
    await worker.scheduled({}, {} as never, { waitUntil: (p) => { waits.push(p); } });
    await Promise.all(waits);
  } finally { globalThis.fetch = real; }
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe(`${PROJECT.url}/rest/v1/rpc/alive`);
  expect(calls[0].method).toBe('POST');
  expect(calls[0].headers.get('apikey')).toBe(PROJECT.key);
});
