# Production build plan

Status (8 Oct 2026): **phase 1 is built** (the static site at parity with the prototype). The
decisions below were confirmed by Mazen; the ones that are hard to reverse are recorded in
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
| Q9 | TBC content | **Filled in before launch.** Launch is blocked until no TBC tag remains | |
| Q10 | Analytics | Recommendation: **Umami Cloud**, free plan, EU region (§6) | |
| Q11 | Privacy note | Recommendation in §7. **Talk to an Egyptian data-protection lawyer this month** | |
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
- **Still demos, by plan:** the request and contact forms check the input and show a code, but send
  nothing (phase 2). Track order is the prototype's demo portal (phase 3).

**How "identical" is checked** (runs in CI on every push, see `tests/`):

- *Parity:* every page of the build is screenshotted next to the same prototype page at 1440×900,
  390×844 and 375×667 and compared pixel by pixel. The layout comparison (photos and 3D hidden)
  differs by at most 0.03% of pixels on any page, and the page heights match. A second comparison at
  reduced resolution includes photos and the 3D mark.
- *Behaviour:* navigation and the wipe, back/forward, anchors, header hiding, the phone menu and
  bar, the scroll ring, the sample gate, carry-over into the request form, both forms, the track
  demo, the 3D mark (and its flat fallback) and reduced motion.
- *CSS:* every rule of the source stylesheet is compared with the built one. This caught a minifier
  bug that dropped `backdrop-filter` and broke the phone menu in Chrome. It also showed that the blur
  needs its `-webkit-` version for iPhones on iOS 15–17.

Small, deliberate differences from the prototype: links that start a request are real links; the
demo's "Outerwear" opens the form on "Jackets" (the prototype passed a product the form does not
have); with reduced motion the hero ring shows complete (the prototype meant to, but left only the
first stage lit); Back returns to where you were on the page.

**Found while building, for later:** the 3D logo mesh has about 724,000 vertices, and building it
takes about 0.6 s on the main thread on a fast computer, more on phones. The prototype has the same
cost. In phase 5 I'd build the mesh in a Web Worker so the page stays responsive; it looks exactly
the same.

## 3. Architecture

```
Cloudflare Workers (static assets)                   Supabase (EU, Frankfurt)
 ├─ public site, 7 pages (Astro, static)              ├─ Postgres, RLS on every table
 ├─ /track   client portal (JS app)   ──────────────► ├─ Auth: invite-only, 6-digit codes
 ├─ /admin   staff app (JS app, noindex) ───────────► │    email  → Resend (SMTP)
 └─ forms ───────────────────────────────────────────► │    WhatsApp → Send SMS hook → Meta Cloud API
                                                       ├─ Storage: private buckets (stage photos, uploads)
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
| `request_files` | storage path per upload | function inserts; staff read |
| `messages` | contact form | function inserts; staff read |
| `orders` | code, client, name, product, fabric, qty, stage (1–8), open decision | staff full; members read their client's orders |
| `order_specs` | key/value rows per order | staff write; members read |
| `order_events` | **append-only** log: approved, changes asked, photo asked, stage moved, photo added; who, when, note, **and a copy of the decision text and photo ids that were approved** | members write only through RPCs; nobody edits or deletes |
| `stage_photos` | order, stage, file, caption | staff write; members read (signed URLs, private bucket) |
| `contact_consents` | email or WhatsApp number, channel, wording version, time, source (request code / portal), opted in or out | written by functions and the portal; staff read |
| `notifications` | every message sent: event, recipient, channel, status | functions write; staff read |

- **Codes** (ADR 0004): one database sequence issues `FC-####` for requests, and the same code
  becomes the order's. If one request turns into two orders, the second gets a suffix
  (`FC-2418-B`). A code identifies an order but never grants access; access always comes from
  being a member of the client.
- **Client actions** go through checked database functions (`approve_decision`, `request_changes`,
  `request_photo`). Each checks membership and that a decision is open, writes the event, and
  triggers a notification. Clients never write to `orders`.
