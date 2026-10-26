// The markdown versions of the pages and the files for AI agents (src/md/, src/worker.ts): which
// requests get markdown, the headers they carry, and the lists that must agree with one another.
// Their words against the HTML pages are checked on the built site, in tests/md.spec.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import worker from '../../src/worker';
import { aiTxt, catalog, llmsFullTxt, llmsTxt, robotsTxt } from '../../src/md/agents';
import { prefersMarkdown } from '../../src/md/http';
import { MARKDOWN_SKIPPED, listMarkdownRoutes, mdFile, renderMarkdown } from '../../src/md/registry';
import { PRIVATE_PATHS, SITE } from '../../src/data/site';

const site = new URL('https://fullcircle-co.com');

test('markdown is served only when it is preferred over HTML', () => {
  expect(prefersMarkdown('text/markdown')).toBe(true);
  expect(prefersMarkdown('text/markdown, text/html;q=0.9')).toBe(true);
  expect(prefersMarkdown('text/html;q=0.5, text/markdown;q=0.8')).toBe(true);
  expect(prefersMarkdown('text/markdown, */*;q=0.1')).toBe(true);
  // HTML stays: no header, a bare wildcard, a tie, HTML first, or markdown refused
  for (const a of [null, '', '*/*', 'text/markdown, text/html', 'text/html, text/markdown;q=0.9', 'text/*', 'text/html,application/xhtml+xml,*/*;q=0.8', 'text/markdown;q=0, */*'])
    expect(prefersMarkdown(a), String(a)).toBe(false);
});

test('every public page has a markdown version, or a reason in the skip list', () => {
  const routes = listMarkdownRoutes().map((r) => r.path);
  const pages = readdirSync('src/pages').filter((f) => f.endsWith('.astro')).map((f) => f.replace(/\.astro$/, '')).map((f) => (f === 'index' ? '/' : `/${f}`));
  for (const p of pages) expect(routes.includes(p) || p in MARKDOWN_SKIPPED, `${p} has no markdown renderer and is not in MARKDOWN_SKIPPED`).toBe(true);
  // the Worker runs on exactly these pages (wrangler.jsonc), and never on a private one
  const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  const first: string[] = wrangler.assets.run_worker_first;
  expect(first.filter((p) => !p.includes('*') && !p.startsWith('/api/')).sort()).toEqual([...routes].sort());
  for (const p of PRIVATE_PATHS) expect(first).not.toContain(p);
});

test('each markdown page has its title, summary, canonical address, date and absolute links', () => {
  for (const r of listMarkdownRoutes()) {
    const md = renderMarkdown(r, site);
    // the date is left out where git cannot tell it (a shallow clone)
    expect(md, r.path).toMatch(/^# .+\n\n> .+\n\nCanonical: https:\/\/fullcircle-co\.com\/\S*\n(Last updated: \d{4}-\d{2}-\d{2}\n)?\n/);
    expect(md).toContain(`Canonical: ${new URL(r.path, site).href}\n`);
    for (const [, url] of md.matchAll(/\]\(([^)]+)\)/g)) {
      expect(url, `${r.path}: ${url}`).toMatch(/^(https:|mailto:)/);
      expect(url).not.toMatch(/\.md$/);
    }
    expect(md).not.toMatch(/<[a-z]/i);
  }
});

/** The Worker, on assets made of the markdown pages, the catalog and an HTML page for everything else. */
async function ask(path: string, init: RequestInit = {}) {
  const files = new Map(listMarkdownRoutes().map((r) => [`/${mdFile(r.path)}.md`, renderMarkdown(r, site)]));
  files.set('/api/md/catalog.json', JSON.stringify(catalog(site)));
  const env = {
    ASSETS: {
      fetch: async (input: Request | URL | string) => {
        const p = new URL(input instanceof Request ? input.url : String(input)).pathname;
        const body = files.get(p);
        if (body !== undefined) return new Response(body, { headers: { 'Content-Type': p.endsWith('.md') ? 'text/markdown' : 'application/json' } });
        return p.endsWith('.md') || p.startsWith('/api/') ? new Response('<h1>404</h1>', { status: 404, headers: { 'Content-Type': 'text/html' } })
          : new Response('<h1>page</h1>', { headers: { 'Content-Type': 'text/html' } });
      },
    },
  };
  return worker.fetch(new Request(new URL(path, site), init), env);
}

