# Handoff (23 Oct 2026)

For a new Claude session that has none of the earlier chat history. Read this first, then
[CLAUDE.md](../CLAUDE.md), [production-plan.md](./production-plan.md) §2 and §10,
[deploy.md](./deploy.md) and [whatsapp.md](./whatsapp.md). Everything below was checked on 23 Oct
2026 against GitHub, the staging Supabase project and the PRs. Where something could not be checked
from a cloud session, it says so.

## Branches

| Branch | Holds | State |
|---|---|---|
| `main` | Phases 1 and 2, the shorter words with no TBC (PR #6), the domain wiring (PR #7) | Live |
| `claude/phase-3-portal` | Phase 3: clients, orders, the real portal on `/track` | PR #8 → `main`, open |
| `claude/phase-4-admin` | Phase 3 + phase 4 admin (`/admin`), the `invite` and `notify` functions | PR #9 → `main`, open |
| `claude/phase-5-seo` | Phase 4 admin + phase 5 search and sharing (canonical URLs, `og.jpg`, sitemap, robots, structured data, HSTS) | PR #10 → `claude/phase-4-admin`, open |
| **`claude/phase-4-whatsapp`** | **Newest. Holds all of the above** + WhatsApp from the system number (`send-sms`, `whatsapp-webhook`) + this handoff | PR #11 → `claude/phase-5-seo`, open |
| `claude/keen-gates-vu1na0` | One unmerged commit (13 Oct): enables Cloudflare's Claude Code plugin in `.claude/settings.json`. Everything else on it is merged (PRs #1, #2) | Optional, can be dropped |
| `claude/phase-2-requests`, `claude/intelligent-fermi-ddqnas`, `claude/audit-code-cleanup`, `claude/bold-mccarthy-t9fppt`, `claude/trusting-albattani-5sxko8` | Already fully in `main` | Safe to delete |

The branches are stacked: each one contains the one above it. `claude/phase-4-whatsapp` is 15
commits ahead of `main` and 0 behind. **Merge order: #8 → #9 → #10 → #11.** After each merge, point
the next PR's base at `main`. Merging #11's branch alone gives the same result. Before merging, read
the gotcha *Merging to main changes the live site*.

CI on every open PR: the GitHub `site` and `backend` jobs pass. Cloudflare's **Workers Builds:
full-circle** check fails a few seconds after it starts, and it has done so on every PR since #6.
Its log is only in the Cloudflare dashboard (Workers & Pages → `full-circle` → Builds), so nobody
has read it yet.

## Live vs not

- **Live, from `main`:** the 7 pages and the 404 at parity with the prototype, `/privacy`, and the
  request and contact forms, which send to **staging** Supabase (test data). Track is still the
  prototype's **demo** portal. Cloudflare deploys `main` to **fullcircle-co.com** (+ `www`) and
  **full-circle.mazenghaly123.workers.dev**. A cloud session cannot reach those hosts, so whether the
  domain answers was not checked here.
- **Only on branches:** the real portal (phase 3), `/admin` (phase 4), WhatsApp (phase 4), and
  search and sharing (phase 5).

## Supabase staging

- Project **full-circle-staging**, ref **`kmsrzeqxgufrodefclty`**, Frankfurt (eu-central-1), free
  plan, test data only. The live project does not exist yet; it is created at launch.
- **Migrations applied** (all 8 in `supabase/migrations/`, and the versions match):
  `20261015103850` requests_and_messages, `20261015103905` consents_request_index,
  `20261015140000` requests_without_files, `20261020221044` clients_orders_and_portal,
  `20261021002550` order_code_suffix, `20261021003118` admin_functions_support,
  `20261021022945` sample_gate_latest, `20261021064023` whatsapp.
- **Edge Functions deployed** (all with the JWT check off):
  - `submit-request` and `submit-contact`, v4 (15 Oct): phase 2 code.
  - `invite` and `notify`, v2 (21 Oct): phase 4 admin code from **before** the WhatsApp commit.
    The deployed `notify` still logs WhatsApp as "starts in phase 4".
  - **Not deployed:** `send-sms` and `whatsapp-webhook`, and the WhatsApp versions of `invite`,
    `notify` and `submit-request` (commit `66ca03d`).
- **Secrets.** The MCP cannot list secret names, so these were inferred:
  - Set: `RESEND_API_KEY`. The 20 Oct test email reached Resend and was refused as a test-sender
    send.
  - Supplied by Supabase automatically: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_SECRET_KEYS`.
  - Not confirmed: `EMAIL_FROM`. It was not working on 20 Oct, and there has been no test since the
    Resend domain was verified on 21 Oct.
  - Not set, as far as we know: `TURNSTILE_SECRET_KEY` (staging falls back to Cloudflare's
    always-pass test key), `STAFF_EMAILS` and `SITE_URL` (the defaults are used), `WHATSAPP_TOKEN`,
    `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` and `SEND_SMS_HOOK_SECRET`.
  - Check the real list in the dashboard (Edge Functions → Secrets).
- Data on staging: 1 staff, 1 client, 3 orders, 4 requests, 1 Auth user, and the bucket
  `stage-photos`.
- Auth settings (sign-ups off, OTP expiry, `{{ .Token }}` template, SMTP, captcha, phone hook) are
  **not confirmed** as done. See *Waiting on Mazen*.

## Cloudflare

- Hosting is Workers with static assets ([ADR 0002](./adr/0002-cloudflare-workers-static-assets.md)).
  `wrangler.jsonc` holds the whole configuration. Cloudflare's Git integration builds every push:
  `main` deploys live, and other branches get preview URLs (those preview builds currently fail, see
  above).
- **Set by hand in the dashboard:**
  - The GitHub connection.
  - Build command `npm run build`, deploy command `npx wrangler deploy`, and preview builds on.
  - workers.dev turned on (Worker → Domains and routes → workers.dev → Enable).
  - The domain's nameservers, moved at GoDaddy to `alfred.ns.cloudflare.com` and
    `eve.ns.cloudflare.com`.
  - The custom domains themselves come from `wrangler.jsonc` (`routes`); no DNS was added by hand.
- **Not done yet:**
  - `"workers_dev": false` once the domain is confirmed live.
  - Turning off Cloudflare Web Analytics on the zone.
  - The Turnstile widget.
  - Production build variables (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_KEY`,
    `PUBLIC_TURNSTILE_SITE_KEY`): none are set, so every build uses staging.
