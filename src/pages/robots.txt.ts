// Search engines and AI crawlers may read every page but the staff's admin, and find the pages in the
// sitemap; the rules are in src/md/agents.ts, with llms.txt and ai.txt.
import type { APIRoute } from 'astro';
import { robotsTxt } from '../md/agents';

export const GET: APIRoute = ({ site }) => new Response(robotsTxt(site!), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
