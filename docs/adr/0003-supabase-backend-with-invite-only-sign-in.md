# Supabase backend; invite-only sign-in by email or WhatsApp code

Requests, client accounts, orders, the approval log and stage photos live in Supabase (Postgres
with row-level security on every table, EU region, Frankfurt). Clients are invited by staff; nobody
can sign themselves up. Sign-in is a 6-digit code by email or by WhatsApp, as the prototype's
two-step screen shows.

## Considered options

- **WhatsApp codes through Twilio** (Supabase's built-in WhatsApp option): rejected. It adds a fee
  on every message on top of Meta's and still needs our own Meta-approved sender. Instead a Supabase
  "Send SMS" auth hook calls Meta's WhatsApp Cloud API directly.

## Consequences

- Every client user has an email, because email is the fallback when WhatsApp cannot deliver.
- Codes and notifications come from a dedicated WhatsApp number; +20 101 143 5406 stays in the
  WhatsApp Business app for conversations.
- Storing personal data in Frankfurt is a transfer abroad under Egypt's data-protection law, which
  needs the licences described in the production plan.

## Amended (27 Oct 2026)

Sign-ups stay off, but a sample request sent with an email now opens a sign-in account for that
email (`submit-request`), so the brand can follow the request on the tracking page before it becomes
an order (`public.my_requests`, migration `20261027071333`). Mazen asked for it after comparing the
site with Factory 21's open sign-up: no account wall before a request, but a place to follow it
from day one. Accounts opened this way go with their requests after a year (`delete_expired`).
WhatsApp-only requests get no account until codes on WhatsApp are switched on.
