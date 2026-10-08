# Production build plan (draft for Mazen to confirm)

Status: **proposal, nothing built yet.** Source of truth: `prototype/index.html`.

## 1. What the prototype is today

I read through all 7 pages and screenshotted them at 1440×900, 390×844 and 375×667. Every page
renders, there are no JS errors, and nothing scrolls sideways at either phone size.

| Page | What's real | What's demo/fake and must become real |
|---|---|---|
| Home | Hero (3D mark + stage ring), Starting/Scaling split, make grid, pinned scroll "How it works", promise, FAQ, contact | The "Nothing ships unseen" portal card is a demo (it should stay one) |
| How it works | "You are the order" walkthrough, ticket bar, sample gate | All demo by design. "Turn this into a real request" carries path + product into the request form |
| What we make | 6 categories, MOQs, sampling times | Fabrics and bulk lead time are TBC |
| About | Copy, chain diagram, rules, markets | Team names, portraits and floor photo are TBC (must be real photos) |
| Request a sample | 4-pick configurator, summary, file upload, validation | Submit only generates a random `FC-####` in the browser. Nothing is saved, nobody is notified, files go nowhere |
| Track order | Login → orders → order view (ring, decision, photos, specs, log) | Login accepts anything. 3 hard-coded orders. Approve, request photo and changes are simulated |
| Contact | Copy buttons, form | The form doesn't send anything |

Things I noticed that the build should handle:
- **External runtime dependencies**: three.js comes from `cdn.jsdelivr.net` and fonts from Google Fonts. In production
  both get bundled and self-hosted: faster, no third-party request on first paint, and nothing breaks if a CDN is down.
- **Michroma is loaded but never visible.** It's only used on `.word`, which holds an SVG logo. That's a wasted
  font request, so it gets dropped.
- **Logo SVGs are about 75% C2PA metadata** (~32–41 KB each). They get stripped for the web (the originals stay in `assets/`).
- **Photos**: the prototype loads ~100–215 KB JPGs at one size. The build makes AVIF/WebP + srcset from `assets/photos-raw/`.
  I'll need a slot → raw-file mapping (the raw files have descriptive names). I can draw it up from the images, and you check it.
- **TBC tags (13 on the site) and placeholders** ("Logo" strip, "Name" team cards, "Real photos from the floor go here")
  must not go live as they are. See question Q6.
- **Request code** is made at random in the browser, so two requests can get the same code. The server must issue codes.
- Small phone item: at 375×667 the bottom bar covers the "open the demo account" link on Track until you scroll. That link
  goes away in production anyway.

## 2. Proposed architecture

```
Cloudflare Pages (static, Astro)          Supabase (EU region)
 ├─ public site (7 pages)                  ├─ Postgres + RLS on every table
 ├─ /track   (client portal, JS app)  ───► ├─ Auth: email OTP (6-digit code); WhatsApp OTP later
 ├─ /admin   (Faris, JS app, noindex) ───► ├─ Storage: private buckets (stage photos, request uploads)
 └─ forms ─────────────────────────────►   └─ Edge Functions: submit-request, submit-contact, notify
                                              └─► Resend (email to Faris + clients)
```

### Front end: Astro (recommended over plain multi-page HTML)
- Shared layout (header, menu, footer, phone bar, cursor, wipe) is written once rather than copied into 7+ files.
- Static output with no framework runtime. Each page loads only the scripts it uses. `three` is bundled and
  loaded only on Home, after first paint.
- Built-in image pipeline (AVIF/WebP/srcset), sitemap, and i18n routing ready for Arabic/RTL later.
- **CSS and JS move over close to verbatim**, split into modules by feature (hero ring, 3D mark, how-scroll, "you are the order",
  portal demo, configurator, header/phone bar, carousels, reveal/count-up, cursor/lights). No redesign and no framework rewrite.

### Routes (hash router → real URLs)
| Prototype | Production |
|---|---|
| `#home` | `/` |
| `#how` | `/how-it-works` |
| `#make` | `/what-we-make` (`#cat-denim` etc. stay as in-page anchors) |
| `#about` | `/about` |
| `#start` | `/request-a-sample` (`?path=Scaling&product=Denim` carries choices from other pages) |
| `#track` | `/track` (login, list and order view stay client-side, e.g. `/track?o=FC-2418`) |
| `#contact` | `/contact` |
| — | `/admin` (staff only, noindex) |

A small script on `/` sends old `#how`-style links (for example, from the shared preview) to the new URLs.

### Page transitions (needs your call, see Q1)
The ring-wipe currently runs between hash "pages" inside one document. With real URLs there are two ways to keep it:
- **A. Astro ClientRouter (recommended).** Navigation stays in-page, so the wipe stays identical: it starts from the click
  point and works in every browser. The catch: every page script has to set itself up again (and clean up) on each
  navigation. I'd build that in from the start.
- **B. Native cross-document View Transitions.** Simpler, and pages are fully separate. But Firefox gets no wipe, and the
  click-point origin is harder to reproduce.

### Proving "identical"
A Playwright parity suite renders every page from the prototype and from the build, at 1440×900, 390×844 and 375×667,
and compares screenshots. Motion is frozen for the comparison. A second set of tests runs the interactions:
pinned ring, the sample gate, the phone bar states, the menu, and the header hiding on scroll. This runs in CI on every PR.

## 3. Backend (Supabase)

