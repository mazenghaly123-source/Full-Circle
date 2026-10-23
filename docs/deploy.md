# Deploying to Cloudflare

The site is static and is hosted on **Cloudflare Workers (static assets)**: see
[ADR 0002](./adr/0002-cloudflare-workers-static-assets.md). `wrangler.jsonc` in the repo root holds
the whole configuration (assets only, no Worker code). Once connected, Cloudflare builds every push:
`main` goes live, and every other branch or pull request gets its own preview URL.

Connected on 15 October 2026: the site answers on <https://full-circle.mazenghaly123.workers.dev/>.
(The workers.dev address had to be switched on by hand: Worker → **Domains and routes** →
**workers.dev** → **Enable**.)

Domain (20 October 2026): **fullcircle-co.com**, bought at GoDaddy, with its nameservers moved to
Cloudflare (`alfred.ns.cloudflare.com` and `eve.ns.cloudflare.com`). `wrangler.jsonc` lists it and `www` as Custom
Domains, so the deploy from `main` attaches them; no DNS record is added by hand for either.

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

## Backend (Supabase)

The request and contact forms post to two Edge Functions on Supabase (`supabase/functions/`), which
save to the database and email the team. Two more serve the portal and the admin: `invite` (staff add
a person to a client or to the team, who is emailed where to sign in) and `notify` (sends the queued
messages about orders). Until launch there is one project, **full-circle-staging**
(Frankfurt, free plan), for test data only. Every build of the site sends to it; nothing to set.

**Settings for the functions** (Supabase dashboard → Edge Functions → Secrets):

| Secret | What it is | Until it is set |
|---|---|---|
| `RESEND_API_KEY` | Sends the staff alerts and the request receipts | Nothing is emailed; each email is logged as skipped |
| `STAFF_EMAILS` | Who gets the alerts, comma-separated | fullcircleworks.co@gmail.com |
| `EMAIL_FROM` | The sender, e.g. `Full Circle <hello@your-domain>` | Resend's test sender, which can only write to the Resend account's own address |
| `TURNSTILE_SECRET_KEY` | The robot check (Cloudflare Turnstile) | Staging uses Cloudflare's test key, **which lets everything through**; any other project turns every form away |
| `SITE_URL` | Where the links in the order emails and invitations point. On staging, once the live site uses the live project, set it to a preview that builds against staging, or invited test clients land on the live site | https://fullcircle-co.com |

**At launch** (the live project):
1. Create the live project in Frankfurt (Pro plan) and apply `supabase/migrations/` to it.
2. Deploy the four functions with their JWT check off (the form functions check Turnstile instead;
   `invite` and `notify` check the signed-in caller themselves), and set the secrets above. Verify the domain at Resend first, so `EMAIL_FROM` can use it.
3. In Cloudflare, create a Turnstile widget for the domain (Invisible mode) and set the production
   build's variables `PUBLIC_SUPABASE_URL` (the live project's URL), `PUBLIC_SUPABASE_KEY` (its
   publishable key, for the portal's sign-in) and `PUBLIC_TURNSTILE_SITE_KEY` (the widget's site key).
   Previews keep using staging.
4. Set up the portal's sign-in on the live project as on staging (production plan §10): no sign-ups,
   the code in the Magic Link email, a 10-minute expiry, Resend as the SMTP sender, and Turnstile
   under Attack Protection.

With the Supabase CLI (`npx supabase@2.121.0`, signed in): `link --project-ref <ref>`, then
`db push` for the migrations and `functions deploy submit-request submit-contact invite notify --no-verify-jwt`.

**On your computer** (needs Docker): `npx supabase@2.121.0 start` runs the whole backend locally and
`npx supabase@2.121.0 test db` runs the database access tests. Without Docker,
`scripts/test-db-local.sh` runs the same tests on a plain PostgreSQL with pgTAP. The end-to-end function tests need a
`supabase/functions/.env` that points the functions at the stand-ins the tests start; the CI
*backend* job (`.github/workflows/ci.yml`) shows the four lines.

## Locally

```sh
npm ci
npm run build      # static site in dist/
npm run preview    # http://localhost:4321
npm test           # parity, behaviour and CSS tests (needs: npx playwright install chromium)
```
