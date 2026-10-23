// The site's pages for search engines (robots.txt points here). The admin and the 404 page are left
// out; the portal's sign-in page is in, as it is in the menu.
import type { APIRoute } from 'astro';
import { ROUTES } from '../data/site';

export const GET: APIRoute = ({ site }) => {
  const pages = [...Object.values(ROUTES), '/privacy'];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${new URL(p, site)}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
