-- Clients, orders and the portal (phase 3): one client can never see another's orders; a client
-- can only approve, ask for changes and ask for a photo, through checked functions that write the
-- log; staff work through functions too; the approval log is never edited or deleted.
begin;
create extension if not exists pgtap with schema extensions;
select plan(106);

truncate public.requests, public.messages, public.contact_consents, public.notifications, public.clients cascade;
create temp table k (name text primary key, id bigint);
grant all on k to public;

-- people: an owner, a member of staff, a person at each of two brands, and a stranger
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@fc.test'),
  ('00000000-0000-0000-0000-00000000000b', 'staff@fc.test'),
  ('00000000-0000-0000-0000-00000000000c', 'ana@a.test'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@b.test'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@x.test');
insert into public.staff (user_id, name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Owner', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', 'Staff', 'staff');
insert into public.clients (brand) values ('Atelier A'), ('Studio B');
insert into public.client_members (client_id, user_id, name, email, whatsapp)
  select id, '00000000-0000-0000-0000-00000000000c', 'Ana', 'ana@a.test', '+201011435406' from public.clients where brand = 'Atelier A';
insert into public.client_members (client_id, user_id, name, email)
  select id, '00000000-0000-0000-0000-00000000000d', 'Dan', 'dan@b.test' from public.clients where brand = 'Studio B';
insert into public.requests (path, product, brand, contact, contact_channel, email, notice_version) values
  ('Scaling', 'Denim', 'Atelier A', 'ana@a.test', 'email', 'ana@a.test', 'v'),
  ('Starting', 'Tees', 'Studio B', 'dan@b.test', 'email', 'dan@b.test', 'v');
insert into k select 'cA', id from public.clients where brand = 'Atelier A';
insert into k select 'cB', id from public.clients where brand = 'Studio B';
insert into k select 'rA', id from public.requests where brand = 'Atelier A';
insert into k select 'rB', id from public.requests where brand = 'Studio B';

-- the publishable key: nothing
set local role anon;
select throws_ok('select * from public.orders', '42501', null, 'anon cannot read orders');
select throws_ok('select * from public.order_events', '42501', null, 'anon cannot read the log');
select throws_ok('select * from public.clients', '42501', null, 'anon cannot read clients');
select throws_ok('select public.approve_decision(1)', '42501', null, 'anon cannot approve');
select throws_ok('select public.move_stage(1, 2::smallint)', '42501', null, 'anon cannot move a stage');
reset role;

-- staff turn requests into orders ---------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select lives_ok($$select public.create_order((select id from k where name = 'cA'), 'Overshirt', 'Denim', (select id from k where name = 'rA'))$$,
  'staff turn a request into an order');
select lives_ok($$select public.create_order((select id from k where name = 'cA'), 'Overshirt in black', 'Denim', (select id from k where name = 'rA'))$$,
  'a second order from the same request');
select lives_ok($$select public.create_order((select id from k where name = 'cB'), 'Boxy tee', 'Tees', (select id from k where name = 'rB'))$$,
  'an order for the other brand');
select lives_ok($$select public.create_order((select id from k where name = 'cB'), 'Walk-in hoodie', 'Hoodies')$$,
  'an order with no request (it came on WhatsApp)');
insert into k select 'oA', id from public.orders where name = 'Overshirt';
insert into k select 'oA2', id from public.orders where name = 'Overshirt in black';
insert into k select 'oB', id from public.orders where name = 'Boxy tee';
insert into k select 'oB2', id from public.orders where name = 'Walk-in hoodie';
select is((select code from public.orders where id = (select id from k where name = 'oA')), (select code from public.requests where id = (select id from k where name = 'rA')),
  'the order keeps the request''s code');
select is((select code from public.orders where id = (select id from k where name = 'oA2')), (select code from public.requests where id = (select id from k where name = 'rA')) || '-B',
  'a second order from one request gets -B');
select ok((select code ~ '^FC-[0-9]{4,}$' and code not in (select code from public.requests) from public.orders where name = 'Walk-in hoodie'),
  'an order with no request takes a new code from the sequence');
