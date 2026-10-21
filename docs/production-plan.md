# Production build plan

Status (21 Oct 2026): **phase 1 is live on Cloudflare** (the static site at parity with the prototype),
**phase 2 is built on the staging Supabase project** (the forms send for real, test data only), and
**phase 3's database and portal are built** on a branch (`claude/phase-3-portal`): the real sign-in
and the client's own orders replace Track's demo. Real codes need the dashboard settings in §10 and,
for anyone but Mazen, the domain and Resend. See §2. The decisions below were confirmed by Mazen; the ones that are hard to reverse are recorded in
[`docs/adr/`](./adr/). Source of truth for design and content: `prototype/index.html`.

## 1. Decisions

| # | Question | Decision | Record |
|---|---|---|---|
| Q1 | Page transitions | **A**: Astro ClientRouter, so the ring wipe works as in the prototype, in every browser | [ADR 0001](./adr/0001-astro-clientrouter-for-the-ring-wipe.md) |
| Q2 | Who holds the accounts | **Mazen** (GitHub, Cloudflare, Supabase, Meta, Resend, analytics) | |
| Q3 | Sign-in channels at launch | **Email code and WhatsApp code** | [ADR 0003](./adr/0003-supabase-backend-with-invite-only-sign-in.md) |
| Q4 | Notifications | **Email and WhatsApp** (see the table in §5 for who gets what) | |
| Q5 | What Approve does | **The approval is logged; staff move the stage** | [ADR 0005](./adr/0005-approvals-are-logged-staff-move-stages.md) |
| Q6 | Request code vs order code | **One code**: the code given on request stays with the order | [ADR 0004](./adr/0004-one-code-from-request-to-order.md) |
| Q7 | Who uses the admin view | **About 4 people** (proposed roles in §4) | |
| Q8 | Domain | **Not bought yet.** It now blocks phases 2–4, not only launch (see §8) | |
| Q9 | TBC content | **Settled 15 Oct 2026:** what was unknown was cut from the site (Mazen wants less text), the rest filled in. No TBC tag remains | |
| Q10 | Analytics | Recommendation: **Umami Cloud**, free plan, EU region (§6) | |
| Q11 | Privacy note | §7, as built. **Reviewed by the lawyer and confirmed** (Mazen, 15 Oct 2026) | |
| — | Hosting | **Cloudflare Workers (static assets)** rather than Pages, following Cloudflare's current advice | [ADR 0002](./adr/0002-cloudflare-workers-static-assets.md) |

## 2. Where things stand

**Phase 1 is done** (branch `claude/youthful-maxwell-aiw9ob`):

- The 7 pages on real URLs: `/`, `/how-it-works`, `/what-we-make`, `/about`, `/request-a-sample`,
  `/track`, `/contact`, plus a 404 in the same design. Old prototype links (`/#how`) are redirected.
- Design and motion carried over unchanged: the prototype's CSS in its original order, the 3D hero
  mark, the scroll-pinned ring, the "you are the order" demo, the ring-wipe page transition, the
  cursor, lights, reveal and count-up, and the phone bar, menu and carousels.
- Fonts are served from the site (no Google request). Photos are AVIF/WebP/JPEG at several widths,
  built from the full-size originals. three.js loads only on Home.
- State carries across pages as it did in the one-file prototype. Picks made on the request form,
  the demo order and the portal demo are still there when you come back. Buttons on other pages
  open the request form with their pick filled in (`/request-a-sample?path=Scaling&product=Denim`).
- **Still a demo, by plan:** Track order is the prototype's demo portal (phase 3). The request and
  contact forms send for real since phase 2 (below).

**How "identical" is checked** (runs in CI on every push, see `tests/`):

- *Parity:* every page of the build is screenshotted next to the same prototype page at 1440×900,
  390×844 and 375×667 and compared pixel by pixel. The layout comparison (photos and 3D hidden)
  differs by at most 0.03% of pixels on any page, and the page heights match. A second comparison at
  reduced resolution includes photos and the 3D mark.
- *Behaviour:* navigation and the wipe, back/forward, anchors, header hiding, the phone menu and
  bar, the scroll ring, the sample gate, carry-over into the request form, both forms, the track
  demo, the 3D mark (and its flat fallback) and reduced motion.
- *Review:* independent reviewers compared each area with the prototype by hand (interactions,
  timing, states after moving between pages). Their confirmed findings are fixed and covered by
  tests, including one security bug: a crafted link could inject HTML into the request summary.
