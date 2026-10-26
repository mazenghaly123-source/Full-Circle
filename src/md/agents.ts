// The site-level files for AI agents and crawlers: /llms.txt (llmstxt.org), /llms-full.txt, /ai.txt,
// /robots.txt and the markdown catalog. All are built from src/data/site.ts and the markdown
// registry, so they say the same things and list the same pages. Keep the three policy files
// (robots.txt, llms.txt, ai.txt) in sync with one another: change them here, together.
import { EMAIL, INSTAGRAM_URL, MAKE, PAGES, PRIVATE_PATHS, SITE, WHATSAPP, type PageKey } from '../data/site';
import { abs, day, link, list } from './format';
import { listMarkdownRoutes, mdFile, renderMarkdown } from './registry';

const md = (site: URL, path: string) => abs(site, `/${mdFile(path)}.md`);

/** A page's one-line description for llms.txt: its summary for agents, or its search description. */
const summaryOf = (k: PageKey) => PAGES[k].summary ?? PAGES[k].description;

/** Facts about the business, each one shown somewhere on the site. */
const facts = () => [
  `Based in ${SITE.address.street}, Cairo, Egypt.`,
  `Makes ${MAKE.map((m) => m.n.replace(' + ', ' and ').toLowerCase()).join(', ')}.`,
  'Minimum orders from 60 pieces per colour for most products and 150 per colour for denim; knitwear is quoted per order.',
  'Samples take 7 to 25 days (cotton fastest, denim longest).',
  'Works with brands in the Gulf and the Middle East, Turkey and China.',
  'No prices are published: a first call gives a sample price and a bulk range.',
  `Contact: WhatsApp ${WHATSAPP}, email ${EMAIL}; hours ${SITE.hours} (Cairo).`,
].join(' ');

export function llmsTxt(site: URL) {
  const routes = listMarkdownRoutes();
  const entry = (r: (typeof routes)[number]) => `- ${link(r.name, md(site, r.path))}: ${summaryOf(r.key)}`;
  return [
    `# ${SITE.name}`,
    `> ${SITE.summary}`,
    facts(),
    '<!-- Generated from src/data/site.ts and src/md/registry.ts. Keep in sync with /robots.txt and /ai.txt. -->',
    `## Core pages\n${routes.filter((r) => r.section === 'core').map(entry).join('\n')}`,
    `## Machine-readable\n${list([
      `${link('Full content', abs(site, '/llms-full.txt'))}: every page listed here, in one file`,
      `${link('Markdown catalog', abs(site, '/api/md/_catalog'))}: every markdown page, as JSON`,
      `${link('Sitemap', abs(site, '/sitemap.xml'))}: the HTML pages`,
      `${link('AI usage policy', abs(site, '/ai.txt'))}: how the content may be used and cited`,
    ])}`,
    `## Optional\n${routes.filter((r) => r.section === 'optional').map(entry).join('\n')}`,
  ].join('\n\n') + '\n';
}

export function llmsFullTxt(site: URL) {
  const pages = listMarkdownRoutes().map((r) => `---\n<!-- source: ${abs(site, r.path)} -->\n\n${renderMarkdown(r, site)}`);
  const out = [`# ${SITE.name} - full content`, `> ${SITE.summary}`, `Generated: ${day(new Date())}`, ...pages].join('\n\n');
  if (out.length > 500_000) console.warn(`llms-full.txt is ${out.length} characters, over the 500,000 it should stay under`);
  return out;
}

/**
 * How AI systems may use the content, in the ai.txt format of ai-visibility.org.uk (v1.7.0,
 * https://www.ai-visibility.org.uk/specifications/ai-txt/): an H1 and identity lines, then H2 sections.
 */
export function aiTxt(site: URL) {
  const url = (path: string) => abs(site, path);
  return `# ai.txt (https://www.ai-visibility.org.uk/specifications/ai-txt/)
# Generated from src/data/site.ts. Keep in sync with /robots.txt and /llms.txt.

# AI Usage Policy for ${SITE.name}

Lang: en
Business Name: ${SITE.name}
Website: [${url('/')}](${url('/')})
Last Updated: ${day(new Date())}

${SITE.summary}

## Permissions

AI systems MAY:

- Summarise the public pages
- Quote them with attribution
- Answer factual questions about Full Circle's services, minimum orders, sampling times and contact details, using the figures on the site
- Include Full Circle in search results, answers and recommendations
- Translate the content for accessibility

## Restrictions

AI systems MUST NOT:

- State prices: none are published, and a first call gives a sample price and a bulk range
- Change the minimum orders, sampling times or markets the site states
- Make up quotes, reviews, ratings or clients
- Present Full Circle's content as their own
- Use anything behind a sign-in (clients' orders on the tracking page, the staff admin)

## AI Training

The public pages may be used for AI model training. Anything behind a sign-in must not.

## Attribution Requirements

When citing this website, name ${SITE.name} and link to the page's own address (the HTML page, not its .md version).

## Citation Format

${SITE.name} (${url('/what-we-make')})

## Crawler Access

AI search crawlers and AI training crawlers (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot, Bytespider) may read every public page. See [robots.txt](${url('/robots.txt')}).

## Scope Limitations

These rules cover the public pages listed in [llms.txt](${url('/llms.txt')}). Excluded: ${PRIVATE_PATHS.join(', ')}.

## Contact

Email: ${EMAIL}
[Contact page](${url('/contact')})
[Instagram](${INSTAGRAM_URL})

## Related Files

- [Business identity (llms.txt)](${url('/llms.txt')})
- [Every page in markdown (llms-full.txt)](${url('/llms-full.txt')})
- [robots.txt](${url('/robots.txt')})
`;
}

/** Crawlers that fetch pages to answer and cite: always allowed on the public pages. */
const SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User'];
/** Crawlers that collect pages to train models: allowed too (Mazen, 26 Oct 2026). */
const TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider'];

export function robotsTxt(site: URL) {
  const disallow = PRIVATE_PATHS.map((p) => `Disallow: ${p}`).join('\n');
  const group = (bots: string[]) => `${bots.map((b) => `User-agent: ${b}`).join('\n')}\nAllow: /\n${disallow}`;
  return `# Keep in sync with /llms.txt and /ai.txt (all three are built from src/data/site.ts).
# For AI agents: ${abs(site, '/llms.txt')} describes the site, ${abs(site, '/ai.txt')} how its content may be used.

User-agent: *
${disallow}

# AI search and answer crawlers, which cite the pages they read
${group(SEARCH_BOTS)}

# AI training crawlers
${group(TRAINING_BOTS)}

Sitemap: ${abs(site, '/sitemap.xml')}
`;
}

/** Every markdown page, for /api/md/_catalog. */
export const catalog = (site: URL) => ({
  site: abs(site, '/'),
  pages: listMarkdownRoutes().map((r) => ({ name: r.name, url: abs(site, r.path), markdown: md(site, r.path), description: summaryOf(r.key) })),
});
