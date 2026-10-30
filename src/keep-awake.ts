// Supabase pauses a free-plan project that sees too few database queries in a week. The Worker
// (src/worker.ts, `scheduled`) makes this call twice a day so that never happens while the project is on
// the free plan: public.alive() reads nothing and answers true
// (supabase/migrations/20261030151642_keep_awake.sql).
import { PROJECT } from './data/project';

/** One database call with the publishable key; a failure shows in the Worker's logs. */
export async function keepAwake(f: typeof fetch = fetch) {
  const res = await f(`${PROJECT.url}/rest/v1/rpc/alive`, {
    method: 'POST', headers: { apikey: PROJECT.key, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!res.ok) console.error(`keep-awake: Supabase answered ${res.status}`);
  return res.ok;
}
