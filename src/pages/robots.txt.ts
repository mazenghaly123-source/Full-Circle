// Search engines may read the whole site but the staff's admin, and find its pages in the sitemap.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => new Response(`User-agent: *
Disallow: /admin

Sitemap: ${new URL('/sitemap.xml', site)}
`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
