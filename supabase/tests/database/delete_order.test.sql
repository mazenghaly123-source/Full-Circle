-- Deleting an order (20261030170000_delete_order): only an owner or a developer, only once it is
-- cancelled, and it goes with its log and everything on it; the request goes back to the inbox, and the
-- photos' paths come back for the admin to remove from storage, which only owners and developers may do.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

truncate public.requests, public.clients, public.staff cascade;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'owner@fc.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'staff@fc.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'dev@fc.test');
insert into public.staff (user_id, name, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'Owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000d2', 'Staff', 'staff'),
  ('00000000-0000-0000-0000-0000000000d3', 'Dev', 'developer');
insert into public.requests (path, product, brand, contact, contact_channel, email, notice_version)
  values ('Starting', 'Denim', 'Test', 't@brand.test', 'email', 't@brand.test', 'v');
insert into public.clients (brand) values ('Test');
insert into storage.buckets (id, name) values ('stage-photos', 'stage-photos') on conflict do nothing;

-- staff open the order from the request, ask for a decision and add a photo: a log to delete
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d2", "role": "authenticated"}';
select public.create_order((select id from public.clients), 'Jeans', 'Denim', (select id from public.requests));
reset role;
insert into storage.objects (bucket_id, name) select 'stage-photos', id || '/a.jpg' from public.orders;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d2", "role": "authenticated"}';
select public.add_stage_photo((select id from public.orders), 1::smallint, (select id || '/a.jpg' from public.orders), null);
select public.open_decision((select id from public.orders), 'Approve the brief');
select throws_ok($$select public.delete_order((select id from public.orders))$$, '42501', null, 'staff cannot delete an order');
select is((select count(*)::int from storage.objects where bucket_id = 'stage-photos' and name like '%/a.jpg'), 1, 'staff can see the photo');
delete from storage.objects where bucket_id = 'stage-photos';
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'stage-photos'), 1, 'and cannot remove it');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}';
select throws_ok($$select public.delete_order((select id from public.orders))$$, '55000', 'Cancel the order first', 'an owner cannot delete an order that is still active');
select throws_ok($$select public.delete_order(-1)$$, 'P0002', null, 'or one that does not exist');
update public.orders set status = 'cancelled';
select is(public.delete_order((select id from public.orders)), array[(select id || '/a.jpg' from public.orders)], 'a cancelled order is deleted, and its photos'' paths come back');
reset role;
select is((select count(*)::int from public.orders), 0, 'the order is gone');
select is((select count(*)::int from public.order_events), 0, 'with its log');
select is((select count(*)::int from public.order_decisions), 0, 'its decisions');
select is((select count(*)::int from public.stage_photos), 0, 'and its photos'' records');
select is((select status from public.requests), 'replied', 'the request goes back to the inbox');
select is((select count(*)::int from public.clients), 1, 'the client stays');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}';
delete from storage.objects where bucket_id = 'stage-photos';
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'stage-photos'), 0, 'an owner removes the photo''s file');

-- a developer can too
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d2", "role": "authenticated"}';
select public.create_order((select id from public.clients), 'Tee', 'Tees');
reset role;
update public.orders set status = 'cancelled';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d3", "role": "authenticated"}';
select is(public.delete_order((select id from public.orders)), '{}'::text[], 'a developer deletes a cancelled order');
reset role;
select is((select count(*)::int from public.orders), 0, 'and it is gone');

select * from finish();
rollback;