- *CSS:* every rule of the source stylesheet is compared with the built one. This caught a minifier
  bug that dropped `backdrop-filter` and broke the phone menu in Chrome. It also showed that the blur
  needs its `-webkit-` version for iPhones on iOS 15–17.

Small, deliberate differences from the prototype:
- Links that start a request are real links.
- The demo's "Outerwear" opens the form on "Jackets" (the prototype passed a product the form does
  not have).
- With reduced motion the hero ring shows complete, its dot back at the top (the prototype meant
  to, but left only the first stage lit).
- Back returns to where you were on the page.
- A new page is already at the top when the wipe opens. The prototype's page visibly scrolled up
  during the reveal. If the old page is still scrolling (a category button, say) when you click a
  link, it stops as the wipe starts to cover it.
- A link to an anchor lands on it directly instead of scrolling down from the top.
- Keyboard focus starts again at the top of the new page, as on any page load.
- Phone browsers tint their toolbar Obsidian.
- The "Home" crumb on inner pages can be clicked; in the prototype the big title's text box covered
  it.
- On Track, a photo you ask for is added to the order you asked on (the prototype added it to
  whichever order was open when it arrived).
- Accessibility, mostly invisible (the audit's fix plan A, `docs/audits/2026-10-08-site-audit.md`):
  fields and option groups have names, error lines are announced and tied to the fields they are
  about, the nav marks the page you are on, a skip link shows on the first Tab, the phone menu
  holds focus like a dialog (and scrolls when taller than the screen), the Track tabs work with
  arrow keys, and keyboard focus now shows on the burger, the Copy/Open buttons and the file
  picker too. After a change of view (request or message sent, Track sign-in, an order opened or
  approved) focus moves to the heading that replaced the buttons, without scrolling or an outline.
  One change can be seen with a mouse: a request sent with a pick missing now scrolls to that
  question (focus moves to its first option).
- Approved by Mazen on 13 Oct 2026 (the audit's part B), so the site now looks slightly different
  from the prototype on purpose: red button fills are #BC2F29; small red text (error lines, "Your
  decision", the gate label) is Bone with a red dot, and "Next decision" on Track is dim, as the dot
  means "needs you"; a scrim over the hero (fading to the right on wide screens, so the lights by
  the ring keep their colour) with the mono labels in Raw Cotton; a soft gradient behind captions
  on loaded photos; the hero ring fills once and rests complete; a label above every field;
  44px option buttons and tabs on phones; new page titles and descriptions; descriptions for the
  product photos (not where a link around the photo already names it). The CSS is the marked block
  at the end of `global.css`; the parity tests apply it to the prototype before comparing.
- Asked for by Mazen on 14 Oct 2026: on phones the hero mark is 1.25× bigger inside its ring (the 3D
  mark and the flat fallback; the ring and the page stay as they were), and a finger turns the 3D
  mark further and more directly: 1.7× the mouse's tilt, the full turn over 90px of travel instead
  of 160px, catching up with the finger 2.7× as fast. It settles back as before when let go. The
  mouse on a computer keeps the prototype's tilt. (Tilting with the phone's gyroscope was looked at
  and dropped: on iPhones it needs a permission prompt.)

**Prototype bugs:** both are fixed. On Track, the line under the order code now follows the order
(phase 3); the request form no longer stays visible under "Received." (phase 2).

**Phase 2 is built** (15 Oct 2026, branch `claude/phase-2-requests`), on the Supabase project
**full-circle-staging** (Frankfurt, free plan), with test data only:

- *Database:* requests, contact messages, consent records, the log of every message sent, and
  staff with their roles. Codes come from one sequence, starting at FC-2501. Row-level security on
  every table; the publishable key reaches none of them. Tested: 29 database checks of who can
  reach what, run in CI.
- *Forms:* both post to Edge Functions (`submit-request`, `submit-contact`) that check the same
  rules as the page, a Turnstile token and a limit of 5 sends an hour per contact (however the
  email or number is typed). The request answers with its code. Each request and message carries
  where the visitor came from (ad tags, referring site, first page). Emails: an alert to staff for
  each, a receipt to a brand that gave an email; the WhatsApp receipt waits for phase 4 and is
  logged as such.
- *No files* (Mazen, 15 Oct 2026): the request form has no upload, so the site stores no files.
  Sketches and photos come on WhatsApp: once a request is sent, "Continue on WhatsApp" opens a chat
  with its code ready to send. (The first build took files; they were removed the same day.)
- *Form lines* (approved by Mazen on 15 Oct): the privacy line under each button, and "We'll reply
  on WhatsApp" with a separate unticked box for order updates once a number is typed (stored with
  its exact wording). The **privacy notice** at `/privacy`, with the company details and the
  periods (requests one year, orders five years).
