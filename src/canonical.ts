// One address for every page (SEO audit, 9 Nov 2026): https://fullcircle-co.com, with no www, no plain
// http, no trailing slash and no .html. The Worker (src/worker.ts) sends everything else there with a
// permanent redirect, on the paths `run_worker_first` lists in wrangler.jsonc. No imports, so the Worker
// stays small.

export const CANONICAL_HOST = 'fullcircle-co.com';

/**
 * Hosts that serve the same deploy and send visitors on to the domain: the www name, and the Worker's own
 * workers.dev address. Preview builds (`<name>-full-circle.…workers.dev`) are left alone: Cloudflare marks
 * them noindex itself.
 */
export const ALIAS_HOSTS = new Set(['www.fullcircle-co.com', 'full-circle.mazenghaly123.workers.dev']);

/** A path as the site links to it: /about/ → /about, /index.html → /, /about.html → /about. */
export function cleanPath(path: string) {
  const p = path.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  return p.length > 1 ? p.replace(/\/+$/, '') || '/' : '/';
}

/** Where a request belongs, when that is somewhere else; null when it is already there. */
export function redirectFor(url: URL): string | null {
  const alias = ALIAS_HOSTS.has(url.hostname) || (url.hostname === CANONICAL_HOST && url.protocol === 'http:');
  // the markdown API keeps its own paths (/api/md/ is the home page's markdown)
  const path = url.pathname.startsWith('/api/') ? url.pathname : cleanPath(url.pathname);
  if (!alias && path === url.pathname) return null;
  const to = new URL(url.href);
  if (alias) {
    to.protocol = 'https:';
    to.hostname = CANONICAL_HOST;
    to.port = '';
  }
  to.pathname = path;
  return to.href;
}
