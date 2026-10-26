-- Housekeeping: a year after they arrive, requests that did not lead to an order and messages are
-- deleted, with the log of what was sent about them; a request with an order stays, and so do the
-- consent records. Nobody but the nightly job can run it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

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
select is((select schedule from cron.job where jobname = 'delete-expired'), '15 1 * * *', 'it runs every night');

select * from finish();
rollback;
