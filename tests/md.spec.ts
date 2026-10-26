// The markdown versions against the built pages: every sentence in a page's markdown is on its HTML
// page too (so the two cannot drift apart), and every page points agents at its markdown. The
// Worker's side (Accept, headers, 404s) is in tests/unit/md.spec.ts.
import { expect, test } from '@playwright/test';
import { listMarkdownRoutes, mdFile } from '../src/md/registry';
import { PAGES } from '../src/data/site';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'one viewport is enough: no layout here'));

/** Lower-case words only, so punctuation, markup and line breaks do not count. */
const words = (s: string) => s.toLowerCase().replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|’/g, "'").replace(/[^\p{L}\p{N}±]+/gu, ' ').trim();

/** The page's visible words: its <main>, without scripts, styles and SVG. */
const pageWords = (html: string) => words((html.match(/<main[^>]*>([\s\S]*)<\/main>/)?.[1] ?? '').replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' '));

/** The markdown's sentences and list items, from the body (below "Last updated") and not "Related". */
function phrases(md: string) {
  const body = md.split(/^Last updated: .*$/m)[1].split(/^## Related$/m)[0];
  return body
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\\(.)/g, '$1')
    .split(/\n|(?<=[.?!])\s+|: | \| |\(|\)/)
    .map(words)
    .filter((p) => p.split(' ').length >= 4);
}

for (const r of listMarkdownRoutes()) {
  test(`${r.path}: the markdown says only what the page says`, async ({ request }) => {
    const md = await (await request.get(`/${mdFile(r.path)}.md`)).text();
    const html = await (await request.get(r.path)).text();
    const text = pageWords(html);
    const missing = phrases(md).filter((p) => !text.includes(p));
    expect(missing, `in ${mdFile(r.path)}.md but not on ${r.path}`).toEqual([]);
  });
}

test('every page names its markdown and a summary for agents; Home describes the business and the site', async ({ page }) => {
  for (const r of listMarkdownRoutes()) {
    await page.goto(r.path);
    await expect(page.locator('head link[rel=alternate][type="text/markdown"]')).toHaveAttribute('href', `https://fullcircle-co.com/${mdFile(r.path)}.md`);
    await expect(page.locator('head meta[name=ai-summary]')).toHaveAttribute('content', PAGES[r.key].summary ?? PAGES[r.key].description);
  }
  await page.goto('/');
  const graph = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!)['@graph'];
  expect(graph.map((n: { '@type': string }) => n['@type'])).toEqual(['Organization', 'WebSite']);
  await page.goto('/no-such-page');
  await expect(page.locator('head link[rel=alternate][type="text/markdown"]')).toHaveCount(0);
});

test('llms.txt, llms-full.txt, ai.txt and robots.txt are served as text', async ({ request }) => {
  for (const f of ['/llms.txt', '/llms-full.txt', '/ai.txt', '/robots.txt']) {
    const res = await request.get(f);
    expect(res.status(), f).toBe(200);
    expect(res.headers()['content-type']).toMatch(/^text\/plain/);
  }
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain('.md<');
});