- **Approve** (ADR 0005) closes the decision and writes the event; **it does not move the stage**.
  The portal then shows "Approved, waiting on Full Circle" until staff move the order on. (The
  prototype's demo moves the stage itself; the demo stays as it is until the real portal replaces it.)
- **Staff roles** (proposed, please confirm): **owner** can do everything, including adding and
  removing staff and exporting or deleting someone's data when asked; **staff** answer requests,
  create orders, open decisions, upload photos and move stages. Staff sign in by email code.
- **Housekeeping:** a nightly job deletes requests and messages older than the retention period
  (with their files), and uploads that were never finished. Uploads are limited to images and PDFs
  of a set size, kept in private buckets and shown only through signed links.

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

1. **Brief an Egyptian data-protection lawyer this month** (questions to bring are listed below).
2. **Build phases 2–4 with test data only** until the lawyer has signed off. Phase 1 collects nothing.

**Privacy notice**: one short page, in plain language. It covers:
- who we are and how to reach us about privacy
- what we collect: request and contact details, uploads, portal account, order records
- why we collect it and on what basis
- who processes it: Supabase, Cloudflare, Resend, Meta (WhatsApp), Umami
- where it is stored: mainly Frankfurt, with some providers in the US and elsewhere
- how long we keep it
- your rights, and how to ask for a copy or deletion
- how to stop WhatsApp or email updates
- cookies and browser storage
- security and breaches
- date and version

PDPC guidance asks for the notice and consent texts in Arabic. That conflicts with "Arabic comes
later", so **please decide**: a single Arabic notice page at launch (recommended, and small), or
English only for now with the lawyer's view on the risk.

**On the forms** (no "I agree" checkbox; Turkish and Egyptian guidance both reject bundled
"I accept" wording):
- One line under the button: *"We use these details to reply to your request. They are stored
  mainly in Frankfurt, Germany; some of our providers in the US and elsewhere also process them.
  Privacy notice."*
- When a WhatsApp number is entered: a plain line *"We'll reply on WhatsApp"*, plus a separate
  unticked box for ongoing order updates on WhatsApp (Meta requires an opt-in that names Full
  Circle). The wording, time and number are stored.
- Uploads: a short hint not to upload photos of people or IDs.

These are additions to the approved design, so they need your OK. They are small and use existing
styles.

**Cookie banner: not needed** as long as analytics stays cookieless, fonts and three.js stay
self-hosted (they already are), and the only browser storage is the signed-in client's session.
The notice describes this instead.

**Questions for the lawyer:**
- the controller licence and the cross-border transfer licence, and how to file while the PDPC
  portal is closed
- whether transfers abroad need each person's consent on the forms, and the exact wording
- the data protection officer: who it can be (the law says "employee") and how to register them
- which legal basis applies to replies, the portal, and notifications
- whether the notice must be in Arabic at launch
- retention periods for order and approval records
- confirmation that transactional WhatsApp and email updates are not "e-marketing"
- whether serving brands in Saudi Arabia, the UAE, Turkey or China triggers local duties

The accounts are in Mazen's name, but Meta business verification and the PDPC filings have to be in
Full Circle's legal name and use its commercial register and tax card.

## 8. Phases

| # | Phase | Done when |
|---|---|---|
| 0 | ✅ Repo, Astro, tests, CI | Done |
| 1 | ✅ **Static site at parity** | Built and tested. **Next: Mazen connects Cloudflare (steps in `docs/deploy.md`) and signs off on the preview** |
| 2 | Requests: Supabase (live + staging), submit-request and submit-contact with Turnstile and uploads, staff emails, request receipts, consent records, privacy notice page, form lines | A test request lands in the database and in the staff inboxes (test data only until the lawyer signs off) |
| 3 | Client portal: sign-in by email and WhatsApp code, orders, decisions, photos, log, consent settings; RLS tests (one client can never see another's orders); week 1 starts by testing WhatsApp codes on Meta's test number | A test client signs in both ways and approves a sample |
| 4 | Admin for the 4 staff (roles), WhatsApp notifications, the reply-handling webhook | A test order goes through all 8 stages from a phone |
| 5 | Launch: domain live, SEO (titles, descriptions, OG images, sitemap, robots, structured data), Umami, security headers, Lighthouse, mesh building in a Web Worker, **no TBC left** | Live on the domain |
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
| Lawyer, and PDPC fees (reported as free under 100,000 records, not confirmed) | one-off |

## 10. What I need from you

**To finish phase 1:** connect the repo to Cloudflare (10 minutes, steps in `docs/deploy.md`) and
look at the preview.

**Before phase 2:**
1. Buy the domain.
2. Brief the lawyer (§7).
3. Create the Supabase account (two projects: live and staging, in Frankfurt) and a Resend account,
   and invite me.
4. Decide on the Arabic privacy page at launch (§7).
5. Approve the small form additions (§7).
6. Confirm the staff roles (§4), and send the names and emails of the 4 staff.

**Before phase 3–4:**
7. Set up Meta: a Meta Business portfolio and a WhatsApp app. You may already have a portfolio
   behind the Instagram account. Business verification uses Full Circle's documents.
8. Get a new SIM for the system WhatsApp number.
9. Approve the template wording for each WhatsApp message in §5.
