// Where the visitor came from, read once on the first page they open (ad tags in the address, the
// site that linked here) and sent with a request or message, so staff can see which posts and ads
// bring brands in. Kept in memory only: nothing is stored in the browser.
import { SOURCE_KEYS, cleanSource, type Source } from '../../../supabase/functions/_shared/forms';

function read(): Source {
  const params = new URLSearchParams(location.search), raw: Record<string, string> = {};
  for (const k of SOURCE_KEYS) { const v = params.get(k); if (v) raw[k] = v; }
  try { const r = new URL(document.referrer); if (r.host !== location.host) raw.referrer = r.origin + r.pathname; } catch { /* no referrer */ }
  raw.landing = location.pathname;
  return cleanSource(raw);
}

export const source: Source = read();
