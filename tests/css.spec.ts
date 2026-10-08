// The CSS minifier must not change the design. Every rule in src/styles/global.css is compared, as
// Chromium parses it, with the built stylesheet; values are compared by what they compute to.
// (It once kept only -webkit-backdrop-filter, which broke the phone menu in Chromium.)
import { readFileSync, readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

type Rules = Record<string, Record<string, string>>;

const collect = (page: Page, css: string) => page.evaluate((css) => {
  const sheet = new CSSStyleSheet(); sheet.replaceSync(css);
  const out: Record<string, Record<string, string>> = {};
  const add = (k: string, style: CSSStyleDeclaration) => {
    out[k] ??= {};
    for (let i = 0; i < style.length; i++) { const p = style[i]; out[k][p] = style.getPropertyValue(p) + (style.getPropertyPriority(p) ? ' !important' : ''); }
  };
  const walk = (rules: CSSRuleList, ctx: string) => {
    for (const r of rules) {
      if (r instanceof CSSMediaRule) walk(r.cssRules, `${ctx}@media ${r.conditionText} `);
      else if (r instanceof CSSStyleRule) {
        // the minifier may fold "a, b" into ":is(a, b)"
        const sel = r.selectorText.replace(/^:is\((.*)\)$/, '$1');
        for (const s of sel.split(/,(?![^(]*\))/).map((x) => x.trim())) add(ctx + s, r.style);
      } else if (r instanceof CSSKeyframesRule) for (const kf of r.cssRules) add(`@keyframes ${r.name} ${(kf as CSSKeyframeRule).keyText}`, (kf as CSSKeyframeRule).style);
    }
  };
  walk(sheet.cssRules, '');
  return out;
}, css);

/** Whether two values for a property compute to the same thing in Chromium. */
const sameValue = (page: Page, prop: string, a: string, b: string) => page.evaluate(([prop, a, b]) => {
  const compute = (v: string) => {
    v = v.replace(/ !important$/, '');
    if (prop.startsWith('--')) {
      if (/^(#|rgb)/.test(v.trim())) { const e = document.createElement('div'); document.body.append(e); e.style.color = v; const c = getComputedStyle(e).color; e.remove(); return c; }
      return v.replace(/["']/g, '').replace(/\s+/g, ' ').replace(/\b0\.(\d)/g, '.$1').trim();
    }
    const svg = prop.startsWith('stroke') || prop === 'fill';
    const el = svg ? document.createElementNS('http://www.w3.org/2000/svg', 'circle') : document.createElement('div');
    const host = svg ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : document.body;
    host.append(el); if (svg) document.body.append(host);
    (el as HTMLElement).style.setProperty(prop, v);
    let c = getComputedStyle(el).getPropertyValue(prop);
    (svg ? host : el).remove();
    // "initial" background positions and "0%" vs "0px" positions are the same place
    return c.replace(/\bat 0% /g, 'at 0px ').replace(/circle\(0% at 50% 50%\)/, 'circle(0%)');
  };
  return compute(a) === compute(b) || (/^background-position/.test(prop) && [a, b].every((v) => /^(initial|0px|0%)( !important)?$/.test(v.trim())));
}, [prop, a, b] as const);

test('built CSS keeps every rule of the source CSS', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'not viewport-dependent; run once');
  const source = readFileSync('src/styles/global.css', 'utf8');
  const dir = `${process.env.OUT_DIR ?? 'dist'}/_astro/`;
  const builtFile = readdirSync(dir).find((f) => f.endsWith('.css'));
  expect(builtFile, 'built stylesheet').toBeTruthy();
  const built = readFileSync(dir + builtFile, 'utf8');
  await page.setContent('<!doctype html><body></body>');
  const A: Rules = await collect(page, source), B: Rules = await collect(page, built);
  const problems: string[] = [];
  for (const [sel, decls] of Object.entries(A)) {
    const got = B[sel];
    if (!got) { problems.push(`missing rule: ${sel}`); continue; }
    for (const [prop, v] of Object.entries(decls)) {
      if (!(prop in got)) problems.push(`missing: ${sel} { ${prop}: ${v} }`);
      else if (got[prop] !== v && !(await sameValue(page, prop, v, got[prop]))) problems.push(`changed: ${sel} { ${prop}: ${v} } → ${got[prop]}`);
    }
  }
  expect(problems).toEqual([]);
  // Safari before 18 needs the prefixed form (Chromium ignores it, so it is checked as text)
  const prefixed = (css: string) => (css.match(/-webkit-backdrop-filter/g) ?? []).length;
  expect(prefixed(built)).toBeGreaterThanOrEqual(prefixed(source));
  expect(prefixed(built)).toBeGreaterThanOrEqual((built.match(/[^-]backdrop-filter/g) ?? []).length);
});