- *Checked on staging:* requests by email and by WhatsApp (with an opt-in) landed with their
  consent and log rows; the publishable key was refused on every table.

**Left for phase 2 to be done:** a Resend account and key (until then nothing is emailed; every
email is logged as skipped), then the domain verified at Resend so receipts reach brands; a real
Turnstile widget (staging's test key lets everything through); the nightly clean-up that deletes
requests and messages a year old that never became orders (`/privacy`).

**Phase 3 is built** (21 Oct 2026, branch `claude/phase-3-portal`, not yet merged or deployed):

- *Database* (migration `20261020221044`, applied to staging): clients and their people, orders,
  specs, decisions, stage photos (a private bucket, opened through signed links), photo requests, the
  approval log and a queue of order messages. A client's people read only their own client's orders.
  They change nothing directly: Approve, Ask for changes and Request a photo are database functions
  that check who is asking and write the log in the same step. Staff work through functions too
  (create an order, move a stage, open or withdraw a decision, add a photo), so nothing skips the log.
  The log is append-only: a trigger refuses any edit, and a delete unless the order itself is gone.
  Tested: 104 checks of who can do what (`supabase/tests/database/orders.test.sql`), with the 29 from
  phase 2.
- *Portal* (`/track`): the prototype's two steps, now real. A code goes to the email (or, once phase 4
  switches it on, the WhatsApp number) only if that person is on an order, and the page never says
  which. Then the client's orders, each with its stage ring, the decision waiting, photos, specs and
  the log, and a box to turn order updates on WhatsApp on or off (stored with its words). The session
  is the only thing kept in the browser. Looks as before: the parity suite passes with the demo note
  gone (an approved change), and the behaviour tests run against a stand-in for Supabase.
- *Messages:* each client action queues an email to every member of staff, and each staff action an
  email to the client's people (`order_notifications`). Nothing sends them yet: the `notify` function
  comes with Resend (it needs the key) and phase 4.

**Decided in the build, for Mazen to confirm** (each is a small change if he decides otherwise):
1. An order that did not come through the form (a client on WhatsApp, a repeat order) takes a new
   code from the same sequence; a second order from one request gets `-B`.
2. The sample gate is held by the database: no move past 05 until the client has approved a decision
   opened at stage 05.
3. No Undo: a stage can be moved back, and both moves stay in the log. The client is emailed on every
   move; WhatsApp waits for phase 4 and the client's opt-in.
4. A decision may be opened without photos (a tech pack sign-off has none).
5. When a person is removed, the log keeps their name as it was; their account goes.

**The 3D mark is built off the main thread** (14 Oct 2026, early: it was a phase 5 item but needs
no domain). The logo mesh has about 724,000 vertices; extruding it took about 0.6 s on the main
thread of a fast computer and seconds on a phone, with the page frozen meanwhile (the prototype has
the same cost). It is now extruded in a Web Worker while the scene is set up, and the shaders
compile in that time. The mesh is the same to the byte, and a test compares the mark with the
prototype's at full size: no pixel differs. Still on the main thread: the GPU set-up (the lighting
environment and the first draw), which a phone's GPU does quickly. This sandbox has no GPU, so its
speed numbers say little here; re-measure Home with PageSpeed Insights after deploy. As in the
prototype, once three.js has arrived the 3D mark always comes up, however long the build takes: the
2.6 s limit before the flat mark is for three.js arriving.

## 3. Architecture

```
Cloudflare Workers (static assets)                   Supabase (EU, Frankfurt)
 ├─ public site, 7 pages (Astro, static)              ├─ Postgres, RLS on every table
 ├─ /track   client portal (JS app)   ──────────────► ├─ Auth: invite-only, 6-digit codes
 ├─ /admin   staff app (JS app, noindex) ───────────► │    email  → Resend (SMTP)
 └─ forms ───────────────────────────────────────────► │    WhatsApp → Send SMS hook → Meta Cloud API
                                                       ├─ Storage: private buckets (stage photos)
 Umami Cloud (EU) ◄── pageviews + 3 events            └─ Edge Functions (run in Frankfurt):
                                                            submit-request, submit-contact, notify,
                                                            whatsapp-webhook
```

