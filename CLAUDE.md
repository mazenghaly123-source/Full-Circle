# Full Circle

Starting a new session? Read docs/HANDOFF.md first.

See [AGENTS.md](./AGENTS.md) for this repository's agent instructions, including the
`## Agent skills` configuration (issue tracker, triage labels, and domain docs).

Full Circle is a Cairo end-to-end clothing development and manufacturing partner
(design support → patterns → sourcing → sampling → bulk → QC → delivery) for brands
that are starting or scaling. Owner of the site work: Mazen (design lead).

The production build plan (decisions, phases, open questions) is in
[docs/production-plan.md](./docs/production-plan.md); decisions that are hard to reverse are
in [docs/adr/](./docs/adr/), and the domain vocabulary in [CONTEXT.md](./CONTEXT.md).

## What's in this repo
- `prototype/index.html`: the approved, fully working prototype (single file, 7 pages
  via hash router: home, how, make, about, start, track, contact). This is the visual
  and content source of truth. **Never edit it**; the production build is checked against it.
  Live preview: https://claude.ai/artifact/F2GMqLkJkCS9HhVW2wDXHx
- `prototype/img/`: the compressed web photos the prototype loads (slot name = file name).
- `assets/logos/`: real logo SVGs (horizontal, mark, stacked; bone + carbon).
- `assets/photos-raw/`: full-size originals of the photos.
- The production site (Astro, static): `src/` and `tests/`, described under *Site code* below.
  Deploying: [docs/deploy.md](./docs/deploy.md).
- The backend (Supabase): `supabase/` (migrations, database tests, the form Edge Functions),
  described under *Backend* below.

## Design system (V4.1 "Raw Editorial"): do not drift
- Colours: Obsidian #11110F (bg), Bone #E8E2D8 (text), Charcoal #292925, Raw Cotton #D8D0C3,
  Signal Red #C5322B (the only accent: primary CTA, live dot, approvals). Red button fills use
  #BC2F29 so their text passes contrast; red is never small text (use Bone with a red dot).
  Atmospheric light only (never UI): Indigo #243E8F, Burnt Orange #C96832, Faded Red #A63F3F.
- Type: Microgramma D Extended Bold, the logo's own face, for headlines only (23 Oct 2026: the Home
  hero, section headings, the closing call-to-action band, and the part's name inside Home's How it works
  mark; self-hosted from `src/assets/fonts/`).
  Saira Condensed (stand-in for Eurostile Bold Condensed) for card titles, figures and other
  display text, Geist (for Suisse Intl) for body, IBM Plex Mono (for Suisse Mono) for labels.
  Mazen is buying Microgramma's web licence: don't raise it again.
- Rounded corners everywhere, never a mix with square boxes (23 Oct 2026): 6px chips and tags,
  10px buttons, options and fields (fields are boxed), 16px cards, photos and panels
  (`--r-s`, `--r-m`, `--r-l`).
- Line icons (`src/data/icons.ts`, drawn in-house): 24px, 1.5px stroke, round caps and joins, one
  Signal Red accent each. They stand in for text.
- Dark only. Grain + slow drifting light blobs. Circle motif = the mark's three arcs: Design, Build,
  Launch (27 Oct 2026). An order still moves through the 8 stages (Track, the admin, the database).

## Decisions already made
- Home + inner pages. Clarity first (benchmark: brandsfactory), design moments second.
- One primary action everywhere: **Request a sample**. WhatsApp is secondary.
- Full Circle = the whole circle of a clothing brand, not only making it (Mazen, 27 Oct 2026): a brand
  should need no one else. The work is three parts, one per arc of the mark: **Design** (brand
  identity, product design, tech pack: stages 01–02), **Build** (fabric + trims, patterns, sample,
  production, QC: 03–07) and **Launch** (delivery, product photos, ad creatives: 08). Mazen does the
  branding and the launch content himself. No prices on them yet (maybe later): they are by request.
  The words differ from Factory 21's design studio on purpose; don't copy its menu.
- Home "How it works" is scroll-driven: the section pins and the mark draws itself arc by arc (one
  per part, its photo behind it), and at 100% the arcs have closed into the mark ("Full circle").
  The hero ring names the three parts. Mazen approved the mock (27 Oct 2026):
  https://claude.ai/artifact/3pEMxPmiymqqYwmfF9AQ9s. Design and Launch still use stage photos until
  Mazen makes their own (a branding shot, a product shoot).