### Tables (all with RLS)
| Table | Purpose | Who can read / write |
|---|---|---|
| `staff` | user_id, role | staff only |
| `clients` | brand, notes | staff; members read their own |
| `client_members` | user_id ↔ client (a brand can have several people) | staff; user reads own rows |
| `requests` | code, path, product, qty, have, brand, contact, contact_kind, note, status (new/contacted/converted/closed), utm/source | insert **only via Edge Function**; staff read/update |
| `request_files` | storage path per upload | function inserts; staff read |
| `messages` | contact form | function inserts; staff read |
| `orders` | code `FC-####`, client_id, name, meta, product, fabric, qty, stage (1–8), entered_at_stage, decision_title, decision_body, decision_open | staff full; members read their client's orders |
| `order_specs` | key/value rows per order | staff write; members read |
| `order_events` | **append-only** approval log: approved / changes requested / photo requested / stage moved / photo added, by whom, when, note | members insert only through RPCs; nobody updates or deletes |
| `stage_photos` | order, stage, storage path, caption | staff write; members read (signed URLs, private bucket) |
| `photo_requests` | order, stage, status | members create via RPC; staff fulfil |

Client actions go through `security definer` RPCs (`approve_decision`, `request_changes`, `request_photo`). Each one checks
membership and that a decision is open, writes the event, and triggers a notification. Clients never write to `orders` directly.

### Auth
- **Invite-only.** Faris (or converting a request) creates the client. Sign-in uses `shouldCreateUser: false`, and the
  screen says "code sent" whether or not the address exists, so it can't be used to check who is a client.
- **Email 6-digit OTP at launch.** It's free and built in, and it matches the prototype's two-step UI exactly.
- **WhatsApp OTP** needs Twilio (Verify or WhatsApp sender) and a Meta-approved business sender, and costs money per
  message. I'd add it as a follow-up phase (Q3).

### Request flow
`/request-a-sample` → `submit-request` Edge Function. It checks Cloudflare Turnstile (spam), validates the input, issues
the code, saves the request, and gives the browser signed upload URLs for the files. Then it emails Faris (Resend)
and, if the contact is an email, sends the client a receipt. Contact form: same pattern, `messages` table.

### Admin for Faris (`/admin`)
Same design system, but plain and built for a phone first (Faris will mostly be on a phone):
1. **Inbox**: new requests and messages, set status, one tap to WhatsApp the client, **Convert to order** (creates the client and
   order at the right entry stage and sends the sign-in invite).
2. **Orders**: list by stage, with "waiting on client" and "waiting on us" filters.
3. **Order**: move stage, open a decision (title + text), upload stage photos (resized in the browser before upload),
   answer photo requests, edit specs, view the log.

## 4. Phases (each one ends with something you review)

| # | Phase | Done when |
|---|---|---|
| 0 | Repo setup: source material in repo, Astro scaffold, CI (build + parity), Cloudflare Pages preview deploys per PR | A blank build deploys to a `*.pages.dev` preview |
| 1 | **Static site at parity**: all 7 pages, all motion, phone experience; demos stay demos; forms not wired yet; self-hosted fonts + three; responsive images; old-hash redirect | Parity suite green at all 3 sizes; you sign off on preview |
| 2 | Requests: Supabase project, `requests`/`messages` + uploads, Turnstile, email to Faris | A real request lands in the DB and in Faris's inbox |
| 3 | Client portal: auth, orders, decisions, photos, log, RLS tests (one client can't see another's orders) | Faris can sign in as a test client and approve a sample |
| 4 | Admin for Faris | Faris runs a test order through all 8 stages from his phone |
| 5 | Launch: domain, SEO (titles, descriptions, OG images, sitemap, robots, JSON-LD), analytics, Lighthouse check, remove TBCs | Live on the domain |
| Later | Arabic/RTL, Starting/Scaling ad landing pages, WhatsApp OTP + WhatsApp notifications, Full Circle Studio | — |

## 5. Questions

### Blocking phase 1
- **Q1 Page transitions**: A (ClientRouter, wipe identical everywhere) or B (native, simpler, no wipe in Firefox)? I recommend A.
- **Q2 Accounts**: who owns the GitHub repo, Cloudflare and Supabase accounts? I'd put them under a Full Circle
  business email that Faris controls, with you as admin. Note that **Supabase free projects pause after 7 days with no
  activity**, so production should be on Pro (~$25/month).

### Blocking phases 2–4
- **Q3 Sign-in channel at launch**: email OTP only, or WhatsApp OTP too (Twilio + Meta business verification, paid per message)?
- **Q4 Notifications**: email to Faris on each new request (Resend, needs the domain)? WhatsApp alerts too? Which address
  or number? Should clients get an email when a decision is waiting on them or a photo is uploaded?
- **Q5 Approval behaviour**: when a client taps Approve, does the order **move to the next stage automatically** (as in the
  prototype), or is the approval logged and Faris moves the stage? I recommend the second, because Faris stays in control of the floor.
- **Q6 Request code vs order code**: should the `FC-####` given on request become the order's code (one code for the
  client's whole journey), or should orders get their own code when they start? I recommend one code.
- **Q7 Who else uses /admin** besides Faris, and what can each person do?

### Blocking launch (phase 5)
- **Q8 Domain**. It's needed for email sending (Resend DNS), auth emails, OG/canonical URLs.
- **Q9 TBC content**: launch only when all of it is filled in, or launch with TBC rows hidden and the placeholder sections
  (atelier, team, client logos) left out until real photos exist?
- **Q10 Analytics**: Cloudflare Web Analytics (free, cookieless, but no conversion events) or Plausible/Umami
  (tracks "request sent" and "WhatsApp clicked")? I'd choose Plausible or Umami because the request is the conversion that matters.
- **Q11 Data/privacy**: is a short privacy note enough (what's stored, why, how to delete), given Gulf/Turkey/China clients?
  The Supabase region would be EU (Frankfurt), the closest to Cairo.
