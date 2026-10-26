// How AI systems may use the site's content: src/md/agents.ts.
import type { APIRoute } from 'astro';
import { aiTxt } from '../md/agents';

export const GET: APIRoute = ({ site }) => new Response(aiTxt(site!), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
