-- Who can reach what (run with `supabase test db`). The forms write through the Edge Functions as
-- the service role; with the publishable key nobody reads or writes anything; signed-in users who
-- are not staff see nothing; staff read everything and change only a status; owners manage staff.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- start from empty tables (the transaction is rolled back at the end, so a local stack keeps its rows)
truncate public.requests, public.messages, public.contact_consents, public.notifications cascade;

-- every table in public has row-level security on
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'row-level security is on for every table');

-- people: an owner, a member of staff, and a signed-in user who is neither
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@fc.test'),
  ('00000000-0000-0000-0000-00000000000b', 'staff@fc.test'),
  ('00000000-0000-0000-0000-00000000000c', 'client@brand.test');
insert into public.staff (user_id, name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Owner', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'Staff', 'staff');

-- what the functions write (as the service role, which this session is)
insert into public.requests (path, product, brand, contact, contact_channel, email, notice_version)
  values ('Starting', 'Tees', 'One', 'one@brand.test', 'email', 'one@brand.test', 'v');
insert into public.requests (path, product, brand, contact, contact_channel, whatsapp, notice_version)
  values ('Scaling', 'Denim', 'Two', '0101 143 5406', 'whatsapp', '+201011435406', 'v');
insert into public.messages (name, contact, contact_channel, email, text, notice_version)
  values ('Sara', 'sara@x.test', 'email', 'sara@x.test', 'Hello', 'v');
insert into public.contact_consents (channel, address, purpose, opted_in, wording, wording_version, source)
  values ('whatsapp', '+201011435406', 'order_updates', true, 'words', 'v', 'request FC-2502');
insert into public.notifications (event, audience, channel, recipient, status)
  values ('request_received', 'staff', 'email', 'owner@fc.test', 'sent');

-- codes come from one sequence, in order, starting above the demo codes
select ok((select bool_and(code ~ '^FC-[0-9]{4,}$' and substr(code, 4)::int >= 2501) from public.requests), 'codes read FC-#### and start at FC-2501');
select is((select max(substr(code, 4)::int) - min(substr(code, 4)::int) from public.requests), 1, 'codes are issued one after another');
select throws_ok($$insert into public.requests (code, path, product, brand, contact, contact_channel, notice_version) select code, 'Starting', 'Tees', 'X', '+201011435406', 'whatsapp', 'v' from public.requests limit 1$$,
  '23505', null, 'a code is never issued twice');
select throws_ok($$insert into public.requests (path, product, brand, contact, contact_channel, notice_version) values ('Starting', 'Tees', 'X', 'x@y.test', 'email', 'v')$$,
  '23514', null, 'an email contact must carry its email');

-- the publishable key (anon): nothing at all, but the keep-awake call, which reads nothing
set local role anon;
select is(public.alive(), true, 'anon can make the keep-awake call');
select throws_ok('select * from public.requests', '42501', null, 'anon cannot read requests');
select throws_ok('select * from public.messages', '42501', null, 'anon cannot read messages');
select throws_ok('select * from public.staff', '42501', null, 'anon cannot read staff');
select throws_ok($$insert into public.requests (path, product, brand, contact, contact_channel, email, notice_version) values ('Starting', 'Tees', 'X', 'x@y.test', 'email', 'x@y.test', 'v')$$,
  '42501', null, 'anon cannot insert a request');
select throws_ok($$insert into public.messages (name, contact, contact_channel, email, text, notice_version) values ('X', 'x@y.test', 'email', 'x@y.test', 'Hi', 'v')$$,
  '42501', null, 'anon cannot insert a message');
select throws_ok($$select nextval('public.code_seq')$$, '42501', null, 'anon cannot take a code');
reset role;

-- a signed-in user who is not staff (a future client): nothing either
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select is((select count(*)::int from public.requests), 0, 'a non-staff user sees no requests');
select is((select count(*)::int from public.messages), 0, 'a non-staff user sees no messages');
select is((select count(*)::int from public.contact_consents), 0, 'a non-staff user sees no consents');
select is((select count(*)::int from public.notifications), 0, 'a non-staff user sees no notifications');
select is((select count(*)::int from public.staff), 0, 'a non-staff user sees no staff');
select throws_ok($$insert into public.requests (path, product, brand, contact, contact_channel, email, notice_version) values ('Starting', 'Tees', 'X', 'x@y.test', 'email', 'x@y.test', 'v')$$,
  '42501', null, 'a non-staff user cannot insert a request');
select throws_ok($$insert into public.staff (user_id, name) values ('00000000-0000-0000-0000-00000000000c', 'Me')$$,
  '42501', null, 'a non-staff user cannot make themselves staff');
reset role;

-- staff: read everything, change a status, nothing else
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is((select count(*)::int from public.requests), 2, 'staff see the requests');
select is((select count(*)::int from public.messages), 1, 'staff see the messages');
select is((select count(*)::int from public.notifications), 1, 'staff see the notifications');
select lives_ok($$update public.requests set status = 'replied' where brand = 'One'$$, 'staff can move a request on');
select throws_ok($$update public.requests set brand = 'Changed' where brand = 'One'$$, '42501', null, 'staff cannot rewrite a request');
select throws_ok($$delete from public.requests where brand = 'One'$$, '42501', null, 'staff cannot delete a request');
select throws_ok($$update public.contact_consents set opted_in = false$$, '42501', null, 'nobody rewrites a consent record');
select throws_ok($$insert into public.staff (user_id, name) values ('00000000-0000-0000-0000-00000000000c', 'New')$$,
  '42501', null, 'staff cannot add staff');
reset role;

-- owners manage staff
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok($$insert into public.staff (user_id, name) values ('00000000-0000-0000-0000-00000000000c', 'New')$$, 'an owner can add staff');
select is((select count(*)::int from public.staff), 3, 'an owner sees all staff');
select lives_ok($$delete from public.staff where user_id = '00000000-0000-0000-0000-00000000000c'$$, 'an owner can remove staff');
reset role;

select * from finish();
rollback;
