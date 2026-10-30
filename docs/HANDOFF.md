# Handoff (30 Oct 2026)

For a new Claude session that has none of the earlier chat history (Mazen may continue from another
Claude account). Read this first, then [CLAUDE.md](../CLAUDE.md), [production-plan.md](./production-plan.md)
§2 and §10, [deploy.md](./deploy.md) and [whatsapp.md](./whatsapp.md). Everything below was checked on
23–30 Oct 2026 against GitHub, the Supabase project, the live domain and the PRs. Where something could
not be checked, it says so.

**Working with Mazen:** reply in Arabic (Egyptian), very briefly. He wants finished work merged to `main`
so it goes live, and since his first social post (29 Oct) he wants it fast: "build it and put it on the
site, don't stop to ask me" (29 Oct, for the garment). Still say what you will build in two lines before
a large job. Open a PR from `claude/practical-gauss-hadquv` (restart it from `main` first), wait for CI
(`site` about 18 minutes, `backend`, Workers Builds), fix what fails, then merge with a merge commit.
CodeRabbit no longer reviews (the repo has under 10 stars, and Mazen decided not to pay for it, 30 Oct).
**The site's data is real now** (see *Supabase*): never send test requests to it.

**In a cloud session:** the repo pins a Playwright that differs from the pre-installed Chromium. Run the
suites through a local config that is never committed (`pw.local.config.ts`, listed in `.git/info/exclude`):
`import base from './playwright.config'; export default { ...base, use: { ...base.use, launchOptions: { ...base.use?.launchOptions, executablePath: '/opt/pw-browsers/chromium' } } };`
then `npx playwright test -c pw.local.config.ts …`. For `scripts/test-db-local.sh`, first run
`apt-get install -y postgresql-16-pgtap`.

## Branches