- How it works page = "you are the order" walkthrough (demo order moves through 8 stages,
  sample approval gate at stage 05). Next: redo it on the three parts, as a mock for Mazen first.
- Hero: real 3D extruded logo (three.js, SVGLoader + ExtrudeGeometry, bone ceramic face,
  darker glossy sides, warm key + orange/indigo rim lights). It does NOT rotate: one settle
  on load, then gentle tilt toward the pointer (finger-drag tilt on phones). Flat-mark
  fallback with a 360° sweep reveal if WebGL fails. On phones (14 Oct 2026) the mark is 1.25×
  bigger inside its ring, and a finger turns it 1.7× as far as the mouse (full turn over 90px),
  following closer. Tilt by gyroscope was considered and dropped: keep it touch only.
  The Home hero fills the screen under the header at every size (Mazen, 23 Oct 2026).
- Mazen REJECTED: the old stacked-layers 3D logo, continuous rotation, magnetic red buttons.
  Keep: custom cursor ring (desktop), photo zoom/card lift, nav underline, row shift with
  red dot, ring-wipe page transitions, count-up numbers, reveal-on-scroll.
- Phone: bottom bar (Request a sample + WhatsApp), header hides on scroll down, full-screen
  menu, snap carousels with dots, animated orange/indigo hero light, labelled hero ring.
  Phone quality matters a lot: test at 390×844 and 375×667.
- Starting/Scaling: split section on Home now; dedicated ad landing pages later.
- The request form starts at 60–150 pieces (Mazen, 27 Oct 2026): no "Under 60" option. The minimum line under the
  quantity shows only for denim at 60–150, as a small quiet note (no red, it must not look like an error).
- The site takes no files (Mazen, 15 Oct 2026): the request form has no upload, and sketches,
  tech packs and photos come on WhatsApp after the first contact. A sent request shows
  "Continue on WhatsApp", which opens a chat with its code ready to send.
- The legal review of the forms and the privacy notice is done (Mazen, 15 Oct 2026). Don't raise
  it again.
- Tracking portal is part of the build.
- Analytics (Mazen, 26 Oct 2026): Google Analytics 4 (`G-XNT9FPB5RQ`, `src/data/analytics.ts`) behind a
  slim consent bar at the bottom, on the live domain only. Nothing reaches Google before Accept; the
  privacy notice says so and has a Cookie settings button. Search Console is verified by DNS.
- Atelier, floor and team photos must be REAL photos (not AI). Everything else may be AI.
- Fewer shirts (Mazen, 23 Oct 2026): nobody makes or wears them now, so photos, demo orders and
  figures show hoodies, jeans and other products. AI photos must look like our own cutting room
  (white walls with a grey lower band, terrazzo floor, fluorescent tubes, white tables, the FULL
  CIRCLE sign), tidier than it is, and like a phone photo, not a styled shoot. The hero, sample,
  bulk, tracking-card and stage photos were replaced that way on 24 Oct.
- Image generation: never use Higgsfield Nano Banana / GPT Image; give Mazen prompts.
- Site audit part B (13 Oct 2026), all approved: the button red above, Bone + red dot for small
  red text, a scrim over the hero, a gradient behind photo captions, the hero ring stops after one
  circle, labels above form fields, 44px option buttons and tabs on phones, search titles and
  descriptions, described product photos.
- Redesign (Mazen, 23 Oct 2026), to set Full Circle apart from Factory 21 (factory21.co, the
  closest competitor: same promise, light and orange, condensed type, technical labels, loud
  tone): the headline face, the corners and the icons above; Home cut to half its words, icons in
  place of text, fewer mono labels, denim first, the five checks behind "What you approve is what
  ships" (chest, length, sleeve, stitch, colour); the atelier section on Home and the team
  section on About removed (Mazen, 24 Oct 2026). No pop-ups, tickers or slang. Inner pages get the
  same treatment, one page at a time, each as a mock for Mazen first (24 Oct 2026). Done: What we make
  (equal category cards with icon facts, three icon cards, no limits block), then About, Contact, Request
  a sample and Track straight on the preview without mocks (Mazen): titles in the logo's face, one-line
  leads, icon cards (`.three`). How it works stays as it is: Mazen approved it unchanged (24 Oct 2026).
- Interactive line figures (the Hairline skill, 23 Oct 2026): a few, at most one per page, never
  on the hero (the 3D mark stays the hero). On phones they answer a finger (sideways drag, tap),
  not only a self-running loop. The first test (a shirt opening into its pattern pieces) did not
  convince Mazen. In use since 29 Oct 2026 (Mazen, no mock): How it works' demo garment is the product
  picked (shirt, hoodie, tee, jeans, jacket), a line figure with depth that turns toward the pointer
  and, on phones, a sideways drag (`src/data/garments.ts`, `scripts/pages/garment.ts`).

