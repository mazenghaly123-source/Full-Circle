# Full Circle

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
- Type: Saira Condensed (stand-in for Eurostile Bold Condensed) for display, Geist (for
  Suisse Intl) for body, IBM Plex Mono (for Suisse Mono) for labels.
- Dark only. Grain + slow drifting light blobs. Ring/circle motif = the 8 stages.

## Decisions already made
- Home + inner pages. Clarity first (benchmark: brandsfactory), design moments second.
- One primary action everywhere: **Request a sample**. WhatsApp is secondary.
- How it works page = "you are the order" walkthrough (demo order moves through 8 stages,
  sample approval gate at stage 05). Home "How it works" is scroll-driven: section pins,
  ring completes stage by stage, at 100% the centre becomes the mark ("Full circle").
- Hero: real 3D extruded logo (three.js, SVGLoader + ExtrudeGeometry, bone ceramic face,
  darker glossy sides, warm key + orange/indigo rim lights). It does NOT rotate: one settle
  on load, then gentle tilt toward the pointer (finger-drag tilt on phones). Flat-mark
  fallback with a 360° sweep reveal if WebGL fails. On phones (14 Oct 2026) the mark is 1.25×
  bigger inside its ring, and a finger turns it 1.7× as far as the mouse (full turn over 90px),
  following closer. Tilt by gyroscope was considered and dropped: keep it touch only.
- Mazen REJECTED: the old stacked-layers 3D logo, continuous rotation, magnetic red buttons.
  Keep: custom cursor ring (desktop), photo zoom/card lift, nav underline, row shift with
  red dot, ring-wipe page transitions, count-up numbers, reveal-on-scroll.
- Phone: bottom bar (Request a sample + WhatsApp), header hides on scroll down, full-screen
  menu, snap carousels with dots, animated orange/indigo hero light, labelled hero ring.
  Phone quality matters a lot: test at 390×844 and 375×667.
- Starting/Scaling: split section on Home now; dedicated ad landing pages later.
- The site takes no files (Mazen, 15 Oct 2026): the request form has no upload, and sketches,
  tech packs and photos come on WhatsApp after the first contact. A sent request shows
  "Continue on WhatsApp", which opens a chat with its code ready to send.
- The legal review of the forms and the privacy notice is done (Mazen, 15 Oct 2026). Don't raise
  it again.
- Tracking portal is part of the build.
- Atelier, floor and team photos must be REAL photos (not AI). Everything else may be AI.
- Image generation: never use Higgsfield Nano Banana / GPT Image; give Mazen prompts.
- Site audit part B (13 Oct 2026), all approved: the button red above, Bone + red dot for small
  red text, a scrim over the hero, a gradient behind photo captions, the hero ring stops after one
  circle, labels above form fields, 44px option buttons and tabs on phones, search titles and
  descriptions, described product photos.

## Confirmed content
- MOQ: tees 60/colour, hoodies 60, tops 60–100, sweatpants 60, shorts 60, shirts 80–100,
  tailored pants 100, jackets 100, denim jeans 150/colour, denim jackets 150, knitwear by order.
- Sampling: 7–25 days (cotton fastest, denim longest).
- Sets apart: denim speciality; imported fabrics not in the local market; imported trims.
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
site. The team section on About is hidden (`SHOW_TEAM` in `about.astro`) until there are names and
portraits. The domain is **fullcircle-co.com** (20 Oct 2026). Still to come: the real photos
(atelier-1..5, about-floor, team-1..4).

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
- No test reaches the real backend: `mockBackend` (`tests/helpers.ts`) stands in for Turnstile and
  the form functions in the browser suites.
- three.js is pinned to 0.160.0 (the prototype's version) so the 3D mark renders identically. Its mesh
  is extruded in a Web Worker (`hero-mesh.worker.ts`, importing three's `src/` modules so the worker
  stays small); the parity suite checks the mark against the prototype's at full size. Fonts
  come from the `@fontsource` packages through Astro's local font provider, so builds need no network.

## Backend
- Supabase project `full-circle-staging` (Frankfurt, free plan, **test data only**). The live
  project is created at launch. Every build sends its forms to staging unless
  `PUBLIC_SUPABASE_URL` says otherwise (`src/data/backend.ts`).
- Row-level security on every table, and the publishable key reaches none of them: the forms
  write through the `submit-request` and `submit-contact` Edge Functions, which check a Turnstile
  token. `supabase/tests/database/` holds who-can-reach-what tests; run `supabase test db`, or
  `scripts/test-db-local.sh` where there is no Docker (a cloud session).
- The portal (`/track`, phase 3) signs in through Supabase Auth with a 6-digit code and reads the
  client's orders under row-level security (`src/scripts/core/portal.ts`, no library). Clients and
  staff change orders only through database functions that write the append-only approval log
  (migrations `20261020221044`, `20261021002550` and `20261021022945`); the browser tests stand in for Supabase with
  `mockPortal`.
- The admin (`/admin`, phase 4) is a separate page with its own layout and stylesheet
  (`src/layouts/Admin.astro`, `src/styles/admin.css`: the Studio OS design, not the site's), no
  ClientRouter and no parity check; screens are hash routes (`#/overview`, `#/order/12`) in
  `src/scripts/admin/`. Staff sign in with the same code flow as the portal (`core/auth.ts`, a
  session of its own) and act through the same database functions. Adding people goes through the
  `invite` function, and every action asks `notify` to send what it queued (email now, WhatsApp
  after Meta). Its tests are `tests/admin.spec.ts`, on `mockAdmin`.
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
