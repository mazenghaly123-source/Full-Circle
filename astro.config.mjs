// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig, fontProviders } from 'astro/config';

/**
 * Local @font-face variants for a Fontsource package (the Google Fonts files, installed from npm and
 * pinned in package-lock.json). Fully local, so a build never depends on reaching a font CDN.
 * @param {string} pkg  e.g. '@fontsource/geist'
 * @param {number[]} weights
 * @param {string[]} subsets  e.g. ['latin', 'latin-ext']
 */
function fontsource(pkg, weights, subsets) {
  const variants = [];
  for (const weight of weights) {
    const css = readFileSync(new URL(`./node_modules/${pkg}/${weight}.css`, import.meta.url), 'utf8');
    for (const [, name, body] of css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face\s*{([^}]*)}/g)) {
      const subset = name.replace(/^.*?-(?=(?:latin|latin-ext|cyrillic|cyrillic-ext|greek|greek-ext|vietnamese)-\d)/, '').replace(/-\d+-normal$/, '');
      if (!subsets.includes(subset)) continue;
      const file = body.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
      const range = body.match(/unicode-range:\s*([^;]+);/)?.[1];
      if (!file || !range) continue;
      variants.push({ src: [`./node_modules/${pkg}/files/${file}`], weight, style: 'normal', unicodeRange: range.split(',').map((r) => r.trim()) });
    }
  }
  if (!variants.length) throw new Error(`No font files found for ${pkg}`);
  return { variants };
}

const SUBSETS = ['latin', 'latin-ext'];

export default defineConfig({
  // site: set to the real domain once it is bought (needed for the sitemap and canonical URLs)
  prefetch: true,
  vite: {
    // Phones on iOS 15–17 are still common and need -webkit-backdrop-filter (header, phone bar,
    // demo ticket). With Vite's default targets (Safari 16.4+) the CSS minifier drops it.
    build: { cssTarget: ['chrome111', 'edge111', 'firefox114', 'safari15', 'ios15'] },
  },
  fonts: [
    { provider: fontProviders.local(), name: 'Saira Condensed', cssVariable: '--font-saira-condensed', fallbacks: ['Arial Narrow', 'sans-serif'], options: fontsource('@fontsource/saira-condensed', [700], SUBSETS) },
    { provider: fontProviders.local(), name: 'Geist', cssVariable: '--font-geist', fallbacks: ['system-ui', 'sans-serif'], options: fontsource('@fontsource/geist', [400, 500, 600], SUBSETS) },
    { provider: fontProviders.local(), name: 'IBM Plex Mono', cssVariable: '--font-plex-mono', fallbacks: ['ui-monospace', 'monospace'], options: fontsource('@fontsource/ibm-plex-mono', [400, 500], SUBSETS) },
  ],
});
