# Site audit, 8 Oct 2026

Four audits of the phase 1 site (branch `claude/youthful-maxwell-aiw9ob`, commit `6e8b571`): a
code review (standards and spec), a security review, an accessibility audit (WCAG 2.1 AA) and a
pre-launch SEO audit. Nothing has been changed because of them yet; the fix plan is at the end.

| Audit | Result |
|---|---|
| Code review: standards | 3 breaches of the repo's own rules, a few lifecycle points, several judgement-call smells. Nothing broken. |
| Code review: spec | Content matches the prototype everywhere. 1 thing implemented wrongly (reduced-motion hero dot), 1 partial, 5 additions not on the plan's lists. |
| Security | No exploitable issues. The earlier request-form XSS fix is complete. |
| Accessibility | 23 issues, none blocking, all inherited from the prototype: invisible focus in 3 places, the phone menu, contrast on red, form errors. |
| SEO | On-page basics are good (Lighthouse SEO 100). Missing: social previews, canonical/sitemap/robots, structured data (all phase 5, need the domain). Home is slow because of the 3D build. |

---

## 1. Code review

Compared `49af747...HEAD` (the whole site build). Standards: `CLAUDE.md` (Site code, Design system),
`AGENTS.md`, `CONTEXT.md`, plus a fixed list of code smells (judgement calls only). Spec:
`prototype/index.html`, `CLAUDE.md`, `docs/production-plan.md`, `docs/adr/`.

### Standards

Clean: every colour comes from the prototype, red is used only where the prototype uses it, photos
are referenced only by slot, three.js is pinned to 0.160.0, fonts come from Fontsource through the
local provider, and page features bind their listeners with `{ signal }`.

