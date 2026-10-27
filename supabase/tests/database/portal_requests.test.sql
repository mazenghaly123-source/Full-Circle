-- The portal lists a person's own requests (those sent with their account's email) until each
-- becomes an order they can see; nobody else's, and nothing for the publishable key.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

truncate public.requests, public.messages, public.contact_consents, public.notifications, public.clients cascade;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'Lina@Brand.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'omar@other.test');
insert into public.requests (code, path, product, brand, contact, contact_channel, email, whatsapp, status, notice_version, created_at) values
  ('FC-9301', 'Starting', 'Tees', 'Lina', 'lina@brand.test', 'email', 'lina@brand.test', null, 'new', 'v', now() - interval '3 days'),
  ('FC-9302', 'Scaling', 'Denim', 'Lina', 'lina@brand.test', 'email', 'lina@brand.test', null, 'replied', 'v', now() - interval '2 days'),
  ('FC-9303', 'Starting', 'Hoodies', 'Lina', 'lina@brand.test', 'email', 'lina@brand.test', null, 'closed', 'v', now() - interval '1 day'),
  ('FC-9304', 'Starting', 'Jackets', 'Lina', 'lina@brand.test', 'email', 'lina@brand.test', null, 'converted', 'v', now()),
  ('FC-9305', 'Starting', 'Tees', 'Omar', 'omar@other.test', 'email', 'omar@other.test', null, 'new', 'v', now());
insert into public.requests (code, path, product, brand, contact, contact_channel, whatsapp, notice_version) values
  ('FC-9306', 'Starting', 'Shorts', 'Lina', '+201011435406', 'whatsapp', '+201011435406', 'v');
insert into public.clients (brand) values ('Lina');
insert into public.orders (code, client_id, request_id, name, product, stage)
  select 'FC-9304', c.id, r.id, 'Jackets', 'Jackets', 1 from public.clients c, public.requests r where r.code = 'FC-9304';

set local role anon;
select throws_ok('select * from public.my_requests()', '42501', null, 'the publishable key cannot list requests');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';
select results_eq($$select code, status from public.my_requests()$$,
  $$values ('FC-9304', 'converted'), ('FC-9302', 'replied'), ('FC-9301', 'new')$$,
  'a person sees the requests sent with their email, newest first, closed ones left out');
select is((select count(*)::int from public.requests), 0, 'and still reads no row of the requests table itself');
reset role;

-- once they are on the client, the order shows instead of its request
insert into public.client_members (client_id, user_id, name, email)
  select id, '00000000-0000-0000-0000-0000000000b1', 'Lina', 'lina@brand.test' from public.clients where brand = 'Lina';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';
select results_eq($$select code from public.my_requests()$$, $$values ('FC-9302'), ('FC-9301')$$,
  'a request whose order they can see leaves the list');
select is((select count(*)::int from public.orders where code = 'FC-9304'), 1, 'and the order is there');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select results_eq($$select code from public.my_requests()$$, $$values ('FC-9305')$$, 'another person sees only their own');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000ff", "role": "authenticated"}';
select is((select count(*)::int from public.my_requests()), 0, 'a session with no account sees none');
reset role;

select * from finish();
rollback;
