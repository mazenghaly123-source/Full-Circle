# Handoff (23 Oct 2026)

For a new Claude session that has none of the earlier chat history. Read this first, then
[CLAUDE.md](../CLAUDE.md), [production-plan.md](./production-plan.md) §2 and §10,
[deploy.md](./deploy.md) and [whatsapp.md](./whatsapp.md). Everything below was checked on 23 Oct
2026 against GitHub, the staging Supabase project and the PRs. Where something could not be checked
from a cloud session, it says so.

## Branches

| Branch | Holds | State |
|---|---|---|
| `main` | **Everything:** phases 1–4, phase 5's search and sharing, WhatsApp from the system number, and the redesign of Home (see *In progress*) | Live |
| `claude/tender-rubin-ahjc3t` | The redesign of Home + this handoff, on top of all the phases | Merged to `main` (23 Oct); the Home edits since then (see *In progress*) are not |
| `claude/phase-3-portal`, `claude/phase-4-admin`, `claude/phase-5-seo`, `claude/phase-4-whatsapp` | Phases 3–5 and WhatsApp (PRs #8 → #11) | Merged to `main` (23 Oct), safe to delete |
| `claude/keen-gates-vu1na0` | One unmerged commit (13 Oct): enables Cloudflare's Claude Code plugin in `.claude/settings.json`. Everything else on it is merged (PRs #1, #2) | Optional, can be dropped |
| `claude/phase-2-requests`, `claude/intelligent-fermi-ddqnas`, `claude/audit-code-cleanup`, `claude/bold-mccarthy-t9fppt`, `claude/trusting-albattani-5sxko8` | Already fully in `main` | Safe to delete |

Mazen asked on 23 Oct for everything to go to `main` so he can try the new site. The stacked PRs
were merged in order, #8 → #9 → #10 → #11 (each next PR's base moved to `main` first), then the
redesign branch. New work starts from `main`.

CI was green on every PR when it was merged (23 Oct): the GitHub `site` and `backend` jobs and Cloudflare's
**Workers Builds: full-circle**. That check had failed on every PR since #6: Wrangler 4.146's
`wrangler preview` refuses to run without a `previews` block in `wrangler.jsonc`, so the block was
added (empty) on `claude/phase-3-portal` and merged up the stack. Build logs are only in the
Cloudflare dashboard (Workers & Pages → `full-circle` → Builds).

## Live vs not

- **Live, from `main` (everything since 23 Oct):**
  - The 7 pages and the 404 at parity with the prototype, with Home redesigned, and `/privacy`.
  - The request and contact forms, which send to **staging** Supabase (test data).
  - The real portal on Track and `/admin`. Both sign in against **staging**, and codes only arrive
    once the Auth settings in *Waiting on Mazen* are done.
  - Search and sharing. WhatsApp from the system number is in the code but off until Meta's secrets
    are set.
- Cloudflare deploys `main` to **fullcircle-co.com** (+ `www`) and
  **full-circle.mazenghaly123.workers.dev**. A cloud session cannot reach those hosts, so whether the
  domain answers was not checked here.

## Supabase staging

- Project **full-circle-staging**, ref **`kmsrzeqxgufrodefclty`**, Frankfurt (eu-central-1), free
  plan, test data only. The live project does not exist yet; it is created at launch.
- **Migrations applied** (all 8 in `supabase/migrations/`, and the versions match):
  `20261015103850` requests_and_messages, `20261015103905` consents_request_index,
  `20261015140000` requests_without_files, `20261020221044` clients_orders_and_portal,
  `20261021002550` order_code_suffix, `20261021003118` admin_functions_support,
  `20261021022945` sample_gate_latest, `20261021064023` whatsapp.
- **Edge Functions deployed** (all with the JWT check off), all from `claude/phase-4-whatsapp`
  (23 Oct) except `submit-contact`, whose code has not changed since phase 2:
  - `submit-request` v6, `invite` v4, `notify` v4, `send-sms` v1, `whatsapp-webhook` v1.
  - `submit-contact` v4 (15 Oct).
  - Checked: test request FC-2509 (23 Oct, after the deploy) was saved and logged with the WhatsApp
    version's wording.
- **Secrets** (seen in the dashboard, 23 Oct):
  - Set: `RESEND_API_KEY` (20 Oct) and `EMAIL_FROM` = `Full Circle <hello@fullcircle-co.com>`
    (23 Oct). The staff alerts for FC-2508 and FC-2509 went out through Resend (`sent`). The receipt
    to a brand that gives an email has not been tried yet.
  - Supplied by Supabase automatically: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_SECRET_KEYS`.
  - Not set: `TURNSTILE_SECRET_KEY` (staging falls back to Cloudflare's always-pass test key),
    `STAFF_EMAILS` and `SITE_URL` (the defaults are used), `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`,
    `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` and `SEND_SMS_HOOK_SECRET`.
- Data on staging: 1 staff, 1 client, 3 orders, 6 requests (FC-2508 and FC-2509 are 23 Oct tests),
  1 Auth user, and the bucket `stage-photos`.
- Auth settings (sign-ups off, OTP expiry, `{{ .Token }}` template, SMTP, captcha, phone hook) are
  **not confirmed** as done. See *Waiting on Mazen*.

## Cloudflare

- Hosting is Workers with static assets ([ADR 0002](./adr/0002-cloudflare-workers-static-assets.md)).
  `wrangler.jsonc` holds the whole configuration. Cloudflare's Git integration builds every push:
  `main` deploys live with `npx wrangler deploy`, and other branches get preview URLs through
  `npx wrangler preview` (which needs the `previews` block in `wrangler.jsonc`).
- The domain is live: the deploy from `main` attached `fullcircle-co.com` and `www` (dashboard,
  23 Oct).
- **Set by hand in the dashboard:**
  - The GitHub connection.
  - Build command `npm run build`, deploy command `npx wrangler deploy`, and preview builds on.
  - workers.dev turned on (Worker → Domains and routes → workers.dev → Enable).
  - The domain's nameservers, moved at GoDaddy to `alfred.ns.cloudflare.com` and
    `eve.ns.cloudflare.com`.
  - The custom domains themselves come from `wrangler.jsonc` (`routes`); no DNS was added by hand.
- **Not done yet:**
  - `"workers_dev": false` (the domain is live, so this can go in with the launch items).
  - Turning off Cloudflare Web Analytics on the zone.
  - The Turnstile widget.
  - Production build variables (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_KEY`,
    `PUBLIC_TURNSTILE_SITE_KEY`): none are set, so every build uses staging.
