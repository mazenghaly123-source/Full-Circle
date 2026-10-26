// Every page's markdown version as a .md file (/about.md, /index.md for Home), from the registry in
// src/md/registry.ts. The Worker (src/worker.ts) serves these with their headers, and also for
// `Accept: text/markdown` and /api/md/…
import type { APIRoute, GetStaticPaths } from 'astro';
import { canonicalOf, lastModifiedOf, markdownHeaders } from '../md/http';
import { listMarkdownRoutes, mdFile, renderMarkdown } from '../md/registry';

export const getStaticPaths = (() => listMarkdownRoutes().map((route) => ({ params: { page: mdFile(route.path) }, props: { route } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props, site }) => {
  const body = renderMarkdown(props.route, site!);
  return new Response(body, { headers: markdownHeaders(body, canonicalOf(body), { lastModified: lastModifiedOf(body) }) });
};
