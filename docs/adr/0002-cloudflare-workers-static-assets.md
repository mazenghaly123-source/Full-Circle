# Cloudflare Workers with static assets, not Pages

The site is fully static. Cloudflare now advises starting new projects on Workers rather than Pages,
and since September 2026 Workers Builds gives every branch and pull request its own preview URL. We
host on Workers with an assets-only `wrangler.jsonc` (no Worker code, no Astro adapter): asset
requests are free and unlimited, and the Supabase backend is called directly from the browser.

## Consequences

- Without a committed `wrangler.jsonc`, `wrangler deploy` tries to add the Astro Cloudflare adapter
  and a Worker; keep the assets-only config.
- Pages are built as `page.html` files (`build.format: 'file'`) so `/about` is served without a
  trailing-slash redirect.
- Preview builds bake in the same build variables as production. From phase 2, previews must point
  at a separate staging Supabase project, or sit behind Cloudflare Access.
- The domain has to be a Cloudflare zone (Cloudflare Registrar, or nameservers moved to Cloudflare).
