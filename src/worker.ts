// The site's one piece of Worker code (docs/adr/0006-a-worker-for-markdown.md): it serves the pages'
// markdown versions, which the build writes as .md files. It runs only on the paths
// `assets.run_worker_first` lists in wrangler.jsonc (the public pages, *.md and /api/md/*); every
// other file is served straight from the static assets, as before.
//   /about.md                      → the markdown of /about (/index.md for Home)
//   /about, Accept: text/markdown  → the same, when markdown is preferred over HTML
//   /api/md/about                  → the same, always; /api/md/_catalog lists them all
import { CORS, canonicalOf, describedByLink, lastModifiedOf, markdownHeaders, notFoundMarkdown, prefersMarkdown } from './md/http';

interface Env {
  ASSETS: { fetch(input: Request | URL | string, init?: RequestInit): Promise<Response> };
}

/** Headers public/_headers puts on every asset, kept on the markdown responses made from them. */
const SECURITY = ['Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options', 'Permissions-Policy'];

/** The .md file for a path under /api/md/: '' → /index.md, 'about' or 'about.md' → /about.md. */
const apiFile = (rest: string) => `/${rest.replace(/\/$/, '').replace(/\.md$/, '') || 'index'}.md`;

/** Copies a response with extra headers. HEAD gets the same headers and no body. */
function respond(request: Request, res: Response, headers: Record<string, string>) {
  const out = new Response(request.method === 'HEAD' ? null : res.body, res);
  for (const [k, v] of Object.entries(headers)) k === 'Vary' ? out.headers.append(k, v) : out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });

    if (path === '/api/md/_catalog') {
      const res = await env.ASSETS.fetch(new URL('/api/md/catalog.json', url));
      return respond(request, res, { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'X-Robots-Tag': 'noindex' });
    }
    let file: string | null = null;
    let negotiated = false;
    if (path === '/api/md' || path.startsWith('/api/md/')) file = apiFile(path.slice('/api/md/'.length));
    else if (path.endsWith('.md')) file = path;
    else if (prefersMarkdown(request.headers.get('Accept'))) {
      file = `${path === '/' ? '/index' : path.replace(/\/$/, '')}.md`;
      negotiated = true;
    }

    // the HTML page, which says where its markdown and the site's files for agents are
    if (!file) return respond(request, await env.ASSETS.fetch(request), { Vary: 'Accept', Link: describedByLink() });

    const res = await env.ASSETS.fetch(new URL(file, url));
    const found = res.status === 200;
    const body = found ? await res.text() : notFoundMarkdown(negotiated ? path : file, url.origin);
    const headers = markdownHeaders(body, found ? canonicalOf(body) : null, { negotiated, lastModified: found ? lastModifiedOf(body) : null });
    if (!found) headers.set('Cache-Control', 'public, max-age=60');
    // the asset's own headers from public/_headers (the security ones) stay, under the markdown ones
    for (const k of SECURITY) { const v = res.headers.get(k); if (v) headers.set(k, v); }
    return new Response(request.method === 'HEAD' ? null : body, { status: found ? 200 : 404, headers });
  },
};
