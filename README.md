# Full Circle website

The site for Full Circle, a clothing development and manufacturing partner in Cairo.

- **Approved design:** `prototype/index.html` (open it in a browser; it is the source of truth).
- **Production site:** an Astro static site in `src/`, hosted on Cloudflare Workers
  ([docs/deploy.md](./docs/deploy.md)).
- **Plan, decisions and open questions:** [docs/production-plan.md](./docs/production-plan.md).

## Working on it

Needs Node 22.

```sh
npm ci
npm run dev        # local site with live reload
npm run build      # production build in dist/
npm run preview    # serve the build at http://localhost:4321
npm test           # parity with the prototype, behaviour and CSS checks
```

The first `npm test` needs Chromium for Playwright: `npx playwright install chromium`. The parity
tests open the prototype too, which loads its fonts from Google Fonts, so they need internet access.
