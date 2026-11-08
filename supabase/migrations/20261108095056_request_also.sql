-- Question 05 and the two questions after sending (Mazen, 8 Nov 2026). Adds only: no row changes.
-- also: what else the brand wants besides the making (Branding, Product photos, Ad creatives).
-- heard, sells: the answers on the screen after sending, filled in later by submit-request, which
-- checks the request's follow_up key. Staff read all four; my_requests returns none of them.
alter table public.requests
  add column also text[] not null default '{}',
  add column heard text,
  add column sells text,
  add column follow_up uuid not null default gen_random_uuid();
comment on column public.requests.also is 'Question 05: what else the brand wants (Branding, Product photos, Ad creatives).';
comment on column public.requests.heard is 'Answered after sending: how the brand heard of Full Circle.';
comment on column public.requests.sells is 'Answered after sending: where the brand sells.';
comment on column public.requests.follow_up is 'The key the sender is given with the code, to answer the questions after sending.';