## Confirmed content
- MOQ: tees 60/colour, hoodies 60, tops 60–100, sweatpants 60, shorts 60, shirts 80–100,
  tailored pants 100, jackets 100, leather 100, denim jeans 150/colour, denim jackets 150, knitwear by order.
- Sampling: 7–25 days (cotton fastest, denim longest).
- Sets apart: denim speciality; imported fabrics not in the local market; imported trims.
- Leather and imported fabrics (Mazen, 27 Oct 2026): we have leather for whoever needs it, at the
  jackets' minimum (100) and sampling time (7–25 days). Never say real or faux, and don't list
  leather products. Imported fabrics are distinctive and at a competitive price. No laser work.
- Where they sell: Gulf + Middle East, Turkey, China (made in Cairo).
- WhatsApp: +20 101 143 5406 (https://wa.me/201011435406), assumed to be the WhatsApp line.
- Phone: +20 2 2698 7277 · Email: fullcircleworks.co@gmail.com · Instagram: @fullcircle_eg

- Hours: Sunday – Thursday, 9:00 – 17:00. Replies: "we reply quickly" (no promised time).
- Registered name: Full Circle, Gisr El Suez, Cairo. Kept: requests that don't become orders one
  year, orders five years.

## Less text, nothing TBC (Mazen, 15 Oct 2026)
Keep the site's words short; details are not needed for everything. Removed and not to come back
unless Mazen asks: fabrics/weights per category, bulk lead times, the techniques list, the "not in
scope" list, the sample-price FAQ, stage times other than sampling's. No TBC tag is left on the
site. The atelier and team sections are gone (24 Oct 2026). The domain is **fullcircle-co.com** (20 Oct
2026). Still to come: a real photo of the floor for About (`about-floor`); About gets its own pass later.

## Site code
- **Parity is the bar.** `tests/parity.spec.ts` screenshots each page next to the prototype at
  1440×900, 390×844 and 375×667; a change that moves pixels the prototype did not is a regression.
  Run the parity, behaviour and CSS suites (`package.json` scripts) after any visual or script change.
- An approved visual departure from the prototype goes in the marked *approved changes* block at
  the end of `src/styles/global.css`, with any markup it needs mirrored in `approvePrototype`
  (`tests/helpers.ts`); the parity suite applies both to the prototype before comparing.
- `src/styles/global.css` is the prototype's CSS in its original order (later blocks override
  earlier ones). Edit rules in place and append new ones under *production additions*. Write
  `-webkit-backdrop-filter` before `backdrop-filter`; `tests/css.spec.ts` checks the minifier kept
  every rule.
- Browser scripts load once (Astro ClientRouter). Each feature in `src/scripts/` is a `Feature`
  (`core/lifecycle.ts`): `mount(signal)` binds to the live page and stops when the signal aborts;
  `prepare(doc)` writes carried-over state into the incoming page before it shows. The prototype
  was one document: a page you come back to keeps its state (picks, demo progress, open FAQ,
  carousel positions, errors) and replays its CSS entrances, but no transition jumps.
- Content (stages, categories, FAQ, contacts) lives once in `src/data/site.ts`; photos are
  registered by slot in `src/data/photos.ts`. The request form's questions, the form rules and the
  words shown with the forms live in `supabase/functions/_shared/forms.ts`, which the site and the
  Edge Functions both import (site.ts re-exports the questions).
- `Base.astro` writes each page's canonical address, share tags and structured data
  (`src/data/structured-data.ts`, 30 Oct 2026: on Home the business with its three parts as services, the site
  and the FAQ; on What we make the making as a service with its six categories and minimums); titles, descriptions and the `ai-summary` tag come from `PAGES` in
  `src/data/site.ts`. The share card is `public/og.jpg`, rendered by `scripts/og-image.mjs`. `sitemap.xml`
  is an endpoint in `src/pages/`.
