// How markdown is asked for and answered, shared by the Worker (src/worker.ts) and the build. No
// imports, so the Worker stays small.

/** The site-level files for agents, advertised on every HTML page (the Link header). */
export const DESCRIBED_BY = ['/llms.txt', '/llms-full.txt', '/ai.txt'];
export const describedByLink = () => DESCRIBED_BY.map((p) => `<${p}>; rel="describedby"`).join(', ');

/**
 * Whether an Accept header asks for markdown over HTML: only when text/markdown gets a higher q
 * than text/html. A missing header, a bare wildcard, or a tie keeps HTML, so browsers, curl and
 * link previews never get markdown by accident.
 */
export function prefersMarkdown(accept: string | null) {
  if (!accept) return false;
  const ranges = accept.split(',').map((part) => {
    const [type, ...params] = part.trim().toLowerCase().split(';').map((s) => s.trim());
    const q = params.find((p) => p.startsWith('q='));
    const n = q ? Number(q.slice(2)) : 1;
    return { type, q: Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : 0 };
  });
  // the q of the most specific range that matches a type (text/html over text/* over */*)
  const qFor = (type: string) => {
    const [major] = type.split('/');
    for (const t of [type, `${major}/*`, '*/*']) {
      const r = ranges.find((x) => x.type === t);
      if (r) return r.q;
    }
    return 0;
  };
  const md = qFor('text/markdown');
  return md > 0 && md > qFor('text/html');
}

/** Rough token count for a body (a token is about four characters). */
export const tokens = (body: string) => Math.ceil(body.length / 4);

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept',
  'Access-Control-Expose-Headers': 'Content-Location, Link, X-Markdown-Tokens',
};

/** The headers on every markdown response. `canonical` is the HTML page's address. */
export function markdownHeaders(body: string, canonical: string | null, o: { negotiated?: boolean; lastModified?: string | null } = {}) {
  const h = new Headers({
    'Content-Type': 'text/markdown; charset=utf-8',
    'X-Markdown-Tokens': String(tokens(body)),
    // the HTML page stays the one search engines index
    'X-Robots-Tag': 'noindex, follow',
    // the pages are static and change only with a deploy
    'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    ...CORS,
  });
  if (canonical) {
    h.set('Content-Location', canonical);
    h.set('Link', `<${canonical}>; rel="canonical"`);
  }
  if (o.negotiated) h.set('Vary', 'Accept');
  if (o.lastModified) h.set('Last-Modified', o.lastModified);
  return h;
}

/** The canonical address a page's markdown names on its "Canonical:" line. */
export const canonicalOf = (body: string) => body.match(/^Canonical: (\S+)$/m)?.[1] ?? null;

/** The "Last updated" date as an HTTP date, or null. */
export function lastModifiedOf(body: string) {
  const d = body.match(/^Last updated: (\d{4}-\d{2}-\d{2})$/m)?.[1];
  return d ? new Date(`${d}T00:00:00Z`).toUTCString() : null;
}

/** The body of a markdown 404. */
export const notFoundMarkdown = (path: string, origin: string) =>
  `# Not found\n\n> There is no page at ${path}, or it has no markdown version.\n\nEvery page with a markdown version is listed in ${origin}/llms.txt and ${origin}/api/md/_catalog.\n`;
