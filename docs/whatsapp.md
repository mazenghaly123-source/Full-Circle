# WhatsApp from the system number

Built in phase 4 and tested end to end against a stand-in for Meta (`tests/unit/backend.spec.ts`).
Nothing is sent until Meta is set up (production plan §10, items 7–9) and the secrets below are set;
until then every WhatsApp message is logged as skipped, as email was before Resend.

The system number is a new SIM used only through Meta's Cloud API. Staff keep talking to clients
from the main WhatsApp line (+20 101 143 5406); the system number only sends.

## What it sends

| When | To | Template | Needs an opt-in |
|---|---|---|---|
| Someone signs in to the portal with their number | them | `fc_sign_in_code` (authentication) | no: they asked for the code |
| A sample request with a WhatsApp number | the brand | `fc_request_received` | yes: the request form's box |
| Staff add a client's person with a number | them | `fc_portal_invite` | yes |
| A decision is opened | the client's people | `fc_decision_waiting` | yes |
| An order moves to its next stage | the client's people | `fc_stage_moved` | yes |
| Stage photos are added (grouped per person) | the client's people | `fc_new_photos` | yes |

An opt-in is the request form's unticked box or the portal's switch; the latest answer for a number
counts, so turning it off (or replying STOP) stops the messages. Email always goes too. Staff hear of
approvals, change requests and photo requests by email and on the admin's badges, not on WhatsApp
(Meta would likely class those as marketing).

## The templates to submit

Submit each in English (`en`) under the category shown. The words are in
`supabase/functions/_shared/whatsapp.ts` (`TEMPLATES`); change both together. The buttons open
`https://fullcircle-co.com/track`.

| Name | Category | Body | Button |
|---|---|---|---|
| `fc_sign_in_code` | Authentication | Meta's code wording, with the security line and "expires in 10 minutes" | Copy code |
| `fc_request_received` | Utility | Full Circle here. We have your sample request {{1}}. We will message you on this number to book the first call. Keep the code: it stays with your order. | — |
| `fc_portal_invite` | Utility | Hello {{1}}. {{2}} at Full Circle added you to {{3}}. You can now follow its orders, approve samples and see photos of each stage. Sign in with this number or your email. | Open the portal |
| `fc_decision_waiting` | Utility | Full Circle: your answer is needed on {{1}} ({{2}}): {{3}}. Open the order to approve it or ask for changes. | Open the order |
| `fc_stage_moved` | Utility | Full Circle: {{1}} ({{2}}) is now at {{3}}. You can follow each stage on your order page. | Follow it |
| `fc_new_photos` | Utility | Full Circle: {{1}} of {{2}} ({{3}}) on your order page. You can ask for a photo of any stage there too. | See them |

Examples Meta asks for: {{1}} order name "Overshirt", {{2}} code "FC-2418", {{3}} "Approve sample
05" / "06 Production"; for `fc_new_photos` {{1}} is "There are 2 new photos".

## Replies to the number

`whatsapp-webhook` saves each reply in the admin's inbox, marked WhatsApp, and emails staff (once an
hour per number at most). The first reply in a day is answered: "Thank you, we have your message.
This number sends order updates; the team will answer you from our main WhatsApp line, +20 101 143
5406." A reply of STOP (or إيقاف, الغاء) records the opt-out and says so. Meta's delivered and read
receipts show on the order's "Messages sent".

## Switching it on (after Meta's set-up)

1. In Meta's app: add the system number, make a permanent token for a system user with
   `whatsapp_business_messaging`, and submit the templates above.
2. Supabase, Edge Functions → Secrets: `WHATSAPP_TOKEN` (that token), `WHATSAPP_PHONE_ID` (the
   number's Phone number ID), `WHATSAPP_APP_SECRET` (the app's secret), `WHATSAPP_VERIFY_TOKEN` (any
   long random text) and `SEND_SMS_HOOK_SECRET` (step 4 makes it).
3. Meta's app → WhatsApp → Configuration: callback URL
   `https://<project>.supabase.co/functions/v1/whatsapp-webhook`, verify token as above; subscribe to
   `messages`.
4. Supabase, Authentication → Sign In / Providers → Phone: on, no SMS provider. Authentication →
   Hooks → Send SMS: HTTPS, `https://<project>.supabase.co/functions/v1/send-sms`; generate its secret
   and put the same value in `SEND_SMS_HOOK_SECRET`. Set the SMS code to 6 digits, 10 minutes.
5. Try it on staging with Meta's test number first: sign in to the portal with a number, then move a
   test order whose person opted in.

`WHATSAPP_API_URL` (default `https://graph.facebook.com/v23.0`) moves the Graph API version, or points
the functions at the tests' stand-in.
