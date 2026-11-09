// The site's pages for search engines (robots.txt points here): every page with a markdown version
// (src/md/registry.ts), so a new page is listed once it has one, less the ones kept out of search (the
// portal's sign-in, PAGES[…].noindex). Each carries the date its words last changed in git, when git
// can tell (the same date as its markdown version's "Last updated").
import type { APIRoute } from 'astro';
import { PAGES } from '../data/site';
import { listMarkdownRoutes, updated } from '../md/registry';

export const GET: APIRoute = ({ site }) => {
  const pages = listMarkdownRoutes().filter((r) => !PAGES[r.key].noindex);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((r) => {
    const d = updated(r.sources);
    return `  <url><loc>${new URL(r.path, site)}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`;
  }).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
