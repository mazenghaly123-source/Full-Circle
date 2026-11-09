// Tells IndexNow (Bing, Yandex, Seznam, Naver…) that the site's pages changed, after a deploy (SEO audit,
// 9 Nov 2026; .github/workflows/indexnow.yml runs it once main is live). It sends every page in the live
// sitemap whose <lastmod> is within the last DAYS days, or every page when none says. The key file is
// public/<key>.txt, which IndexNow fetches to check the key belongs to the site.
//   node scripts/indexnow.mjs            submit
//   node scripts/indexnow.mjs --dry-run  only list what it would submit
import { readdirSync } from 'node:fs';

const HOST = 'fullcircle-co.com';
const DAYS = 2;
const dry = process.argv.includes('--dry-run');

const key = readdirSync('public').find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, -4);
if (!key) throw new Error('no IndexNow key file (public/<32 hex>.txt)');

const live = await fetch(`https://${HOST}/${key}.txt`);
if (!live.ok || (await live.text()).trim() !== key) throw new Error(`the key file is not live at https://${HOST}/${key}.txt yet`);

const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const pages = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)].map(([, loc, mod]) => ({ loc, mod }));
const since = Date.now() - DAYS * 86_400_000;
const fresh = pages.filter((p) => p.mod && Date.parse(p.mod) >= since);
const urlList = (fresh.length ? fresh : pages.some((p) => p.mod) ? [] : pages).map((p) => p.loc);

if (!urlList.length) {
  console.log('Nothing changed in the last', DAYS, 'days; nothing to submit.');
} else if (dry) {
  console.log('Would submit:\n' + urlList.join('\n'));
} else {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList }),
  });
  console.log(`IndexNow answered ${res.status} for ${urlList.length} page(s):\n${urlList.join('\n')}`);
  // 200 and 202 are both accepted
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}