test('the Worker: .md, Accept and /api/md/ give markdown with its headers; everything else gives HTML', async () => {
  const md = await ask('/what-we-make.md');
  expect(md.status).toBe(200);
  expect(md.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  expect(md.headers.get('x-robots-tag')).toBe('noindex, follow');
  expect(md.headers.get('content-location')).toBe('https://fullcircle-co.com/what-we-make');
  expect(md.headers.get('link')).toBe('<https://fullcircle-co.com/what-we-make>; rel="canonical"');
  expect(md.headers.get('access-control-allow-origin')).toBe('*');
  const body = await md.text();
  if (body.includes('\nLast updated: ')) expect(md.headers.get('last-modified')).toMatch(/GMT$/);
  else expect(md.headers.get('last-modified')).toBeNull();
  expect(Number(md.headers.get('x-markdown-tokens'))).toBe(Math.ceil(body.length / 4));
  expect(body).toContain('| Denim | From 150 pcs / colour |');
  expect(md.headers.get('vary')).toBeNull();

  const home = await ask('/index.md');
  expect(await home.text()).toMatch(/^# Full Circle \/ Clothing manufacturer in Cairo, Egypt\n/);

  const negotiated = await ask('/about', { headers: { Accept: 'text/markdown' } });
  expect(negotiated.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  expect(negotiated.headers.get('vary')).toBe('Accept');
  expect(await negotiated.text()).toContain('Canonical: https://fullcircle-co.com/about\n');
  expect(await (await ask('/', { headers: { Accept: 'text/markdown' } })).text()).toContain('Canonical: https://fullcircle-co.com/\n');

  for (const accept of ['*/*', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', '']) {
    const html = await ask('/about', accept ? { headers: { Accept: accept } } : {});
    expect(html.headers.get('content-type'), accept).toBe('text/html');
    expect(html.headers.get('vary')).toContain('Accept');
    expect(html.headers.get('link')).toBe('</llms.txt>; rel="describedby", </llms-full.txt>; rel="describedby", </ai.txt>; rel="describedby"');
  }

  for (const p of ['/api/md/contact', '/api/md/contact.md']) expect(await (await ask(p)).text()).toContain('Canonical: https://fullcircle-co.com/contact\n');
  expect(await (await ask('/api/md/')).text()).toContain('Canonical: https://fullcircle-co.com/\n');
  const list = await ask('/api/md/_catalog');
  expect(list.headers.get('content-type')).toBe('application/json; charset=utf-8');
  expect((await list.json()).pages).toHaveLength(listMarkdownRoutes().length);
});

test('the Worker: a page with no markdown is a markdown 404; HEAD and OPTIONS answer without a body', async () => {
  for (const p of ['/does-not-exist.md', '/admin.md', '/api/md/admin', '/404.md']) {
    const res = await ask(p);
    expect(res.status, p).toBe(404);
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(await res.text()).toMatch(/^# Not found\n/);
  }
  const head = await ask('/about.md', { method: 'HEAD' });
  expect(head.status).toBe(200);
  expect(head.headers.get('x-markdown-tokens')).not.toBeNull();
  expect(await head.text()).toBe('');
  const pre = await ask('/about.md', { method: 'OPTIONS' });
  expect(pre.status).toBe(204);
  expect(pre.headers.get('access-control-allow-methods')).toBe('GET, HEAD, OPTIONS');
});

test('robots.txt, llms.txt and ai.txt agree: the same business, pages and private paths', () => {
  const robots = robotsTxt(site), llms = llmsTxt(site), ai = aiTxt(site);
  for (const bot of ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider'])
    expect(robots).toContain(`User-agent: ${bot}\n`);
  expect(robots).not.toMatch(/^Disallow: \/$/m);
  expect(robots).toContain('Sitemap: https://fullcircle-co.com/sitemap.xml');
  for (const p of PRIVATE_PATHS) {
    // every group repeats it: a crawler named in a group ignores the * group
    expect(robots.match(new RegExp(`^Disallow: ${p}$`, 'gm'))).toHaveLength(3);
    expect(ai).toContain(`Excluded: ${PRIVATE_PATHS.join(', ')}.`);
  }
  for (const f of [robots, llms, ai]) expect(f).toMatch(/keep in sync with/i);
  // llms.txt: the llmstxt.org shape, and a link to every markdown page
  expect(llms).toMatch(/^# Full Circle\n\n> .+\n\n/);
  expect(llms).toContain(`> ${SITE.summary}\n`);
  expect(ai).toContain(`\n${SITE.summary}\n`);
  expect(ai).toContain('Website: [https://fullcircle-co.com/](https://fullcircle-co.com/)\n');
  for (const r of listMarkdownRoutes()) expect(llms).toContain(`](https://fullcircle-co.com/${mdFile(r.path)}.md): `);
  // ai.txt (ai-visibility.org.uk v1.7.0): one H1, the identity lines, then the required and recommended sections
  expect(ai.match(/^# AI Usage Policy for Full Circle$/gm)).toHaveLength(1);
  expect(ai).toMatch(/^Last Updated: \d{4}-\d{2}-\d{2}$/m);
  for (const s of ['Permissions', 'Restrictions', 'Attribution Requirements', 'Contact', 'Related Files']) expect(ai).toContain(`\n## ${s}\n`);
  for (const [, u] of ai.matchAll(/\]\(([^)]+)\)/g)) expect(u).toMatch(/^https:/);
  // llms-full.txt: every page, from the same renderer
  const full = llmsFullTxt(site);
  for (const r of listMarkdownRoutes()) {
    expect(full).toContain(`<!-- source: ${new URL(r.path, site).href} -->\n\n${renderMarkdown(r, site)}`);
  }
  expect(full.length).toBeLessThan(500_000);
});