- **Hosting:** Cloudflare Workers with static assets, no server code (ADR 0002). Every pull request
  gets its own preview URL. Asset requests are free and unlimited. Previews must not talk to the
  live database, so phase 2 adds a second (staging) Supabase project for previews.
- **WhatsApp without Twilio:** codes and notifications go straight to Meta's WhatsApp Cloud API
  from Supabase. Twilio would add a fee on every message and still needs Meta's approval.
- **A separate WhatsApp number for the system.** The current number (+20 101 143 5406) stays in the
  WhatsApp Business app for real conversations. Codes and notifications come from a new number,
  shown as "Full Circle". Replies to that number get an automatic answer pointing to the main number.
  Using the same number for both ("coexistence") is possible but needs a Meta partner and has limits.

## 4. Backend (Supabase)

### Tables (all with RLS)

| Table | Purpose | Access |
|---|---|---|
| `staff` | user, role (`owner` / `staff`) | owners manage; staff read |
| `clients` | brand, notes | staff; members read their own |
| `client_members` | user ↔ client (a brand can have several people) | staff; user reads own rows |
| `requests` | code, path, product, qty, have, brand, contact, contact type, note, status, UTM/referrer | insert **only through the Edge Function**; staff read and update |
| `messages` | contact form | function inserts; staff read |
| `orders` | code, client, request, name, product, summary, fabric, qty, stage (1–8), status, due date | staff read and edit the details (the stage moves only through `move_stage`); members read their client's orders |
| `order_decisions` | what staff ask the client to approve: stage, title, words, photos shown, open / approved / changes asked / withdrawn; one open per order | functions write; staff and members read |
| `photo_requests` | a client asking for a photo of a stage, answered when staff add one | functions write; staff and members read |
| `order_specs` | key/value rows per order | staff write; members read |
| `order_events` | **append-only** log: approved, changes asked, photo asked, stage moved, photo added; who, when, note, **and a copy of the decision text and photo ids that were approved** | members write only through RPCs; nobody edits or deletes |
| `stage_photos` | order, stage, file, caption | staff write; members read (signed URLs, private bucket) |
| `contact_consents` | email or WhatsApp number, channel, wording version, time, source (request code / portal), opted in or out | written by functions and the portal; staff read |
| `notifications` | every message sent about a request or contact message: event, recipient, channel, status | functions write; staff read |
| `order_notifications` | the same for orders: queued by the functions, sent by `notify` | functions write; staff read |

- **Codes** (ADR 0004): one database sequence issues `FC-####` for requests, and the same code
  becomes the order's. If one request turns into two orders, the second gets a suffix
  (`FC-2418-B`). A code identifies an order but never grants access; access always comes from
  being a member of the client.
- **Client actions** go through checked database functions (`approve_decision`, `request_changes`,
  `request_photo`, and `set_updates_consent` for WhatsApp updates). Each checks membership and that a decision is open, writes the event, and
  triggers a notification. Clients never write to `orders`.
