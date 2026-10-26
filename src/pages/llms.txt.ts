// What the site is and where its pages are, for AI agents (llmstxt.org): src/md/agents.ts.
import type { APIRoute } from 'astro';
import { llmsTxt } from '../md/agents';

export const GET: APIRoute = ({ site }) => new Response(llmsTxt(site!), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
