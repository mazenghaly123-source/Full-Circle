-- WhatsApp from the system number (phase 4, docs/production-plan.md §5, docs/whatsapp.md). The order
-- updates also go on WhatsApp to the people whose number opted in; the replies people send to the
-- number land in the admin's inbox with the contact messages; and what Meta reports about each
-- message sent (delivered, read) is kept with it.

-- A person's latest choice for order updates on a channel and address: an opt-out after an opt-in wins.
create function private.wants_updates(p_channel text, p_address text) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select c.opted_in from public.contact_consents c
  where c.purpose = 'order_updates' and c.channel = p_channel and c.address = p_address
  order by c.created_at desc, c.id desc limit 1), false) $$;
revoke all on function private.wants_updates(text, text) from public;

-- Every person of the order's client by email, and on WhatsApp those whose number opted in.
create or replace function private.queue_client_alert(p_order bigint, p_event text) returns void
language sql security definer set search_path = ''
as $$ insert into public.order_notifications (order_id, event, audience, channel, recipient)
  select o.id, p_event, 'client', 'email', m.email from public.orders o join public.client_members m on m.client_id = o.client_id where o.id = p_order
  union all
  select o.id, p_event, 'client', 'whatsapp', m.whatsapp from public.orders o join public.client_members m on m.client_id = o.client_id
  where o.id = p_order and m.whatsapp is not null and private.wants_updates('whatsapp', m.whatsapp) $$;

-- Replies to the system number land with the contact messages. `via` tells the two apart, and
-- Meta's id for the message keeps one delivered twice from landing twice.
alter table public.messages
  add column via text not null default 'contact' check (via in ('contact', 'whatsapp')),
  add column wamid text unique;
comment on table public.messages is 'Messages from the contact form and replies to the WhatsApp number. Inserted only by the submit-contact and whatsapp-webhook Edge Functions.';

-- When Meta says a WhatsApp message reached the phone, and when it was read.
alter table public.notifications add column delivered_at timestamptz, add column read_at timestamptz;
alter table public.order_notifications add column delivered_at timestamptz, add column read_at timestamptz;
create index notifications_provider on public.notifications (provider_id) where provider_id is not null;
create index order_notifications_provider on public.order_notifications (provider_id) where provider_id is not null;