- **Approve** (ADR 0005) closes the decision and writes the event; **it does not move the stage**.
  The portal then shows "Approved, waiting on Full Circle" until staff move the order on. (The
  prototype's demo moves the stage itself; the demo stays as it is until the real portal replaces it.)
- **Staff roles** (proposed, please confirm): **owner** can do everything, including adding and
  removing staff and exporting or deleting someone's data when asked; **staff** answer requests,
  create orders, open decisions, upload photos and move stages. Staff sign in by email code.
- **Housekeeping:** a nightly job deletes requests and messages older than the retention period.
  The site takes no files from visitors; stage photos, which staff upload, are kept in a private
  bucket and shown only through signed links.

### Admin (`/admin`)
Same design system, plain and built for a phone first:
1. **Inbox**: new requests and messages, status, one tap to WhatsApp the client, **Convert to order**
   (creates the client and the order at its entry stage, and sends the sign-in invite).
2. **Orders**: by stage, with "waiting on client" and "waiting on us" filters. Approvals waiting
   for a stage move are flagged.
3. **Order**: move stage, open a decision, upload stage photos (resized in the browser first), answer
   photo requests, edit specs, read the log.

## 5. Sign-in and notifications

**Sign-in** is invite-only. Staff create each client user with an email (required, it is the
fallback) and, if they have one, a WhatsApp number. The sign-in screen stays the prototype's two
steps: enter email or number, then the 6-digit code. It never says whether an account exists, and a
Turnstile check stops anyone from triggering paid WhatsApp codes in bulk. "Use email instead" is
always offered, because WhatsApp is not reachable everywhere (for example mainland China), and a
code only arrives on the client's main phone.

Phone numbers are typed in many formats, so one shared function turns them into international form
(+20…, +966…) on the forms, in the functions and when staff create users. Otherwise a sign-in would
not match the stored user.

**Who gets what** (each WhatsApp row is a Meta template that has to be approved):

| Event | Client email | Client WhatsApp* | Staff email | Admin badge |
|---|---|---|---|---|
| Sample request received | receipt with code | receipt with code | ✓ | ✓ |
| Contact message | — | — | ✓ | ✓ |
| Invited to the portal | ✓ | ✓ | — | — |
| Decision waiting on you | ✓ | ✓ | — | — |
| New stage photo | ✓ (grouped) | ✓ (grouped) | — | — |
| Stage moved | ✓ | optional | — | — |
| Client approved / asked for changes / asked for a photo | — | — | ✓ | ✓ |

\* only if the client agreed to WhatsApp updates (§7). Staff alerts go by email plus the admin badge.
Meta is likely to class a "new request" alert to staff as marketing, not as part of the
recipient's own order, which costs more and can be refused. Add staff WhatsApp alerts only if Meta
approves that template as a utility message.

All messages are transactional. Anything promotional (new fabrics, offers) would need separate
consent and falls under Egypt's e-marketing rules, so it is out of scope.

## 6. Analytics: Umami Cloud (recommendation)

- **Why:** no cookies (so no cookie banner), counts the events that matter ("Sample request sent",
  "Contact message sent", "WhatsApp clicked"), counts page changes made by the ClientRouter on its
  own, about 3 KB, free up to 100,000 events a month, and you can pick the EU region when you sign up.
- **Cloudflare Web Analytics** is free but cannot count events, so it cannot tell you how many
  requests came in or from where. **Plausible** is the paid alternative (from about $9/month): EU
  only, counts back/forward too (Umami does not), and its shared dashboards can have a password.
  Umami's are open to anyone with the link. Switching later is a small change.
- **Rules for the build:** events carry no personal data; the portal and admin pages are never
  tracked; request source (UTM, referrer) is also saved with each request in the database, so
  conversions by source don't depend on analytics. Turn off Cloudflare's own analytics on the
  domain, which Cloudflare switches on by default.
- Free plan: 1 site, 6 months of history, no staff seats (a share link instead). Upgrade
  ($20/month) if you want 2 years of history or individual logins for the 4 staff.

## 7. Privacy (recommendation, not legal advice)

**Timing matters.** Egypt's Personal Data Protection Law (151/2020) has had its executive
regulations since November 2025, and the one-year grace period ends around **31 October 2026**.
Summaries by law firms say a company that collects personal data needs a licence from the Personal
Data Protection Center (PDPC), a registered data protection officer, and a licence or permit to
store data abroad. Supabase in Frankfurt and the US providers count as abroad. The PDPC's online
portal was reported as not yet open in September 2026. So:

**Done (15 Oct 2026):** the lawyer reviewed the forms and the privacy notice and confirmed them
(Mazen). Staging keeps test data only; the live project is created at launch.

**Privacy notice**: one short page, in plain language. It covers:
- who we are and how to reach us about privacy
- what we collect: request and contact details, portal account, order records
- why we collect it and on what basis
- who processes it: Supabase, Cloudflare, Resend, Meta (WhatsApp), Umami
- where it is stored: mainly Frankfurt, with some providers in the US and elsewhere
- how long we keep it
- your rights, and how to ask for a copy or deletion
- how to stop WhatsApp or email updates
- cookies and browser storage
- security and breaches
- date and version

The notice and the form lines ship in English, as built and confirmed; the Arabic version comes with
the Arabic site.

**On the forms** (no "I agree" checkbox; Turkish and Egyptian guidance both reject bundled
"I accept" wording):
- One line under the button: *"We use these details to reply to your request. They are stored
  mainly in Frankfurt, Germany; some of our providers in the US and elsewhere also process them.
  Privacy notice."*
- When a WhatsApp number is entered: a plain line *"We'll reply on WhatsApp"*, plus a separate
  unticked box for ongoing order updates on WhatsApp (Meta requires an opt-in that names Full
  Circle). The wording, time and number are stored.
- No uploads: the site takes no files (15 Oct 2026), so no hint is needed.

These additions were approved on 15 Oct 2026 and are built.

**Cookie banner: not needed** as long as analytics stays cookieless, fonts and three.js stay
self-hosted (they already are), and the only browser storage is the signed-in client's session.
The notice describes this instead.

The accounts are in Mazen's name, but Meta business verification and the PDPC filings have to be in
Full Circle's legal name and use its commercial register and tax card.

## 8. Phases

| # | Phase | Done when |
|---|---|---|
| 0 | ✅ Repo, Astro, tests, CI | Done |
| 1 | ✅ **Static site at parity** | Done: live on Cloudflare at full-circle.mazenghaly123.workers.dev and checked by Mazen (15 Oct 2026) |
| 2 | 🔶 Requests: Supabase (live + staging), submit-request and submit-contact with Turnstile, staff emails, request receipts, consent records, privacy notice page, form lines, Continue on WhatsApp | A test request lands in the database and in the staff inboxes (test data only). **Built on staging; lands in the database. The inboxes wait on a Resend key** |
| 3 | 🔶 Client portal: sign-in by email and WhatsApp code, orders, decisions, photos, log, consent settings; RLS tests (one client can never see another's orders); week 1 starts by testing WhatsApp codes on Meta's test number | A test client signs in both ways and approves a sample. **Built; email codes wait on the settings in §10, WhatsApp codes on phase 4** |
| 4 | Admin for the 4 staff (roles), WhatsApp notifications, the reply-handling webhook | A test order goes through all 8 stages from a phone |
| 5 | Launch: domain live, SEO (titles, descriptions, OG images, sitemap, robots, structured data), Umami, security headers, Lighthouse, **no TBC left** | Live on the domain |
| Later | Arabic/RTL site, Starting/Scaling ad landing pages, Full Circle Studio | — |

**The domain blocks phases 2–4.** Without it, email can only reach the person who owns the email
account (so no client codes and no alerts to the other staff), Meta's business verification needs a
website on it, and Turnstile, the Supabase URLs and the analytics setup all ask for it. A `.com` can
be bought at Cloudflare at cost. A `.eg`/`.com.eg` comes from a local registrar, and its
nameservers are then pointed at Cloudflare.

## 9. Running costs (estimate; re-check prices at sign-up)

| Item | Per month |
|---|---|
| Supabase Pro (free projects pause after a week without activity) | about $25 |
| Cloudflare Workers, static site | $0 |
| Umami Cloud (free plan; Pro if you want 2-year history and staff logins) | $0 (or $20) |
| Resend email (free: 3,000 a month, at most 100 a day) | $0 (or $20) |
| WhatsApp messages through Meta (≈200 a month at $0.004–0.016 each) | about $1–5 |
| A SIM for the system WhatsApp number | top-ups |
| Domain | per year |
| PDPC fees (reported as free under 100,000 records, not confirmed) | one-off |

## 10. What I need from you

**Before phase 2:**
1. Buy the domain.
2. ~~Brief the lawyer (§7).~~ Done 15 Oct.
3. ~~Create the Supabase account~~ (done: staging is up; live comes at launch). Create a Resend
   account and add its API key to the staging project's function secrets (`RESEND_API_KEY`).
4. ~~Decide on the Arabic privacy page at launch (§7).~~ English as built; Arabic with the Arabic site.
5. ~~Approve the small form additions (§7).~~ Approved 15 Oct and built.
6. Confirm the staff roles (§4), and send the names and emails of the 4 staff.

**Before phase 3 can be tried** (Supabase dashboard → Authentication, staging first; I cannot change
these from here):
1. *Sign In / Providers:* turn off "Allow new users to sign up" (the portal is invite-only), and set the
   email OTP expiry to 600 seconds (10 minutes).
2. *Emails → Magic Link* template: put the code in it, for example "Your Full Circle code is
   {{ .Token }}. It works for 10 minutes." Without `{{ .Token }}` the email carries a link, not a code.
3. Until Resend is set up as the project's SMTP sender (after the domain), Supabase's own sender only
   reaches the members of the Supabase organisation, a few emails an hour: enough for Mazen to try it.
4. *Attack Protection:* once the real Turnstile widget exists, turn on its check here with the
   widget's secret.

**Before phase 3–4:**
7. Set up Meta: a Meta Business portfolio and a WhatsApp app. You may already have a portfolio
   behind the Instagram account. Business verification uses Full Circle's documents.
8. Get a new SIM for the system WhatsApp number.
9. Approve the template wording for each WhatsApp message in §5.