**Breaches of documented rules**
1. `src/styles/global.css:825`: `.ph>picture,.bgimg>picture{display:contents}` is a new rule in the
   middle of the file, not under *production additions*. (CLAUDE.md: "append new ones under
   production additions".)
2. `src/pages/how-it-works.astro:24–87`: the eight stations repeat the stage labels and the
   "You receive / You approve" text that live in `STAGES` (`site.ts:28–37`), and the copies differ
   ("Swatches + trim cards" vs "Swatches and trim cards"). CLAUDE.md: content lives once in
   `site.ts`. The prototype has the same duplication. `how-it-works.astro:43` also hard-codes the
   demo's product list, including "Outerwear", which forces the patch at `demo-order.ts:102`.
3. `global.css:61` (judgement): `.hdr` has `backdrop-filter` without the `-webkit-` version, so
   Safari before 18 shows no header blur. Same as the prototype.

**Lifecycle (judgement)**
4. `src/scripts/pages/hero-mark.ts:58–87`: the ResizeObserver and window/document listeners added in
   `build()` have no signal, so they keep running on other pages (by design the canvas is kept,
   but they point at a page that is gone). `:119–121` writes its own timeout-and-abort instead of
   `later()`. `portal-demo.ts:44` has an unscoped timer without the comment the others have.

**Smells (judgement calls)**
5. Duplicated code: `ring()` is re-implemented as `yoPos` (`demo-order.ts:11`) and inline in
   `how-it-works.astro:8–14`. A `g = (id) => doc.getElementById(id)!` helper is written six times
   although `$(id, root)` exists. Restore code and live handlers write the same DOM twice
   (`demo-order.ts:74/98`, `request.ts:38/66`, `:40/77`). `track.ts:48–52, 73–77` rebuilds
   `Photo.astro`'s markup as strings.
6. Primitive obsession: the MOQ warning rule is written as option strings (`request.ts:29`);
   `mbar.ts:12` hard-codes `4` (= the number of request questions).
7. Shotgun surgery: `WIPE_MS = 850` (`hero-mark.ts:126`) restates the wipe timings; its comment
   says 520ms where `wipe.ts` uses 560.
8. Mysterious names: `T` (`track.ts`) and `Y` (`demo-order.ts`), both from the prototype.
9. Vocabulary: the contact page's meta description says "production enquiry"; CONTEXT.md says
   "Request" and avoid "enquiry".

### Spec

Content matches: every text, MOQ, contact, link, title and TBC tag (same count per page) lines up
with the prototype, apart from the plan's deliberate differences. No phase 0–1 item is missing.
Checked and correct: wipe timing (480 / +300 / +560 ms), the 3D hero (one settle, pointer tilt,
finger-drag, never spins, flat fallback), the sample gate, the phone bar and header, the forms'
messages, the kept prototype bugs, 404 and clean URLs.

**Implemented, but wrong**
1. Reduced motion, Home hero ring (`hero-ring.ts:12–16`): the plan says the ring "shows complete".
   The arc and all labels are right, but the red dot stays at stage 1. The prototype's own
   reduced-motion code leaves the dot at the top, where the ring starts.

**Partial**
2. Old prototype links: page keys (`/#how`) and categories (`/#cat-denim`) are redirected, but the
   prototype also opened any element id (`/#yo` went to the How it works demo). Low value: the
   prototype never lived on the real domain.

**Not on the plan's lists** (harmless, but should be declared or approved)
3. Security headers in `public/_headers` (phase 5 item, done early).
4. Meta descriptions on every page, partly new copy ("Eight stages, one partner…", "One team holds
   the whole chain…"). Needs Mazen's OK as copy.
5. ARIA additions: `aria-label` on inputs, `role="alert"` on error lines, `aria-current` in the nav.
6. Track: a requested photo is added to the order it was asked for. The prototype added it to
   whichever order was open when it arrived (a prototype bug).
7. "Client contact / approver" removed from CLAUDE.md: done on Mazen's instruction.

---

## 2. Security review

**No findings.** Nothing exploitable with ≥80% confidence in the branch.

- The request-form fix is complete: `?path=` / `?product=` are accepted only if they exactly match an
  option, and the summary is built with text nodes. Nothing else reads the query string.
- Every `innerHTML` in the scripts writes only fixed content (stage data, demo orders, timestamps).
  Typed text and file names go through `textContent` or `.value`.
- The old-link redirect only goes to known routes on the same site (no open redirect).
- `target="_blank"` links have `rel="noopener"`. CI runs on push only, read-only, with no secrets.
  No keys or tokens are committed. `prototype/` is not deployed.
- Worth adding with phase 2 (not a finding): a Content-Security-Policy, and HSTS once the domain is on.

---

## 3. Accessibility audit (WCAG 2.1 AA)

8 routes at 1440×900, 390×844, 375×667, 320 px, 200% zoom and phone landscape; phone menu open,
form errors, track signed in. axe-core 4.14, keyboard walk-throughs, contrast sampled from pixels.

**23 issues: 0 critical, 12 major, 11 minor. All are inherited from the prototype**; the build
already fixes four of the prototype's gaps (field labels, error announcements, per-page titles,
reduced-motion ring).

### Contrast

| Element | Foreground | Background | Ratio | Needed |
|---|---|---|---|---|
| Body text | Bone #E8E2D8 | Obsidian #11110F | 14.67 | ✅ |
| Dim labels, placeholders | #8E8A84 | Obsidian | 5.51 | ✅ |
| Text on red buttons (every "Request a sample") | Bone | Signal Red #C5322B | **4.22** | 4.5 ❌ |
| Red small text (error lines, "Your decision", "05 / Sampling / the gate") | Signal Red | Obsidian | **3.48** | 4.5 ❌ |
| Hero lead and mono labels over photo + light | Cotton / dim | photo | 2.3–3.95 | 4.5 ❌ |
| Photo captions straight on photos | Bone | photo | 1.0–1.7 | 4.5 ❌ |
| TBC tag inside a dim line | #62605B | Obsidian | 3.01 | 4.5 ❌ |
| Field underline (the field's only edge) | #45433F | Obsidian | 1.92 | 3.0 ❌ |

### Findings

| # | Issue | WCAG | Severity |
|---|---|---|---|
| 1 | Bone on Signal Red is 4.22:1. A button-only fill `#BC2F29` reaches 4.56:1. **Design decision.** | 1.4.3 | Major |
| 2 | Signal Red used for small text (3.48:1). Bone text with a red dot (the existing `.need` pattern), or a text-only red `#E0544B` (4.99:1). **Design decision.** | 1.4.3 | Major |
| 3 | Hero text over the photo and lights is too faint in places. Darker scrim over the hero photo; mono labels in Raw Cotton. **Design decision.** | 1.4.3 | Major |
| 4 | Photo captions on photos (1.0–1.7). A soft bottom scrim. **Design decision.** | 1.4.3 | Major |
| 5 | Faded small text: TBC in dim lines, portal future stages, `.yo-lbl b`. | 1.4.3 | Minor |
| 6 | The 4 request option sets have no group name ("Starting, toggle button"). `role="group"` + `aria-labelledby`. | 1.3.1 | Major |
| 7 | Hero ring SVG read as 8 loose words; ↗ → glyphs read aloud. `aria-hidden`. | 1.1.1 | Minor |
| 8 | Field underline 1.92:1. Use `--dim`. | 1.4.11 | Minor |
| 9 | Phone menu does not scroll: at 200% zoom and in landscape the last items and WhatsApp are unreachable. `overflow-y:auto`. | 1.4.10 | Major |
| 10 | Burger has no focus outline (`all:unset`). | 2.4.7 | Major |
| 11 | No visible focus on the contact Copy/Open buttons and the file picker. | 2.4.7 | Major |
| 12 | Phone menu is not modal: Tab runs into the page behind it; Escape drops focus to the page start; the hidden bar and ticket stay focusable. `inert` + return focus to the burger. | 2.4.3 | Major |
| 13 | Focus is lost after view changes (demo sign-in, open order, Approve, request sent, contact sent). Focus the new heading. | 2.4.3 | Major |
| 14 | Hero ring steps forever with no pause (only reduced motion stops it). Stop after one circle, or pause on hover/focus. Reduced motion also misses two small loops (gate dot, "you" ping). | 2.2.2 | Major |
| 15 | No skip link (one that appears on focus keeps the look). | 2.4.1 | Minor |
| 16 | The Atelier photo row scrolls on phones but the keyboard cannot reach it. | 2.1.1 | Minor |
| 17 | Stage labels: visible "05 Sample" vs accessible name "Go to stage 5, Sampling". | 2.5.3 | Minor |
| 18 | Touch targets: all pass 24 px (AA in WCAG 2.2); 57 of 126 miss 44 px (AAA): options and tabs 40 px, burger 36×40. | 2.5.5 (AAA) | Minor |
| 19 | Errors are not tied to fields (`aria-invalid`, `aria-describedby`) and do not move focus to the problem. | 3.3.1 | Major |
| 20 | Placeholder is the only visible label; required fields not marked. **Design decision.** | 3.3.2 | Minor |
| 21 | "العربية" in the footer has no `lang="ar"`. | 3.1.2 | Minor |
| 22 | Track tabs lack the full tabs pattern (`aria-controls`, arrow keys). | 4.1.2 | Minor |
| 23 | The demo ticket re-announces itself on every stage; `.logos` label on a plain div; the phone bar outside any landmark. | 4.1.3 | Minor |

---

## 4. SEO audit (pre-launch)

No domain, so no Search Console or live data. Checked the built HTML of all 8 pages, the site served
with the real `wrangler.jsonc`, and Lighthouse 12 (mobile) on Home, About and What we make. This
sandbox has no GPU, so the speed numbers are pessimistic; re-measure with PageSpeed Insights after
deploy.

**Already good:** Lighthouse SEO 100 on every page tested; unique title and description per page;
one h1 per page; `lang="en"`; clean URLs (`/about/`, `/about.html`, `/index.html` redirect to the
clean address); a real 404 status; AVIF/WebP images with srcset; no layout shift (CLS 0).

| # | Issue | Impact | Fix |
|---|---|---|---|
| 1 | No social previews (`og:*`, `twitter:*`). WhatsApp is the main channel, and a shared link shows only a bare title. | High | og:title, og:description, og:image (1200×630), og:url. Needs the domain (absolute URLs). |
| 2 | No canonical tags, `sitemap.xml` or `robots.txt`. The clean-URL redirects are 307 (temporary), so canonicals matter. | High at launch | Set `site` in `astro.config.mjs`, add the sitemap integration, robots.txt pointing to it, self-canonicals. |
| 3 | No structured data. | Medium | Organization/LocalBusiness JSON-LD (name, logo, phone, email, Instagram, address once known, areas served); breadcrumbs on inner pages. FAQ markup is valid but Google shows FAQ results only for government and health sites. |
| 4 | Titles don't say what Full Circle is: Home is "Full Circle / Idea to product"; inner titles are 19–30 characters. Buyers search "clothing manufacturer Egypt/Cairo", "denim manufacturer", "private label", "low MOQ". | Medium | Keyword-bearing titles, e.g. "Full Circle / Clothing development and manufacturing in Cairo". **Copy decision.** |
| 5 | Two descriptions are cut off in results: Home (172 characters), What we make (188). | Low | Keep them under ~155. Copy needs approval anyway (spec #4). |
| 6 | **Home speed** (Lighthouse 33): building the 3D logo is one long task (about 10 s under Lighthouse's 4× slowdown). It delays the hero image (LCP 9.4 s) and freezes the page (TBT 16 s). | High | Build the mesh in a Web Worker (phase 5 item). The biggest single speed and usability fix; do it before launch. |
| 7 | About (Lighthouse 62): 2 s of script at load under 4× slowdown, mostly mounting the page scripts. | Medium | Profile on a real phone after deploy. |
| 8 | What we make (Lighthouse 89): the first category photo is the largest element on phones but is lazy-loaded; category photos request larger files than shown (35–50 KB extra each). | Medium | Load the first category photo eagerly with high priority; tighten `sizes`. |
| 9 | 8 font files (~100 KB) preloaded on every page. | Low | Preload only the 2–3 used above the fold. |
| 10 | Every image has empty alt text (decorative, as in the prototype). Product photos are the only images worth image search. | Low | Short descriptive alt on the category and product photos. **Copy decision.** |
| 11 | The `workers.dev` copy and preview URLs can be indexed. | Medium at launch | `workers_dev: false` once the domain is on (noted in `wrangler.jsonc`); noindex header for preview hosts. |
| 12 | Request and Contact jump from h1 to h3. | Low | Use h2 (the CSS class keeps the look). |
| 13 | No street address anywhere (only "Cairo"). | Medium | A Google Business Profile with the workshop address, and the same name, phone and address on Contact. |
| 14 | The TBC items (bulk lead time, fabrics and weights, techniques, sample pricing) are what buyers search and compare. | Medium | Already a launch blocker; filling them is also the main content lever. Later: category landing pages (with the planned ad pages); for Arabic, `/ar/` with hreflang en/ar/x-default. |

---

## Fix plan

**A. Fixes that don't change the look or the copy** (can be done now):
- Reduced-motion hero dot at the top (spec 1).
- Focus outlines on the burger, Copy/Open and the file picker (a11y 10, 11).
- Phone menu: background `inert`, focus back to the burger, menu scrolls (a11y 12, 9).
- Forms: option groups named; errors tied to their field, and focus on the first problem (a11y 6, 19).
- Focus on the new heading after view changes (a11y 13).
- Small semantics: `aria-hidden` on the ring SVG and glyphs, `lang="ar"`, a skip link that only
  shows on focus, keyboard access to the Atelier row, ticket announcements, track tabs, the two
  missed reduced-motion loops, h3 → h2 (a11y 7, 14 part, 15, 16, 17, 21, 22, 23; SEO 12).
- What we make: eager first photo, tighter `sizes`; fewer font preloads (SEO 8, 9).
- Code: move the CSS rule under production additions, scope the 3D listeners to Home, and declare
  spec items 5–6 in the plan's deliberate differences (standards 1, 4; spec 5, 6).

**B. Decisions for Mazen** (each changes the look or the copy slightly):
1. Red button fill `#BC2F29` instead of `#C5322B` for buttons only (4.56:1). Barely visible.
2. Red small text: Bone with a red dot, or a lighter text red `#E0544B`.
3. Hero: a slightly darker scrim over the photo; mono labels in Raw Cotton.
4. Photo captions: a soft dark gradient at the bottom of the photo.
5. Hero ring: stop after one full circle, or pause on hover and focus.
6. Small labels above form fields; 44 px option buttons and tabs.
7. Page titles and meta descriptions with search wording.
8. Descriptive alt text for product photos.

**C. At launch** (phase 5, needs the domain): social previews first, then canonical, sitemap,
robots, structured data, `workers_dev` off and noindex on previews, CSP and HSTS, the 3D build in a
Web Worker, and a Google Business Profile with the address.