select is((select stage::int from public.orders where name = 'Overshirt'), 4, 'a Scaling brand enters at stage 04');
select is((select stage::int from public.orders where name = 'Boxy tee'), 1, 'a Starting brand enters at stage 01');
select is((select status from public.requests where id = (select id from k where name = 'rA')), 'converted', 'the request is marked converted');
select throws_ok($$update public.orders set stage = 8$$, '42501', null, 'the stage cannot be set directly');
select lives_ok($$update public.orders set summary = 'Sample 03 / denim 12 oz / 300 pcs' where name = 'Overshirt'$$, 'staff can edit an order''s details');
select lives_ok($$insert into public.order_specs (order_id, key, value) select id, 'Fabric', 'Denim 12 oz, rinse' from public.orders where name in ('Overshirt', 'Boxy tee')$$, 'staff write specs');
select throws_ok($$insert into public.order_events (order_id, kind, side, actor_label) values (1, 'approved', 'staff', 'Me')$$, '42501', null, 'the log is written only by the functions');
select throws_ok($$insert into public.order_decisions (order_id, stage, title, opened_label) values (1, 1, 'x', 'Me')$$, '42501', null, 'decisions are opened only by the function');
reset role;

-- photos: uploaded to the bucket by staff, then recorded
insert into storage.objects (bucket_id, name) select 'stage-photos', id || '/front.jpg' from k where name = 'oA';
insert into storage.objects (bucket_id, name) select 'stage-photos', id || '/side.jpg' from k where name = 'oA';
insert into storage.objects (bucket_id, name) select 'stage-photos', id || '/back.jpg' from k where name = 'oB';

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select lives_ok($$select public.add_stage_photo((select id from k where name = 'oA'), 4::smallint, (select id || '/front.jpg' from k where name = 'oA'), 'Front')$$, 'staff record a stage photo');
insert into k select 'pA', id from public.stage_photos where object_path like '%/front.jpg';
select throws_ok($$select public.add_stage_photo((select id from k where name = 'oA'), 4::smallint, (select id || '/back.jpg' from k where name = 'oB'))$$, '22023', null, 'a photo from another order''s folder is refused');
select throws_ok($$select public.add_stage_photo((select id from k where name = 'oA'), 4::smallint, (select id || '/nothing.jpg' from k where name = 'oA'))$$, '22023', null, 'a photo that was never uploaded is refused');

-- the first decision
select throws_ok($$select public.open_decision((select id from k where name = 'oA'), 'Photos', null, array[(select id from k where name = 'pA') + 1000])$$, '22023', null, 'a decision cannot show photos that are not on the order');
select lives_ok($$select public.open_decision((select id from k where name = 'oA'), 'Approve the fit', 'Revised from your notes.', array[(select id from k where name = 'pA')])$$, 'staff open a decision');
insert into k select 'd1', id from public.order_decisions where title = 'Approve the fit';
select throws_ok($$select public.open_decision((select id from k where name = 'oA'), 'Another')$$, '55000', null, 'one decision is open at a time');
select lives_ok($$select public.open_decision((select id from k where name = 'oB'), 'Choose the fabric')$$, 'a decision on the other brand''s order');
insert into k select 'dB', id from public.order_decisions where title = 'Choose the fabric';
reset role;

-- who sees what ---------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select is((select count(*)::int from public.orders), 2, 'a client sees their own two orders');
select is((select count(*)::int from public.orders where name in ('Boxy tee', 'Walk-in hoodie')), 0, 'and none of another brand''s');
select is((select count(*)::int from public.clients), 1, 'a client sees only their own brand');
select is((select count(*)::int from public.client_members), 1, 'a person sees only themselves');
select is((select count(*)::int from public.order_decisions), 1, 'a client sees their decisions');
select is((select count(*)::int from public.order_specs), 1, 'and their specs');
select is((select count(*)::int from public.stage_photos), 1, 'and their photos');
select is((select count(*)::int from storage.objects where bucket_id = 'stage-photos'), 2, 'and can open only their own order''s files');
select ok((select count(*) >= 2 from public.order_events), 'and their log');
select is((select count(*)::int from public.order_events where order_id = (select id from k where name = 'oB')), 0, 'but not another brand''s');
select is((select count(*)::int from public.requests), 0, 'a client sees no requests');
select is((select count(*)::int from public.order_notifications), 0, 'a client sees no queued messages');
select lives_ok($$update public.orders set name = 'Hacked'$$, 'a client''s edit is not an error...');
select is((select count(*)::int from public.orders where name = 'Hacked'), 0, '...but changes nothing');
select throws_ok($$insert into public.order_events (order_id, kind, side, actor_label) values (1, 'approved', 'client', 'Me')$$, '42501', null, 'a client cannot write the log');
select throws_ok($$delete from public.order_events$$, '42501', null, 'a client cannot delete from the log');
select throws_ok($$update public.order_events set note = 'x'$$, '42501', null, 'a client cannot edit the log');
select throws_ok($$select public.create_order((select id from k where name = 'cA'), 'Mine', 'Denim')$$, '42501', null, 'a client cannot create an order');
select throws_ok($$select public.move_stage((select id from k where name = 'oA'), 5::smallint)$$, '42501', null, 'a client cannot move a stage');
select throws_ok($$select public.open_decision((select id from k where name = 'oA'), 'x')$$, '42501', null, 'a client cannot open a decision');
select throws_ok($$select public.approve_decision((select id from k where name = 'dB'))$$, 'P0002', null, 'a client cannot approve another brand''s decision');
select throws_ok($$select public.request_photo((select id from k where name = 'oB'))$$, 'P0002', null, 'a client cannot ask for a photo of another brand''s order');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}';
select is((select count(*)::int from public.orders), 2, 'the other brand sees their own orders');
select is((select count(*)::int from storage.objects where bucket_id = 'stage-photos'), 1, 'and only their own files');
select throws_ok($$select public.approve_decision((select id from k where name = 'd1'))$$, 'P0002', null, 'the other brand cannot approve this decision either');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated"}';
select is((select count(*)::int from public.orders), 0, 'a signed-in stranger sees no orders');
select is((select count(*)::int from public.order_events), 0, 'or log');
select is((select count(*)::int from storage.objects where bucket_id = 'stage-photos'), 0, 'or files');
select throws_ok($$select public.request_photo((select id from k where name = 'oA'))$$, 'P0002', null, 'a stranger cannot ask for a photo');
reset role;

