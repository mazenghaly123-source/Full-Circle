-- Housekeeping: a year after they arrive, requests that did not lead to an order and messages are
-- deleted, with the log of what was sent about them; a request with an order stays, and so do the
-- consent records, and so does a sign-in account that a request, a client or staff still needs.
-- Nobody but the nightly job can run it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

truncate public.requests, public.messages, public.contact_consents, public.notifications, public.clients cascade;
insert into public.requests (code, path, product, brand, contact, contact_channel, email, notice_version, created_at) values
  ('FC-9201', 'Starting', 'Tees', 'Old, no order', 'a@a.test', 'email', 'a@a.test', 'v', now() - interval '13 months'),
  ('FC-9202', 'Scaling', 'Denim', 'Old, ordered', 'b@b.test', 'email', 'b@b.test', 'v', now() - interval '13 months'),
  ('FC-9203', 'Starting', 'Hoodies', 'Recent', 'c@c.test', 'email', 'c@c.test', 'v', now() - interval '11 months');
insert into public.clients (brand) values ('Ordered');
insert into public.orders (code, client_id, request_id, name, product, stage)
  select 'FC-9202', c.id, r.id, 'Jeans', 'Denim', 3 from public.clients c, public.requests r where r.code = 'FC-9202';
insert into public.contact_consents (channel, address, purpose, opted_in, wording, wording_version, source, request_id)
  select 'whatsapp', '+201011435406', 'order_updates', true, 'Also send me updates', 'v', 'request FC-9201', id from public.requests where code = 'FC-9201';
insert into public.notifications (event, audience, channel, recipient, status, request_id)
  select 'request_received', 'staff', 'email', 'staff@fc.test', 'sent', id from public.requests where code = 'FC-9201';
insert into public.messages (name, contact, contact_channel, email, text, notice_version, via, created_at) values
  ('Old', 'd@d.test', 'email', 'd@d.test', 'Hello', 'v', 'contact', now() - interval '13 months'),
  ('Recent', 'e@e.test', 'email', 'e@e.test', 'Hello', 'v', 'contact', now() - interval '1 month');
insert into public.messages (name, contact, contact_channel, whatsapp, text, notice_version, via, wamid, created_at) values
  ('Old reply', '+201011435406', 'whatsapp', '+201011435406', 'Thanks', 'whatsapp', 'whatsapp', 'wamid.R1', now() - interval '13 months');

-- accounts: a year old with nothing left, a year old with a request left (FC-9202), on staff, at a
-- client, and recent
insert into auth.users (id, email, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@a.test', now() - interval '13 months'),
  ('00000000-0000-0000-0000-0000000000a2', 'b@b.test', now() - interval '13 months'),
  ('00000000-0000-0000-0000-0000000000a3', 'staff@fc.test', now() - interval '2 years'),
  ('00000000-0000-0000-0000-0000000000a4', 'client@x.test', now() - interval '2 years'),
  ('00000000-0000-0000-0000-0000000000a5', 'new@x.test', now() - interval '1 month');
insert into public.staff (user_id, name, role) values ('00000000-0000-0000-0000-0000000000a3', 'Staff', 'staff');
insert into public.client_members (client_id, user_id, name, email)
  select id, '00000000-0000-0000-0000-0000000000a4', 'Client', 'client@x.test' from public.clients where brand = 'Ordered';

set local role authenticated;
select throws_ok($$select private.delete_expired()$$, '42501', null, 'a signed-in person cannot run the clean-up');
reset role;

select is((select row(deleted_requests, deleted_messages)::text from private.delete_expired()), '(1,2)', 'it reports what it deleted');
select results_eq($$select code from public.requests order by code$$, $$values ('FC-9202'), ('FC-9203')$$,
  'a request a year old without an order goes; one with an order, and a recent one, stay');
select results_eq($$select name from public.messages$$, $$values ('Recent')$$, 'messages a year old go, WhatsApp replies too');
select is((select count(*)::int from public.notifications), 0, 'what was sent about a deleted request goes with it');
select results_eq($$select source, request_id from public.contact_consents$$, $$values ('request FC-9201', null::bigint)$$,
  'the consent record stays, without its request');
select is((select count(*)::int from public.orders where code = 'FC-9202' and request_id is not null), 1, 'the order keeps its request');
select results_eq($$select email::text from auth.users where id::text like '00000000-0000-0000-0000-0000000000a_' order by email$$,
  $$values ('b@b.test'), ('client@x.test'), ('new@x.test'), ('staff@fc.test')$$,
  'an account a year old that nothing needs goes; one with a request, staff, a client or a recent one stays');
select is((select count(*)::int from public.client_members where email = 'client@x.test'), 1, 'a client''s person keeps their place');
select is((select schedule from cron.job where jobname = 'delete-expired'), '15 1 * * *', 'it runs every night');

select * from finish();
rollback;
