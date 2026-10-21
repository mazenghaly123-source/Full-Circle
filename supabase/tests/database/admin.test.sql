-- What the admin's Edge Functions use (phase 4): finding an account by email and claiming queued
-- order messages. Only the service role may call either; each queued message is claimed once.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

truncate public.clients cascade;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'Laila@Brand.test');
insert into public.clients (brand) values ('Brand');
insert into public.orders (code, client_id, name, product, stage) select 'FC-9001', id, 'Tee', 'Tees', 1 from public.clients;
insert into public.order_notifications (order_id, event, audience, channel, recipient)
  select id, 'stage_moved', 'client', 'email', 'r' || g || '@brand.test' from public.orders, generate_series(1, 3) g;

set local role anon;
select throws_ok($$select public.user_id_by_email('laila@brand.test')$$, '42501', null, 'the publishable key cannot look up accounts');
select throws_ok($$select * from public.claim_order_notifications()$$, '42501', null, 'or claim messages');
reset role;
set local role authenticated;
select throws_ok($$select public.user_id_by_email('laila@brand.test')$$, '42501', null, 'nor can a signed-in person look up accounts');
select throws_ok($$select * from public.claim_order_notifications()$$, '42501', null, 'or claim messages');
reset role;

set local role service_role;
select is(public.user_id_by_email(' LAILA@brand.test '), '00000000-0000-0000-0000-0000000000a1'::uuid, 'the service role finds an account by email, whatever its case');
select is(public.user_id_by_email('nobody@brand.test'), null, 'and gets nothing for an unknown email');
select is((select count(*)::int from public.claim_order_notifications(2)), 2, 'a call claims up to its limit');
select is((select count(*)::int from public.claim_order_notifications(2)), 1, 'the next call gets only what is left');
select is((select count(*)::int from public.claim_order_notifications(2)), 0, 'and nothing is claimed twice');
reset role;
update public.order_notifications set claimed_at = now() - interval '11 minutes' where recipient = 'r1@brand.test';
set local role service_role;
select is((select recipient from public.claim_order_notifications(5)), 'r1@brand.test', 'a claim from a call that died is taken again after ten minutes');
reset role;
update public.order_notifications set status = 'sent' where recipient = 'r2@brand.test';
update public.order_notifications set claimed_at = now() - interval '1 hour';
set local role service_role;
select is((select count(*)::int from public.claim_order_notifications(5) where status <> 'queued'), 0, 'a message already sent is never claimed again');
reset role;

select * from finish();
rollback;