-- a client acts ---------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select lives_ok($$select public.approve_decision((select id from k where name = 'd1'))$$, 'a client approves a decision');
select is((select status from public.order_decisions where id = (select id from k where name = 'd1')), 'approved', 'it is closed');
select is((select stage::int from public.orders where id = (select id from k where name = 'oA')), 4, 'approving does not move the stage');
select is((select title from public.order_events where kind = 'approved' and order_id = (select id from k where name = 'oA')), 'Approve the fit', 'the log keeps what was approved');
select is((select body from public.order_events where kind = 'approved' and order_id = (select id from k where name = 'oA')), 'Revised from your notes.', 'in its own words');
select is((select photo_ids from public.order_events where kind = 'approved' and order_id = (select id from k where name = 'oA')), array[(select id from k where name = 'pA')], 'and the photos shown with it');
select is((select actor_label from public.order_events where kind = 'approved' and order_id = (select id from k where name = 'oA')), 'Ana', 'and who approved');
select throws_ok($$select public.approve_decision((select id from k where name = 'd1'))$$, '55000', null, 'a decision is approved once');
select throws_ok($$select public.request_changes((select id from k where name = 'd1'))$$, '55000', null, 'and cannot then be sent back');
reset role;

-- staff move the order, the sample gate ---------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is((select count(*)::int from public.order_notifications where event = 'decision_approved' and audience = 'staff'), 2, 'every member of staff is alerted to an approval');
select is((select count(*)::int from public.order_notifications where event = 'decision_opened' and recipient = 'ana@a.test'), 1, 'the client is told a decision is waiting');
select lives_ok($$select public.move_stage((select id from k where name = 'oA'), 5::smallint, 'Sampling starts')$$, 'staff move an order on');
select throws_ok($$select public.move_stage((select id from k where name = 'oA'), 6::smallint)$$, '55000', null, 'bulk cannot start before a sample is approved');
select throws_ok($$select public.move_stage((select id from k where name = 'oA'), 5::smallint)$$, '22023', null, 'moving to the stage it is at is refused');
select throws_ok($$select public.move_stage((select id from k where name = 'oA'), 9::smallint)$$, '22023', null, 'and so is a stage that does not exist');
select lives_ok($$select public.open_decision((select id from k where name = 'oA'), 'Approve sample 03')$$, 'staff open the sample decision');
insert into k select 'd2', id from public.order_decisions where title = 'Approve sample 03';
select lives_ok($$select public.withdraw_decision((select id from k where name = 'dB'))$$, 'a decision can be withdrawn');
select is((select status from public.order_decisions where id = (select id from k where name = 'dB')), 'withdrawn', 'and is then closed');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select lives_ok($$select public.request_changes((select id from k where name = 'd2'), 'Chest is too tight')$$, 'a client asks for changes');
select is((select note from public.order_events where kind = 'changes_asked'), 'Chest is too tight', 'the log keeps their words');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select lives_ok($$select public.open_decision((select id from k where name = 'oA'), 'Approve sample 04')$$, 'staff open the revised sample');
insert into k select 'd3', id from public.order_decisions where title = 'Approve sample 04';
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select lives_ok($$select public.approve_decision((select id from k where name = 'd3'))$$, 'the client approves the sample');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select lives_ok($$select public.move_stage((select id from k where name = 'oA'), 6::smallint)$$, 'with the sample approved, bulk can start');
select lives_ok($$select public.move_stage((select id from k where name = 'oA'), 5::smallint, 'Back for a re-check')$$, 'an order can move back');
select is((select count(*)::int from public.order_notifications where event = 'stage_moved' and recipient = 'ana@a.test'), 3, 'the client is told of every move');
select throws_ok($$update public.order_notifications set status = 'sent'$$, '42501', null, 'staff do not edit the message queue');
reset role;

