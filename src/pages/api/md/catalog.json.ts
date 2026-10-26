// The list of markdown pages, which the Worker serves at /api/md/_catalog: src/md/agents.ts.
import type { APIRoute } from 'astro';
import { catalog } from '../../../md/agents';

export const GET: APIRoute = ({ site }) => Response.json(catalog(site!));