| Branch | Holds | State |
|---|---|---|
| `main` | **Everything:** phases 1–4, phase 5's search and sharing, WhatsApp from the system number, the redesign (see *In progress*) and the designed emails | Live |
| `claude/practical-gauss-hadquv` | The working branch (29–30 Oct): the Turnstile site key (PR #24), the garment figure (PRs #25, #26), keeping Supabase awake (PR #27) | PR #27 open when this was written; restart it from `main` for new work once merged |
| `claude/tender-rubin-ahjc3t` | Design, Build, Launch on Home (PR #22), the request form's quantity (PR #23) | Merged to `main`, safe to delete |
| `claude/leather-imports` | Leather with the jackets, imported fabrics at a competitive price (PR #21, 27 Oct) | Merged to `main`, safe to delete |
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
  - The request and contact forms, which send to the one Supabase project, real data since 30 Oct,
    through the real Turnstile widget (29 Oct).
  - The real portal on Track and `/admin`, signing in against the same project (Mazen is on the team as a developer, see *Supabase*).
  - How it works' garment figure, one per product (29 Oct).
  - Search and sharing. WhatsApp from the system number is in the code but off until Meta's secrets
    are set.
- Cloudflare deploys `main` to **fullcircle-co.com** (+ `www`) and
  **full-circle.mazenghaly123.workers.dev**, a few minutes after a merge. The domain answers from a cloud
  session (checked 29 Oct: every page 200, the share card, the garment live).

## Supabase

- Project **full-circle-staging**, ref **`kmsrzeqxgufrodefclty`**, Frankfurt (eu-central-1), free
  plan. Despite the name it is the live project: Mazen decided on 30 Oct to keep it, on the free plan,
  for the first months, and to upgrade the same project to Pro once orders run on the portal (for the
  backups; the free plan has none). No second project is planned.
- **Migrations applied** (all 15 in `supabase/migrations/`, and the versions match):
  `20261015103850` requests_and_messages, `20261015103905` consents_request_index,
  `20261015140000` requests_without_files, `20261020221044` clients_orders_and_portal,
  `20261021002550` order_code_suffix, `20261021003118` admin_functions_support,
  `20261021022945` sample_gate_latest, `20261021064023` whatsapp.
- `20261026090000` delete_expired (applied by Mazen in the SQL editor, 26 Oct; the MCP counts its
  DELETE as destructive): the nightly clean-up `/privacy` promises. At 01:15 UTC pg_cron deletes
  requests without an order, and messages, a year after they arrived; consent records stay
  (`supabase/tests/database/retention.test.sql`).
- `20261027071333` requests_in_portal (27 Oct, through the MCP): `my_requests()`, the requests the
  portal lists. `20261027074938` my_requests_staff (same day, MCP): staff, who see every order
  on Track, no longer see a converted request of theirs as well. `20261027100100` expired_accounts (the clean-up also deletes the sign-in accounts a
  request opened, a year on): applied by Mazen in the SQL editor on 30 Oct, with the clean-out of the test data.
- `20261030151642` keep_awake (30 Oct, MCP): `public.alive()`, which anon may call; the Worker calls it
  twice a day so the free plan never pauses the project.
- `20261030153525` developer_role and `20261030153541` developer_is_owner (30 Oct, MCP): a third staff role,
  **developer**, that can do everything an owner can (`private.is_owner()` counts both). Mazen asked to be a
  developer, not the owner, with full rights: his staff row was changed to `developer` the same day.
  **There is no owner on the team now**; when Mazen names the real owner, add them in `/admin` → Team as Owner.
- **Edge Functions deployed** (all with the JWT check off), matching `main`:
  - `submit-request` v9 (27 Oct: the sign-in for a request by email, PR #20), `submit-contact` v7, `invite` v8 (30 Oct: developers add staff), `notify` v6 (24–25 Oct, with the designed
    emails of PR #16; the deployed files were compared with the repo's), `send-sms` v1,
    `whatsapp-webhook` v1.
  - The form rules changed on 27 Oct (no "Under 60"; `belowMinimum` is denim at 60–150 only) without a redeploy:
    staging's `submit-request` still accepts "Under 60". Redeploy it with the next function change.
  - Deploying through the MCP needs every file a function imports (`<slug>/index.ts` and all four
    `_shared/*.ts`), passed with `verify_jwt: false`.
  - Checked: test request FC-2509 (23 Oct) was saved and logged with the WhatsApp version's wording.
- **Emails** (`_shared/emails.ts`, PR #16): every email the functions send has the site's look (dark,
  the logo, one card), like the sign-in code email (`supabase/templates/sign-in-code.html`, pasted by
  Mazen into Auth → Emails → Magic link). The images load from `https://fullcircle-co.com/email/`.
- **Secrets** (seen in the dashboard, 23 Oct):
  - Set: `RESEND_API_KEY` (20 Oct) and `EMAIL_FROM` = `Full Circle <hello@fullcircle-co.com>`
    (23 Oct). The staff alerts for FC-2508 and FC-2509 went out through Resend (`sent`). The receipt
    to a brand that gives an email has not been tried yet.
  - Supplied by Supabase automatically: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_SECRET_KEYS`.
  - `TURNSTILE_SECRET_KEY`: the real widget's secret. Mazen said "done" on 29 Oct, after the build with
    the site key went live; it was not checked (a check means sending a request, and the data is real).
    If it is missing, the project falls back to Cloudflare's always-pass test key, which refuses the real
    widget's tokens: every form would fail. Mazen has not yet sent a request from his phone to prove it.
  - Not set: `STAFF_EMAILS` and `SITE_URL` (the defaults are used), `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`,
    `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` and `SEND_SMS_HOOK_SECRET`.
- Data (checked 30 Oct, after the clean-out): no requests, orders, clients, messages or consents; one
  Auth user and staff row, Mazen (developer since 30 Oct); the code sequence restarts at FC-2501; one test file left in the
  bucket `stage-photos`.
- Auth settings: sign-ups off, OTP expiry, the code template and SMTP are done (24 Oct, see *Waiting
  on Mazen*); captcha and the phone hook wait for Turnstile and Meta.

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
- **Two cron triggers** (`triggers` in `wrangler.jsonc`, PR #27): the Worker's `scheduled` handler calls
  Supabase twice a day so the free plan never pauses the project.
- **Not done yet:**
  - `"workers_dev": false` (the domain is live).
  - Turning off Cloudflare Web Analytics on the zone.
  - No build variables are set, and none are needed: the defaults are the one project
    (`src/data/project.ts`).
- **Turnstile (29 Oct, Mazen's first social post):** an Invisible widget for `fullcircle-co.com`, `www` and
  `full-circle.mazenghaly123.workers.dev`. Its site key is the default in `src/data/backend.ts`, its
  secret is the project's `TURNSTILE_SECRET_KEY`. Preview URLs are not on the widget, so their forms are refused.
- **Vercel is still connected.** Its GitHub app builds a preview of every PR
  (`mazen-s-projects2/full-circle`), although hosting is Cloudflare only (PR #6). Advised to
  disconnect it (24 Oct); Mazen's to do.
- AI crawlers can read the site: `robots.txt` only disallows `/admin`. Mazen should check that
  Cloudflare's "Block AI bots" setting is off for the zone.

## In progress

- **Open:** [PR #27](https://github.com/mazenghaly123-source/Full-Circle/pull/27), keeping Supabase awake
  (`public.alive()` is already applied to the project; the PR adds the Worker cron, its test and the docs).
  Merge it once CI is green.
- **The first social post (29 Oct):** Mazen posted (or was about to). The site was checked for it. The bio
  link suggested to him, so GA4 shows the post's visitors:
  `https://fullcircle-co.com/?utm_source=instagram&utm_medium=social&utm_campaign=first_post`. GA counts only
  visitors who accept the consent bar. Resend's free plan sends 100 emails a day (a request sends 2–3), so
  watch it if requests pick up. Mazen asked about a countdown page for the bio link; advised against it
  (the site is live), and no page was built.

- **The one Supabase project holds real data (30 Oct, Mazen):** the free plan for the first months, Pro
  on the same project once orders run on the portal (for the backups; no move needed). Mazen cleared the
  test data in the SQL editor (orders, clients, requests, messages, consents, every account but his
  owner's; codes restart at FC-2501) and applied `20261027100100` expired_accounts with it. **Send no test
  requests to it.** The Worker calls `public.alive()` twice a day (`20261030151642` keep_awake,
  `src/keep-awake.ts`, `triggers` in `wrangler.jsonc`) so the free plan never pauses it. One test photo
  is left in Storage → `stage-photos` for Mazen to delete.

- **How it works' garment (29 Oct, Mazen, built straight on the site, no mock):** the flat shirt in the demo
  ring is now a line figure with depth in the Hairline style, one per product (shirt, hoodie, tee, jeans,
  jacket; `src/data/garments.ts`). It turns toward the pointer, a finger drags it sideways on phones and it
  stays put, and a new product swings in (`scripts/pages/garment.ts`). The stage styling is the
  prototype's (`.pc`, `.detail`, `.anno`…). Mirrored in `approvePrototype` (the shirt at rest), so the page
  is still held to parity.

Done on 23–25 Oct: the WhatsApp-era functions are on staging, the Cloudflare preview build is fixed,
`EMAIL_FROM` is set with the staff alert confirmed, the Auth settings are done, and every email has the
site's look.

- **Design, Build, Launch (27 Oct, Mazen):** Full Circle covers a brand's whole circle, branding and
  launch content included (Mazen does those himself, no prices yet). Home's How it works is now three
  parts, one per arc of the mark (`ARCS` in `site.ts`, `src/data/mark.ts`, `how-scroll.ts`), and the hero
  ring names them; mirrored in `approvePrototype`. Mock: https://claude.ai/artifact/3pEMxPmiymqqYwmfF9AQ9s.
  **Next:** the How it works page on the three parts (mock first), the request form offering branding
  and content, and photos for Design and Launch (give Mazen prompts).
- **Requests on Track (27 Oct, Mazen, after comparing the site with Factory 21):** a request sent with
  an email opens a sign-in for that email (`submit-request`), the portal lists the person's requests
  until each becomes an order they can see (`my_requests`), the sent box links to Track, and the
  receipt email says where to sign in. Sign-ups stay off ([ADR 0003](./adr/0003-supabase-backend-with-invite-only-sign-in.md),
  amended). WhatsApp-only requests get no sign-in until codes on WhatsApp are on. Other ideas from
  the comparison wait on Mazen: a Book a meeting button (Google Calendar or Cal.com, in person or a
  call), proof figures and client logos, the sample fee credited to bulk, a "how did you hear about
  us" question. Our own ideas, proposed to Mazen: a Sample Passport (the five checks measured on the
  approved sample and again on bulk), a "can we make it?" checker (MOQ and sampling from the
  picks), a Jeans Builder (fit, imported denim, wash, trims, a leather back patch with the brand's
  logo), a season planner per market, the Circle Floor (a 3D floor with the 8 stations in a ring,
  the real order moving on it), export-ready labels, reorder with the approved spec. **Next:** Mazen
  picks which to mock first; the Sample Passport and the "can we make it?" checker were suggested
  (both use data the site already has). Mazen liked Factory 21's 3D factory floor most: ours is
  the Circle Floor, on Track, not a copy.

0. **SEO, GEO and analytics** (Mazen, 24 Oct: "start SEO and GEO, and connect Google Analytics").
   - **Analytics (26 Oct):** GA4 `G-XNT9FPB5RQ` behind a consent bar (Mazen's choice), with page views,
     `generate_lead` for a sent request or message, and `whatsapp_click`; the privacy notice now names
     Google (dated 26 Oct). Search Console is verified by DNS; Mazen submits the sitemap there.
   - **Structured data and titles (30 Oct, PR #29):** Home's graph adds the three parts (Design, Build, Launch)
     as services on the Organization, where the brands sell (`areaServed`), and a FAQPage from the FAQ it shows;
     What we make has a Service with one offer per category and its minimum (`src/data/structured-data.ts`).
     Titles and descriptions: How it works, What we make, Request a sample and Track were sharpened (all
     titles under 60 characters, descriptions under 160). Google shows FAQ rich results only for government and
     health sites since 2023, so the FAQPage is for other search engines and AI answers. Next, when Mazen wants:
     check them in Google's Rich Results Test and Search Console once the sitemap is submitted.
   - **AI-readable site (26 Oct), live** (PR #18; the GEO checker scores 8/9, the missing one is an MCP
     file, as there is no MCP server). Mazen approved the plan, the Worker
     ([ADR 0006](./adr/0006-a-worker-for-markdown.md)) and allowing every training crawler. Every public
     page has a markdown version (`src/md/registry.ts`; `/about.md`, `Accept: text/markdown`,
     `/api/md/about`, `/api/md/_catalog`), and `llms.txt`, `llms-full.txt`, `ai.txt` and `robots.txt`
     come from `src/md/agents.ts`. Pages carry `ai-summary` and a markdown `alternate` link; Home's
     structured data is an Organization, a WebSite and a FAQPage (see above). `ai.txt` follows ai-visibility.org.uk's current spec (v1.7.0: an H1 and `##` sections;
     the prompt named v1.1.1, whose `[section]` form the spec now calls superseded).
1. **The redesign** (Mazen, 23 Oct), to set the site apart from a competitor, factory21.co, whose
   Home looks like ours. On `main` since 23 Oct:
   - Done on Home: Microgramma D Extended (the logo's face, `src/assets/fonts/`) for the hero and
     section headlines only; rounded corners on every box, button, field and option site-wide
     (`--r-s/m/l` in the *approved changes* block); far fewer words; the facts, the two paths, the
     8 stages, the sample check and the portal shown with line icons (`src/data/icons.ts`,
     `Icon.astro`). The atelier section on Home and the team section on About were removed (24 Oct).
   - The parity, behaviour, CSS, admin and unit suites all pass. `approvePrototype` loads Microgramma
     into the prototype and mirrors Home's new markup, so **a Home text change must be mirrored
     there too**.
   - Inner pages, one at a time, **each as a mock for Mazen first** (24 Oct): What we make is done (mock
     https://claude.ai/artifact/KBD9Mda8zDTzoMPn2VBnB1, mirrored in `approvePrototype`). About, Contact, Request a
     sample and Track followed straight on the preview (Mazen: no mocks for those). How it works stays as it is
     (Mazen approved it unchanged, 24 Oct).
   - Line figures (the Hairline skill, hairline.lucasmarkes.com): at most one per page, factory
     subjects only, the 3D mark stays the hero, and on phones they work by touch (drag sideways,
     the pose holds after the finger lifts). **Parked:** the first test, a shirt that opens into its
     six pattern pieces (https://claude.ai/artifact/3uMMhCdonw82iRABVTGVS3), did not convince Mazen
     (23 Oct), and figures wait until he picks them up again. Nothing of it is in the repo; the
     published page holds its whole code.
   - **Home edits (Mazen, 23–24 Oct)**, on `main` since PRs #12–#16:
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
     - All six category photos and the Starting and Scaling cards were replaced on 24 Oct with Mazen's
       photos in the same style.
     - When line figures come back, the subject is not a shirt.
2. **Phase 4's "done when"** (a test order through all 8 stages from a phone, on staging) has not
   been tried. The Auth settings are done; Mazen said to test orders later (24 Oct).
3. **The email receipt to a brand** has not been tried: both 23 Oct tests gave a WhatsApp number.
   One request with an email as the contact covers it, and shows the new email design.
4. **About** gets its own pass later (Mazen), with the real `about-floor` photo.

## Waiting on Mazen

Decisions:
- The **5 items "decided in the build"** ([production-plan.md](./production-plan.md) §2):
  1. A new code for orders that don't come from a request, and `-B` for a second order from one
     request.
  2. The sample gate is enforced by the database.
  3. No Undo: a stage can be moved back.
  4. A decision can be opened without photos.
  5. When a person is removed, the log keeps their name.
- Keep or drop the Cloudflare plugin commit on `claude/keen-gates-vu1na0`.
- Submitting the sitemap in Search Console (`https://fullcircle-co.com/sitemap.xml`).
- In GA4, turning off Enhanced measurement → "Page changes based on browser history events" (the
  site sends its own page views; see production-plan.md §6).


Small, on Mazen:
- Name the real owner (name and email) when ready, to be added in `/admin` → Team as Owner (30 Oct: he
  is a developer now, and nobody is the owner).
- Send one request from his phone (it is real data now, and it shows in `/admin`), to prove the
  Turnstile secret is set (see *Supabase*).
- Delete the test file in Storage → `stage-photos`.
- Check where a reply to `hello@fullcircle-co.com` goes (the emails are sent from it). If nowhere,
  Cloudflare Email Routing (free) can forward it to the Gmail inbox.
- Upgrade the Supabase project to Pro once orders run on the portal.

Dashboard and account tasks:
- ~~**Supabase Auth (staging):** sign-ups off, OTP expiry 600 s, `{{ .Token }}` in the Magic Link template,
  SMTP through Resend.~~ Done by Mazen on 24 Oct, with the Site URL set to `https://fullcircle-co.com` and the
  email OTP length set to 6 (Supabase's default had become 8). Confirmed: Mazen signed in to `/admin` as owner.
- **Turnstile:** the widget and the forms are done (29 Oct). Left: turn on captcha in staging's Auth →
  Attack Protection with the same secret (the portal and `/admin` already send a token), and the secret
  on the live project at launch.
- **Meta:**
  - A Business portfolio and a WhatsApp app (business verification uses Full Circle's documents).
  - A **new SIM** for the system number.
  - Submit and approve the **6 templates** in [whatsapp.md](./whatsapp.md).
  - Then set the 5 WhatsApp secrets and the Send SMS hook.
- **A real photo of the floor** for About (`about-floor`). The atelier and team sections were removed
  (24 Oct), and About gets its own pass later.
- The PDPC filings (§7).

## Gotchas

- **The project named full-circle-staging is the live one** (30 Oct). Its data is real: no test
  requests, no test orders, and every migration is tested locally first (`scripts/test-db-local.sh`).
  The sign-in never creates an account (`create_user: false`).
- **CI's runner is slower than a cloud session.** A test that samples an animation mid-way passes here
  and fails there (the garment test did, 29 Oct): compare with exact end states, as
  `tests/behaviour.spec.ts` now does with `figurePaths(…, REST)`.
- **The Turnstile site key and secret change together.** The site key in `src/data/backend.ts` and
  staging's `TURNSTILE_SECRET_KEY` belong to one widget; change one without the other and every form is refused.
- **Supabase MCP and destructive SQL:**
  - DROP, DELETE and TRUNCATE (even inside a transaction that is rolled back) wait for a
    confirmation that never reaches a cloud session, so they time out.
  - Give Mazen the SQL to run in the dashboard's SQL editor, with an insert into
    `supabase_migrations.schema_migrations`.
  - Name each local migration file with the version the project records.
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

## Next steps

1. ~~Merge PR #27~~ (merged 30 Oct, with #28, the developer role).
2. ~~**SEO and GEO:** FAQPage and Service structured data, titles and descriptions~~ (PR #29, 30 Oct).
3. **The How it works page on the three parts** (Design, Build, Launch), the request form offering
   branding and content, and photo prompts for Design and Launch (*In progress*). Ask Mazen which comes
   first.
4. **Before the first real order:** the order test (phases 2–4) can no longer run on the real project.
   Agree with Mazen how to prove it: a local stack (`supabase start` where Docker exists), or one real
   request of his own that he deletes afterwards.
5. **Launch items left:** `workers_dev: false`, Lighthouse on the domain, captcha in Auth → Attack
   Protection, and Pro when orders start.

## Suggested skills for the next session

- `grilling` before a large build Mazen has not specified (one question at a time).
- `diagnosing-bugs` when something on the live site breaks.
- `tdd` for backend changes (database functions, Edge Functions).
- `artifact-design` (through the Artifact tool) when Mazen does want a mock.
- `writing-for-agents` when editing CLAUDE.md or this file.