- **Vercel is still connected.** Its GitHub app builds a preview of every PR
  (`mazen-s-projects2/full-circle`), although hosting is Cloudflare only (PR #6). Disconnect it
  unless it is wanted.

## In progress when we stopped (21 Oct)

1. **WhatsApp is built but not deployed to staging.** Its migration is applied; its functions are
   not. Next step: deploy `send-sms`, `whatsapp-webhook`, `invite`, `notify` and `submit-request`
   from `claude/phase-4-whatsapp` to staging with the JWT check off. Without Meta's secrets they log
   WhatsApp as skipped, which is safe.
2. **The Cloudflare preview build fails on every PR.** Next step: Mazen opens one failed build's
   log in the dashboard and pastes it into the session. Then fix it (likely a build setting or the
   preview command for non-production branches).
3. **Email is not confirmed end to end.** Next step: once `EMAIL_FROM` is set, send one test
   request on a preview or the live site. Then check that the staff alert and the receipt arrive,
   and that `notifications` shows `sent`.
4. **Phase 4's "done when"** (a test order through all 8 stages from a phone, on staging) has not
   been tried. It needs the Auth settings below, so that staff and a test client can get codes.

## Waiting on Mazen

Decisions:
- The **5 items "decided in the build"** ([production-plan.md](./production-plan.md) §2):
  1. A new code for orders that don't come from a request, and `-B` for a second order from one
     request.
  2. The sample gate is enforced by the database.
  3. No Undo: a stage can be moved back.
  4. A decision can be opened without photos.
  5. When a person is removed, the log keeps their name.
- **Staff roles** (owner / staff, §4) and the **names and emails of the 4 staff**.
- **When to merge phases 3–5 to `main`.** See the gotcha below.
- Keep or drop the Cloudflare plugin commit on `claude/keen-gates-vu1na0`, and whether to disconnect
  Vercel.

Dashboard and account tasks:
- **Supabase Auth (staging):**
  - Turn off "Allow new users to sign up".
  - Set the email OTP expiry to 600 s.
  - Put `{{ .Token }}` in the Magic Link template.
  - Set SMTP to Resend (sender `hello@fullcircle-co.com`).
- **`EMAIL_FROM`** = `Full Circle <hello@fullcircle-co.com>` (Edge Functions → Secrets).
- **Turnstile:**
  - Create a widget for fullcircle-co.com (Invisible).
  - At launch, put its site key in the build and its secret in the functions and Auth's Attack
    Protection.
- **Meta:**
  - A Business portfolio and a WhatsApp app (business verification uses Full Circle's documents).
  - A **new SIM** for the system number.
  - Submit and approve the **6 templates** in [whatsapp.md](./whatsapp.md).
  - Then set the 5 WhatsApp secrets and the Send SMS hook.
- **Real photos:** atelier-1..5, about-floor, team-1..4. The team section stays hidden
  (`SHOW_TEAM`) until there are names and portraits.
- At launch: the live Supabase project (Pro), Umami (EU), and the PDPC filings (§7).

## Gotchas

- **Merging to `main` changes the live site.**
  - Track's demo is replaced by a real sign-in against **staging**, and `/admin` goes up. Codes only
    work once the Auth settings above are done.
  - Live forms already write to staging, so the live project should exist before real clients use
    the site.
  - Ask Mazen before merging.
- **Don't set `TURNSTILE_SECRET_KEY` on staging** while builds still use the test site key
  (`src/data/backend.ts`). Every form would then be refused. Change both together.
- **Supabase MCP and destructive SQL:**
  - DROP, DELETE and TRUNCATE (even inside a transaction that is rolled back) wait for a
    confirmation that never reaches a cloud session, so they time out.
  - Give Mazen the SQL to run in the dashboard's SQL editor, with an insert into
    `supabase_migrations.schema_migrations`.
  - Name each local migration file with the version staging records.
  - Never edit an applied migration; add a new one.
- **Parity is the bar:**
  - `tests/parity.spec.ts` compares every page with `prototype/index.html` at 1440×900, 390×844 and
    375×667.
  - Never edit the prototype.
  - Approved departures go in the *approved changes* block at the end of `src/styles/global.css`,
    mirrored in `approvePrototype` (`tests/helpers.ts`).
  - `/admin` has its own design and no parity check.
- **three.js is pinned to 0.160.0** so the 3D mark renders like the prototype's. The mesh is built
  in a Web Worker. Don't upgrade it.
- **`-webkit-backdrop-filter` goes before `backdrop-filter`.** `tests/css.spec.ts` checks that the
  minifier kept every rule.
- **No test reaches the real backend.** The browser suites use `mockBackend`, `mockPortal` and
  `mockAdmin`. Without Docker (a cloud session), run the database tests with
  `scripts/test-db-local.sh`.
- **The Supabase CLI is pinned** as `npx supabase@2.121.0`. The function tests need
  `SEND_SMS_HOOK_SECRET` set before `supabase start` (see the CI *backend* job).
- **Mazen's rules** (CLAUDE.md):
  - Confirm big builds with him first.
  - No Arabic site until he asks.
  - No AI photos of the atelier, the floor or the team.
  - No Higgsfield Nano Banana / GPT Image; give him prompts instead.
  - Keep the words short, with no TBC.
  - Don't raise the legal review again.
- The repo on GitHub is `mazenghaly123-source/Full-Circle`.

## Next 3 steps

1. **Get the PRs green and merge-ready.** Read the failed Cloudflare build log (from Mazen) and fix
   the preview build. Deploy the WhatsApp-era functions to staging (*In progress* 1).
2. **Prove phases 2–4 on staging.** Once Mazen has done the Auth settings and `EMAIL_FROM`: send a
   test request (email arrives), convert it to an order in `/admin`, sign in to `/track` as the
   client, and take the order through all 8 stages from a phone.
3. **Merge #8 → #11 to `main`** once Mazen agrees. Then do the phase 5 launch items: the live
   Supabase project, Turnstile, the production build variables, `workers_dev: false`, Umami, and
   Lighthouse on the domain.
