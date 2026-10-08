# Full Circle

See [AGENTS.md](./AGENTS.md) for this repository's agent instructions, including the
`## Agent skills` configuration (issue tracker, triage labels, and domain docs).

Full Circle is a Cairo end-to-end clothing development and manufacturing partner
(design support → patterns → sourcing → sampling → bulk → QC → delivery) for brands
that are starting or scaling. Owner of the site work: Mazen (design lead). Client
contact / approver: Faris.

The production build plan, and the questions still open on it, are in
[docs/production-plan.md](./docs/production-plan.md).

## What's in this repo
- `prototype/index.html`: the approved, fully working prototype (single file, 7 pages
  via hash router: home, how, make, about, start, track, contact). This is the visual
  and content source of truth. **Never edit it**; the production build is checked against it.
  Live preview: https://claude.ai/artifact/F2GMqLkJkCS9HhVW2wDXHx
- `prototype/img/`: the compressed web photos the prototype loads (slot name = file name).
- `assets/logos/`: real logo SVGs (horizontal, mark, stacked; bone + carbon).
- `assets/photos-raw/`: full-size originals of the photos.

## Design system (V4.1 "Raw Editorial"): do not drift
- Colours: Obsidian #11110F (bg), Bone #E8E2D8 (text), Charcoal #292925, Raw Cotton #D8D0C3,
  Signal Red #C5322B (the only accent: primary CTA, live dot, approvals).
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
  fallback with a 360° sweep reveal if WebGL fails.
- Mazen REJECTED: the old stacked-layers 3D logo, continuous rotation, magnetic red buttons.
  Keep: custom cursor ring (desktop), photo zoom/card lift, nav underline, row shift with
  red dot, ring-wipe page transitions, count-up numbers, reveal-on-scroll.
- Phone: bottom bar (Request a sample + WhatsApp), header hides on scroll down, full-screen
  menu, snap carousels with dots, animated orange/indigo hero light, labelled hero ring.
  Phone quality matters a lot: test at 390×844 and 375×667.
- Starting/Scaling: split section on Home now; dedicated ad landing pages later.
- Tracking portal is part of the build.
- Atelier, floor and team photos must be REAL photos (not AI). Everything else may be AI.
- Image generation: never use Higgsfield Nano Banana / GPT Image; give Mazen prompts.

## Confirmed content
- MOQ: tees 60/colour, hoodies 60, tops 60–100, sweatpants 60, shorts 60, shirts 80–100,
  tailored pants 100, jackets 100, denim jeans 150/colour, denim jackets 150, knitwear by order.
- Sampling: 7–25 days (cotton fastest, denim longest).
- Sets apart: denim speciality; imported fabrics not in the local market; imported trims.
- Where they sell: Gulf + Middle East, Turkey, China (made in Cairo).
- WhatsApp: +20 101 143 5406 (https://wa.me/201011435406), assumed to be the WhatsApp line.
- Phone: +20 2 2698 7277 · Email: fullcircleworks.co@gmail.com · Instagram: @fullcircle_eg

## Still TBC (marked with a dashed TBC tag in the prototype)
Working hours, bulk lead time, fabrics/weights per category, techniques, sample pricing,
who answers requests and how fast, team names/roles/portraits, notification channel,
domain. Real photos missing: atelier-1..5, about-floor, team-1..4.

## Work rules
- Confirm the plan with Mazen before large builds; don't build unrequested versions.
- Arabic version comes later (RTL). Don't build it until asked.
