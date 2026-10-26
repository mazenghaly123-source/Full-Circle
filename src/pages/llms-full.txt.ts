// Every page in llms.txt, in markdown, in one file: src/md/agents.ts.
import type { APIRoute } from 'astro';
import { llmsFullTxt } from '../md/agents';

export const GET: APIRoute = ({ site }) => new Response(llmsFullTxt(site!), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
