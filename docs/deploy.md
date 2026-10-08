# Deploying to Cloudflare

The site is static and is hosted on **Cloudflare Workers (static assets)**: see
[ADR 0002](./adr/0002-cloudflare-workers-static-assets.md). `wrangler.jsonc` in the repo root holds
the whole configuration (assets only, no Worker code). Once connected, Cloudflare builds every push:
`main` goes live, and every other branch or pull request gets its own preview URL.

## Connect the repository (once, about 10 minutes)

1. Sign in to Cloudflare (or create a free account) with the account that should own the site.
2. **Workers & Pages → Create application → Import a repository**. Authorise the *Cloudflare Workers
   & Pages* GitHub app on `mazenghaly123-source/Full-Circle` and pick the repo.
3. Build settings (**Settings → Build**; labels can differ slightly as Cloudflare updates the page):
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - Preview command: `npx wrangler preview` (the default)
   - Root directory: `/`
4. Under **Branch control**, keep `main` as the production branch and tick **Enable Preview
   Builds**, so every branch and pull request gets its own preview URL (Cloudflare posts it on the
   pull request). Previews need Wrangler 4.135 or newer; the repo pins a newer one.
5. Save and deploy. The first build takes a few minutes (photos are converted once).

The site then answers on `full-circle.<your-subdomain>.workers.dev`.

## When the domain is bought

1. The domain must be a Cloudflare zone: buy it at Cloudflare Registrar, or point its nameservers
   at Cloudflare.
2. In the Worker: **Settings → Domains & Routes → Add → Custom domain**, add the domain (and `www`
   if wanted; then add a Redirect Rule from `www` to the bare domain).
3. In `wrangler.jsonc`, set `"workers_dev": false` so the `workers.dev` copy of the live site is not
   indexed by search engines (preview URLs stay on and are marked `noindex` by Cloudflare).
4. In `astro.config.mjs`, set `site` to the domain (needed for the sitemap and canonical links in
   phase 5).
5. In the Cloudflare dashboard for the domain, turn off **Web Analytics** (Cloudflare switches it on
   by default; the plan uses Umami instead).

## Share link on Vercel (until Cloudflare is connected)

To share the site before Cloudflare is set up, it is also deployed on Vercel (team "Mazen's
projects", project `full-circle`), built from this branch. `vercel.json` only applies there: it
serves the clean URLs (`/about` → `about.html`), copies the headers from `public/_headers`, and
marks the whole copy `noindex` so search engines never index it. Cloudflare stays the host
(ADR 0002); delete the Vercel project and `vercel.json` once the Cloudflare site is live.

## Locally

```sh
npm ci
npm run build      # static site in dist/
npm run preview    # http://localhost:4321
npm test           # parity, behaviour and CSS tests (needs: npx playwright install chromium)
```