-- photo requests --------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select throws_ok($$select public.request_photo((select id from k where name = 'oA'), 7::smallint)$$, '22023', null, 'a photo of a stage not reached is refused');
select lives_ok($$select public.request_photo((select id from k where name = 'oA'), null, 'The stitching on the cuff')$$, 'a client asks for a photo of the stage');
select throws_ok($$select public.request_photo((select id from k where name = 'oA'))$$, '55000', null, 'one request per stage is open at a time');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select lives_ok($$select public.add_stage_photo((select id from k where name = 'oA'), 5::smallint, (select id || '/side.jpg' from k where name = 'oA'))$$, 'staff answer it with a photo');
select ok((select answered_at is not null from public.photo_requests where order_id = (select id from k where name = 'oA')), 'which closes the request');
reset role;

-- the log ---------------------------------------------------------------------------------------
select is((select string_agg(kind, ',' order by id) from public.order_events where order_id = (select id from k where name = 'oA')),
  'order_opened,photo_added,decision_opened,approved,stage_moved,decision_opened,changes_asked,decision_opened,approved,stage_moved,stage_moved,photo_asked,photo_added',
  'the log tells the order''s story in order');
select throws_ok($$update public.order_events set note = 'rewritten'$$, '55000', null, 'a log entry is never edited, even by the service role');
select throws_ok($$delete from public.order_events where kind = 'approved'$$, '55000', null, 'or deleted');

-- consents given in the portal ------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';
select lives_ok($$select public.set_updates_consent('whatsapp', true, 'Send me order updates on WhatsApp.', 'v1')$$, 'a person turns WhatsApp updates on');
select is((select count(*)::int from public.my_updates_consent() where channel = 'whatsapp' and opted_in), 1, 'and sees it on');
select lives_ok($$select public.set_updates_consent('whatsapp', false, 'Send me order updates on WhatsApp.', 'v1')$$, 'then off');
select is((select count(*)::int from public.my_updates_consent() where channel = 'whatsapp' and opted_in), 0, 'and the latest choice counts');
select throws_ok($$select public.set_updates_consent('whatsapp', true, '', 'v1')$$, '22023', null, 'the wording shown must be kept');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}';
select throws_ok($$select public.set_updates_consent('whatsapp', true, 'Send me order updates on WhatsApp.', 'v1')$$, '22023', null, 'there is no WhatsApp opt-in without a number');
reset role;
select is((select source || ' / ' || wording_version from public.contact_consents where address = '+201011435406' and source = 'portal' order by id limit 1), 'portal / v1', 'a portal consent is stored with its source and wording version');

-- removing a person keeps the log ---------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select lives_ok($$delete from public.client_members where name = 'Dan'$$, 'staff cannot remove a person...');
select is((select count(*)::int from public.client_members where name = 'Dan'), 1, '...only an owner can');
reset role;
select is((select count(*)::int from public.order_events where actor_label = 'Ana'), 4, 'Ana has acted four times');
delete from auth.users where id = '00000000-0000-0000-0000-00000000000c';
select is((select count(*)::int from public.order_events where actor_label = 'Ana' and actor_id is null), 4, 'once removed, the log still names her');
select is((select count(*)::int from public.client_members where name = 'Ana'), 0, 'and she can no longer sign in to the client');

-- retention: an order goes, its log goes with it
select lives_ok($$delete from public.orders where id = (select id from k where name = 'oA')$$, 'an order can be deleted at the end of its retention');
select is((select count(*)::int from public.order_events where order_id = (select id from k where name = 'oA')), 0, 'and takes its log with it');

-- an order deleted in between does not make the next order from the request reuse a code
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select lives_ok($$select public.create_order((select id from k where name = 'cA'), 'Overshirt again', 'Denim', (select id from k where name = 'rA'))$$,
  'another order from the request after one was deleted');
select is((select right(code, 2) from public.orders where name = 'Overshirt again'), '-C', 'it takes the next suffix not in use');
reset role;

select * from finish();
rollback;