- Every public page has a markdown version for AI agents (26 Oct 2026): `/about.md`, `/about` with
  `Accept: text/markdown`, and `/api/md/about`, written in `src/md/registry.ts` from the same data and
  in the page's own words. The one Worker, `src/worker.ts` ([ADR 0006](./docs/adr/0006-a-worker-for-markdown.md)),
  serves them on the paths `run_worker_first` lists in `wrangler.jsonc`. `tests/md.spec.ts` fails when
  the markdown says something its page does not, so **a change to a page's words is mirrored in the
  registry**; a new page needs an entry there and in `run_worker_first`. `robots.txt`, `llms.txt`,
  `llms-full.txt` and `ai.txt` are built together in `src/md/agents.ts` (training crawlers allowed,
  Mazen, 26 Oct 2026).
- No test reaches the real backend: `mockBackend` (`tests/helpers.ts`) stands in for Turnstile and
  the form functions in the browser suites.
- three.js is pinned to 0.160.0 (the prototype's version) so the 3D mark renders identically. Its mesh
  is extruded in a Web Worker (`hero-mesh.worker.ts`, importing three's `src/` modules so the worker
  stays small); the parity suite checks the mark against the prototype's at full size. Fonts
  come from the `@fontsource` packages (and Microgramma from `src/assets/fonts/`) through Astro's
  local font provider, so builds need no network; `approvePrototype` hands the prototype Microgramma
  inline, and mirrors the redesigned Home's markup, so Home is still held to parity.

## Backend
- One Supabase project, `full-circle-staging` (Frankfurt, free plan), and since 30 Oct 2026 it holds
  **real data** (Mazen): the test data was cleared, codes restart at FC-2501, and it moves to Pro (same
  project, no move) once orders run on the portal. Send no test requests to it. A Worker cron calls
  `public.alive()` twice a day so the free plan never pauses it (`src/keep-awake.ts`). Every build sends to
  it unless `PUBLIC_SUPABASE_URL` says otherwise (`src/data/project.ts`, `src/data/backend.ts`).
- Row-level security on every table, and the publishable key reaches none of them: the forms
  write through the `submit-request` and `submit-contact` Edge Functions, which check a Turnstile
  token. `supabase/tests/database/` holds who-can-reach-what tests; run `supabase test db`, or
  `scripts/test-db-local.sh` where there is no Docker (a cloud session).
- The portal (`/track`, phase 3) signs in through Supabase Auth with a 6-digit code and reads the
  client's orders under row-level security, and the person's requests that are not orders yet
  (`my_requests`: a request sent with an email opens a sign-in for it, Mazen, 27 Oct 2026) (`src/scripts/core/portal.ts`, no library). Clients and
  staff change orders only through database functions that write the append-only approval log
  (migrations `20261020221044`, `20261021002550` and `20261021022945`); the browser tests stand in for Supabase with
  `mockPortal`.
- The admin (`/admin`, phase 4) is a separate page with its own layout and stylesheet
  (`src/layouts/Admin.astro`, `src/styles/admin.css`: the Studio OS design, not the site's), no
  ClientRouter and no parity check; screens are hash routes (`#/overview`, `#/order/12`) in
  `src/scripts/admin/`. Staff sign in with the same code flow as the portal (`core/auth.ts`, a
  session of its own) and act through the same database functions. Adding people goes through the
  `invite` function (owners and developers add staff; a developer, Mazen since 30 Oct 2026, has every right an
  owner has; they also delete a cancelled order, `delete_order`), and every action asks `notify` to send what it queued (email now, WhatsApp
  after Meta). Its tests are `tests/admin.spec.ts`, on `mockAdmin`.
- WhatsApp goes from a system number through Meta's Cloud API (`_shared/whatsapp.ts`, templates
  only, to numbers that opted in; [docs/whatsapp.md](./docs/whatsapp.md)): portal codes through Auth's
  Send SMS hook (`send-sms`), replies and receipts through `whatsapp-webhook`. Off, and logged as
  skipped, until Meta's secrets are set.
- The functions have no dependencies (a few REST calls in `_shared/server.ts`); type-check them
  with `deno check`. `tests/unit/backend.spec.ts` runs them end to end on a local stack
  (`supabase start`); the CI *backend* job does all three.
- Migrations reach staging through the Supabase MCP (`apply_migration`); keep each local file
  named with the version the project records, so the two histories match. Statements the MCP
  counts as destructive (DROP, DELETE, TRUNCATE, even inside a transaction that rolls back) wait
  for a confirmation that never reaches a cloud session and time out: give Mazen that SQL to run in
  the dashboard's SQL editor, with an insert into `supabase_migrations.schema_migrations` recording
  the local file's version.

## Work rules
- Confirm the plan with Mazen before large builds; don't build unrequested versions.
- Arabic version comes later (RTL). Don't build it until asked.