- **Vercel is still connected.** Its GitHub app builds a preview of every PR
  (`mazen-s-projects2/full-circle`), although hosting is Cloudflare only (PR #6). Disconnect it
  unless it is wanted.

## In progress

Done on 23 Oct: the WhatsApp-era functions are on staging, the Cloudflare preview build is fixed,
and `EMAIL_FROM` is set with the staff alert confirmed.

1. **The redesign** (Mazen, 23 Oct), to set the site apart from a competitor, factory21.co, whose
   Home looks like ours. On `main` since 23 Oct:
   - Done on Home: Microgramma D Extended (the logo's face, `src/assets/fonts/`) for the hero and
     section headlines only; rounded corners on every box, button, field and option site-wide
     (`--r-s/m/l` in the *approved changes* block); far fewer words; the facts, the two paths, the
     8 stages, the sample check and the portal shown with line icons (`src/data/icons.ts`,
     `Icon.astro`). The atelier section on Home is hidden (`SHOW_ATELIER`) until the real photos come.
   - The parity, behaviour, CSS, admin and unit suites all pass. `approvePrototype` loads Microgramma
     into the prototype and mirrors Home's new markup, so **a Home text change must be mirrored
     there too**.
   - Next: the same treatment for the inner pages, **as a mock for Mazen first**.
   - Line figures (the Hairline skill, hairline.lucasmarkes.com): at most one per page, factory
     subjects only, the 3D mark stays the hero, and on phones they work by touch (drag sideways,
     the pose holds after the finger lifts). **Parked:** the first test, a shirt that opens into its
     six pattern pieces (https://claude.ai/artifact/3uMMhCdonw82iRABVTGVS3), did not convince Mazen
     (23 Oct), and figures wait until he picks them up again. Nothing of it is in the repo; the
     published page holds its whole code.
   - **Home edits (Mazen, 23–24 Oct), on `claude/tender-rubin-ahjc3t`, not on `main` yet** (merge
     when Mazen says so):
     - Done: the hero fills the screen under the header at every size (*approved changes* block).
     - Done, **fewer shirts** (nobody makes or wears them now): the hero, the sample and the bulk,
       the tracking card and the 8 stage photos are new AI photos made to look like our own cutting
       room, tidier (Soul 2; `src/assets/photos/README.md`). The sample and the bulk are black hoodies,
       the tracking card is raw jeans ("FC-2418 / Denim jeans", mirrored in `approvePrototype`). The
       stage photos are the How it works background.
       Four unused photos from the same set are in `assets/photos-raw/` (`…_20261024.jpg`).
     - Done (Mazen approved the mock, 24 Oct): *What we make* is a row where the photo under the
       pointer grows and the others step back (no lead denim card), and on phones a swipe row where the
       card in the middle is full size (`scripts/pages/make-row.ts`). *How it works* shows the photo of
       the stage behind the pinned ring, changing with the stage and fading out when the ring closes
       into the mark (`.hbgs` in `index.astro`, `how-scroll.ts`). Both are in the *approved changes*
       block and mirrored in `approvePrototype`.
     - Phones show tall versions of the hero and the 8 stage photos (Mazen made them, 24 Oct), so a
       wide photo is not cropped to a strip: `PHOTOS_PHONE` and `BgImg`'s `phoneUpTo`.
     - Still the old wooden-table AI photos: the six category photos (the "Shirts" one is a shirt), and
       the two cards for Starting and Scaling. Mazen has not asked to change them yet.
     - When line figures come back, the subject is not a shirt.
2. **Phase 4's "done when"** (a test order through all 8 stages from a phone, on staging) has not
   been tried. It needs the Auth settings below, so that staff and a test client can get codes.
3. **The email receipt to a brand** has not been tried: both 23 Oct tests gave a WhatsApp number.
   One request with an email as the contact covers it.

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
- Keep or drop the Cloudflare plugin commit on `claude/keen-gates-vu1na0`, and whether to disconnect
  Vercel.

Dashboard and account tasks:
- **Supabase Auth (staging):**
  - Turn off "Allow new users to sign up".
  - Set the email OTP expiry to 600 s.
  - Put `{{ .Token }}` in the Magic Link template.
  - Set SMTP to Resend (sender `hello@fullcircle-co.com`).
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

- **The live site runs on staging.**
  - Since 23 Oct, Track's real sign-in and `/admin` are live against **staging**. Codes only work
    once the Auth settings above are done. The sign-in never creates an account (`create_user: false`).
  - Live forms write to staging too, so the live project should exist before real clients use the
    site.
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

1. **The redesign of the inner pages:** a mock for Mazen first, then the build. Meanwhile, the
   Supabase Auth settings and Vercel (Mazen, in the dashboards; see *Waiting on Mazen*).
2. **Prove phases 2–4 on staging.** Once the Auth settings are done: send a test request with an
   email, convert it to an order in `/admin`, sign in to `/track` as the client, and take the order
   through all 8 stages from a phone.
3. **The phase 5 launch items:** the live Supabase project, Turnstile, the production build
   variables, `workers_dev: false`, Umami, and Lighthouse on the domain.
