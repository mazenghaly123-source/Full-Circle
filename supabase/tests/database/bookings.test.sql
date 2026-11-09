-- Calls booked on the site: only the book-call function writes them (as the service role); staff read
-- them and move their status on; nobody else sees them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

truncate public.bookings;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'staff@fc.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'someone@x.test')
  on conflict do nothing;
insert into public.staff (user_id, name, role) values ('00000000-0000-0000-0000-0000000000b1', 'Staff', 'staff') on conflict do nothing;

insert into public.bookings (kind, starts_at, ends_at, name, phone, whatsapp, email, brand, notice_version)
  values ('online', now() + interval '1 day', now() + interval '1 day 30 minutes', 'Sara', '0101 143 5406', '+201011435406', 'sara@x.test', 'Kind', 'v');

select throws_ok($$insert into public.bookings (kind, starts_at, ends_at, name, phone, email, brand, notice_version) values ('lunch', now(), now() + interval '30 minutes', 'X', '0101 143 5406', 'x@y.test', 'X', 'v')$$,
  '23514', null, 'a booking is a visit, a phone call or an online meeting');
select throws_ok($$insert into public.bookings (kind, starts_at, ends_at, name, phone, email, brand, notice_version) values ('visit', now(), now(), 'X', '0101 143 5406', 'x@y.test', 'X', 'v')$$,
  '23514', null, 'a meeting ends after it starts');
select throws_ok($$insert into public.bookings (kind, starts_at, ends_at, name, phone, email, brand, notice_version) values ('visit', now(), now() + interval '30 minutes', 'X', '0101 143 5406', 'X@Y.test', 'X', 'v')$$,
  '23514', null, 'the email is kept in lower case');

select throws_ok($$insert into public.bookings (kind, starts_at, ends_at, name, phone, email, brand, notice_version) select 'visit', starts_at, ends_at, 'X', '0101 143 5406', 'x@y.test', 'X', 'v' from public.bookings$$,
  '23505', null, 'one time takes one booking');
update public.bookings set status = 'closed';
select lives_ok($$insert into public.bookings (kind, starts_at, ends_at, name, phone, email, brand, notice_version) select 'visit', starts_at, ends_at, 'Y', '0101 143 5406', 'y@y.test', 'Y', 'v' from public.bookings$$,
  'a closed booking frees its time');
delete from public.bookings where name = 'Y';
update public.bookings set status = 'new';

set local role anon;
select throws_ok('select * from public.bookings', '42501', null, 'anon cannot read bookings');
select throws_ok($$insert into public.bookings (kind, starts_at, ends_at, name, phone, email, brand, notice_version) values ('visit', now(), now() + interval '30 minutes', 'X', '0101 143 5406', 'x@y.test', 'X', 'v')$$,
  '42501', null, 'anon cannot book without the function');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is((select count(*)::int from public.bookings), 0, 'a signed-in person who is not staff sees no bookings');
select throws_ok($$insert into public.bookings (kind, starts_at, ends_at, name, phone, email, brand, notice_version) values ('visit', now(), now() + interval '30 minutes', 'X', '0101 143 5406', 'x@y.test', 'X', 'v')$$,
  '42501', null, 'nor books one');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';
select is((select count(*)::int from public.bookings), 1, 'staff see the bookings');
select lives_ok($$update public.bookings set status = 'replied'$$, 'staff can move a booking on');
select is((select status from public.bookings), 'replied', 'and it moved');
select throws_ok($$update public.bookings set starts_at = now()$$, '42501', null, 'staff cannot rewrite a booking');
select throws_ok($$delete from public.bookings$$, '42501', null, 'staff cannot delete a booking');
reset role;

select * from finish();
rollback;
