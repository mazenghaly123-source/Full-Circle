-- WhatsApp (phase 4): order updates go on WhatsApp only to the numbers that opted in, and stop when
-- a number opts out; replies to the system number wait for staff with the contact messages, once
-- each; what Meta reports about a message is for staff to read, not to change.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

truncate public.messages, public.contact_consents, public.clients cascade;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'staff@fc.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'ana@a.test'),
  ('00000000-0000-0000-0000-0000000000f3', 'bo@a.test'),
  ('00000000-0000-0000-0000-0000000000f4', 'cy@a.test');
insert into public.staff (user_id, name, role) values ('00000000-0000-0000-0000-0000000000f1', 'Staff', 'staff');
insert into public.clients (brand) values ('Atelier A');
-- Ana opted in on the request form; Bo opted in, then out; Cy has a number and never answered
insert into public.client_members (client_id, user_id, name, email, whatsapp)
  select id, u, n, e, w from public.clients, (values
    ('00000000-0000-0000-0000-0000000000f2'::uuid, 'Ana', 'ana@a.test', '+201011435406'),
    ('00000000-0000-0000-0000-0000000000f3'::uuid, 'Bo', 'bo@a.test', '+966501234567'),
    ('00000000-0000-0000-0000-0000000000f4'::uuid, 'Cy', 'cy@a.test', '+905321234567')) p (u, n, e, w);
insert into public.contact_consents (channel, address, purpose, opted_in, wording, wording_version, source, created_at) values
  ('whatsapp', '+201011435406', 'order_updates', true, 'Also send me updates', 'v', 'request FC-1', now() - interval '2 days'),
  ('whatsapp', '+966501234567', 'order_updates', true, 'Also send me updates', 'v', 'request FC-2', now() - interval '2 days'),
  ('whatsapp', '+966501234567', 'order_updates', false, 'Updates on WhatsApp', 'v', 'portal', now() - interval '1 day');
insert into public.orders (code, client_id, name, product, stage) select 'FC-9101', id, 'Tee', 'Tees', 2 from public.clients;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';
select lives_ok($$select public.move_stage((select id from public.orders where code = 'FC-9101'), 3::smallint)$$, 'staff move the order on');
reset role;
select results_eq($$select channel, recipient from public.order_notifications where event = 'stage_moved' order by channel, recipient$$,
  $$values ('email', 'ana@a.test'), ('email', 'bo@a.test'), ('email', 'cy@a.test'), ('whatsapp', '+201011435406')$$,
  'everyone hears by email, and on WhatsApp only the number whose latest answer is yes');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f2", "role": "authenticated"}';
select lives_ok($$select public.set_updates_consent('whatsapp', false, 'Updates on WhatsApp', 'v')$$, 'Ana turns WhatsApp updates off in the portal');
select throws_ok($$select private.wants_updates('whatsapp', '+201011435406')$$, '42501', null, 'a signed-in person cannot ask about anyone''s choices');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';
select lives_ok($$select public.move_stage((select id from public.orders where code = 'FC-9101'), 4::smallint)$$, 'staff move it on again');
reset role;
select is((select count(*)::int from public.order_notifications where event = 'stage_moved' and channel = 'whatsapp'), 1,
  'after her opt-out nothing more goes to her number');

-- replies to the number --------------------------------------------------------------------------------
insert into public.messages (name, contact, contact_channel, email, text, notice_version)
  values ('Sara', 'sara@b.test', 'email', 'sara@b.test', 'Hello', 'v');
select is((select via from public.messages where name = 'Sara'), 'contact', 'a contact form message is marked as one');
insert into public.messages (name, contact, contact_channel, whatsapp, text, notice_version, via, wamid)
  values ('Ana', '+201011435406', 'whatsapp', '+201011435406', 'Thanks, looks good', 'whatsapp', 'whatsapp', 'wamid.A1');
select throws_ok($$insert into public.messages (name, contact, contact_channel, whatsapp, text, notice_version, via, wamid)
  values ('Ana', '+201011435406', 'whatsapp', '+201011435406', 'Thanks, looks good', 'whatsapp', 'whatsapp', 'wamid.A1')$$,
  '23505', null, 'a reply Meta delivers twice lands once');
select throws_ok($$insert into public.messages (name, contact, contact_channel, whatsapp, text, notice_version, via)
  values ('X', '+201011435406', 'whatsapp', '+201011435406', 'Hi', 'v', 'sms')$$, '23514', null, 'a message comes from the form or WhatsApp');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';
select results_eq($$select name, via from public.messages order by id$$, $$values ('Sara', 'contact'), ('Ana', 'whatsapp')$$,
  'staff see the replies in the inbox with the messages');
select lives_ok($$select delivered_at, read_at from public.order_notifications$$, 'staff read when a message reached the phone and was read');
select throws_ok($$update public.order_notifications set read_at = now()$$, '42501', null, 'but cannot change it');
reset role;
set local role anon;
select throws_ok($$select * from public.messages$$, '42501', null, 'the publishable key reads no reply');
reset role;

select * from finish();
rollback;
