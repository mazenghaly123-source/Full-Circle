// Markdown building blocks for the pages' markdown versions (src/md/registry.ts). Every link is
// absolute and points at the HTML page, not its .md.

/** Escapes the characters that would turn plain text into markdown. */
export const esc = (s: string) => s.replace(/([\\`*_[\]<>|])/g, '\\$1');

/** An absolute URL on the site, from a path such as /about or /#faq. */
export const abs = (site: URL, path: string) => new URL(path, site).href;

/** A link, with its text escaped. */
export const link = (text: string, url: string) => `[${esc(text)}](${url})`;

export const h2 = (s: string) => `## ${esc(s)}`;
export const h3 = (s: string) => `### ${esc(s)}`;

/** A bulleted list. */
export const list = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

/** A numbered list. */
export const ordered = (items: string[]) => items.map((i, n) => `${n + 1}. ${i}`).join('\n');

/** A table; cells are escaped, so pass plain text. */
export const table = (head: string[], rows: string[][]) =>
  [head, head.map(() => '---'), ...rows].map((r) => `| ${r.map((c) => (c === '---' ? c : esc(c))).join(' | ')} |`).join('\n');

/** Bold text. */
export const b = (s: string) => `**${esc(s)}**`;

/** A date as YYYY-MM-DD. */
export const day = (d: Date) => d.toISOString().slice(0, 10);

/** The parts of a page's markdown version, joined in the order every page uses. */
export function page(p: { title: string; summary: string; canonical: string; updated: string; body: string[]; related: [string, string][] }) {
  return [
    `# ${esc(p.title)}`,
    `> ${esc(p.summary)}`,
    `Canonical: ${p.canonical}\nLast updated: ${p.updated}`,
    ...p.body,
    p.related.length ? `${h2('Related')}\n${list(p.related.map(([t, u]) => link(t, u)))}` : '',
  ].filter(Boolean).join('\n\n') + '\n';
}
