-- Phase 3: clients, orders and the portal (docs/production-plan.md §4).
--
-- A client's people read their own client's orders, decisions, photos and log through row-level
-- security. They change nothing directly: the three things a client can do (approve, ask for
-- changes, ask for a photo) go through checked functions that write the log in the same step.
-- Staff do their work through functions too (create an order, move a stage, open a decision, add a
-- photo), so the log cannot be skipped. The approval log is append-only (docs/adr/0005): a
-- trigger refuses any edit, and a delete unless the order itself is gone.

-- Clients and their people --------------------------------------------------------------------------

create table public.clients (
  id bigint generated always as identity primary key,
  brand text not null check (char_length(brand) between 1 and 200),
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now()
);
comment on table public.clients is 'A brand with at least one order. Staff create it when a request is converted.';

create table public.client_members (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  -- the sign-in email (always: it is the fallback when WhatsApp cannot deliver) and the number, if any
  email text not null check (email = lower(email)),
  whatsapp text check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);
comment on table public.client_members is 'The people who sign in for a client. Invite-only: staff add each one.';
create index client_members_user on public.client_members (user_id);

-- Orders ---------------------------------------------------------------------------------------------

create table public.orders (
  id bigint generated always as identity primary key,
  -- FC-#### (the request's code, docs/adr/0004), FC-####-B for a second order from one request
  code text not null unique,
  client_id bigint not null references public.clients (id) on delete cascade,
  request_id bigint references public.requests (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  product text not null check (char_length(product) between 1 and 200),
  -- the line under the name on the portal, e.g. "Sample 03 / denim 12 oz / 300 pcs"
  summary text check (char_length(summary) <= 200),
  fabric text check (char_length(fabric) <= 200),
  qty integer check (qty > 0),
  -- 1 to 8, as the stages are numbered on the site; only move_stage changes it
  stage smallint not null check (stage between 1 and 8),
  status text not null default 'active' check (status in ('active', 'paused', 'delivered', 'cancelled')),
  due_on date,
  created_at timestamptz not null default now()
);
comment on table public.orders is 'A product being developed and made for a client, moving through eight stages.';
create index orders_client on public.orders (client_id);
create index orders_request on public.orders (request_id);

-- Helpers the policies call (private schema: not reachable through the API) -----------------------

create function private.is_member(p_client bigint) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.client_members where client_id = p_client and user_id = (select auth.uid())) $$;

create function private.can_see_order(p_order bigint) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.orders o join public.client_members m on m.client_id = o.client_id
  where o.id = p_order and m.user_id = (select auth.uid())) $$;

create table public.order_specs (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  position smallint not null default 0,
  key text not null check (char_length(key) between 1 and 80),
  value text not null check (char_length(value) between 1 and 300),
  unique (order_id, key)
);
comment on table public.order_specs is 'The spec rows the portal shows (fabric, sizes, measurements...).';

-- Decisions: what staff ask a client to approve at the end of a stage ---------------------------

create table public.order_decisions (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  stage smallint not null check (stage between 1 and 8),
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 2000),
  -- the stage photos shown with it
  photo_ids bigint[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'approved', 'changes_asked', 'withdrawn')),
  note text check (char_length(note) <= 2000),
  opened_by uuid references auth.users (id) on delete set null,
  opened_label text not null,
  opened_at timestamptz not null default now(),
  closed_by uuid references auth.users (id) on delete set null,
  closed_label text,
  closed_at timestamptz,
  check ((status = 'open') = (closed_at is null))
);
comment on table public.order_decisions is 'Decisions staff ask a client for. One is open per order at a time; the sample gate is the one at stage 5.';
create unique index order_decisions_one_open on public.order_decisions (order_id) where status = 'open';
create index order_decisions_order on public.order_decisions (order_id, opened_at desc);

-- Stage photos and the photos clients ask for ---------------------------------------------------------

create table public.stage_photos (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  stage smallint not null check (stage between 1 and 8),
  -- the object's path in the private stage-photos bucket: <order id>/<file>
  object_path text not null unique,
  caption text check (char_length(caption) <= 200),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.stage_photos is 'Photos of an order at a stage, uploaded by staff, shown through signed links.';
create index stage_photos_order on public.stage_photos (order_id, stage, created_at desc);

create table public.photo_requests (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  stage smallint not null check (stage between 1 and 8),
  note text check (char_length(note) <= 500),
  asked_by uuid references auth.users (id) on delete set null,
  asked_label text not null,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
comment on table public.photo_requests is 'A client asking for a photo of a stage. Answered when staff add a photo for that stage.';
create unique index photo_requests_one_open on public.photo_requests (order_id, stage) where answered_at is null;

-- The approval log: append-only ------------------------------------------------------------------------

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  kind text not null check (kind in ('order_opened', 'decision_opened', 'decision_withdrawn', 'approved',
    'changes_asked', 'photo_asked', 'photo_added', 'stage_moved')),
  side text not null check (side in ('client', 'staff')),
  -- who did it, and their name as it was at the time (the log keeps it when the person is removed)
  actor_id uuid references auth.users (id) on delete set null,
  actor_label text not null,
  stage smallint check (stage between 1 and 8),
  from_stage smallint check (from_stage between 1 and 8),
  to_stage smallint check (to_stage between 1 and 8),
  decision_id bigint references public.order_decisions (id) on delete set null,
  -- a copy of what was decided: the decision's words and the photos shown with it
  title text,
  body text,
  photo_ids bigint[] not null default '{}',
  -- the client's words with a change request, or the staff note with a move (the client sees both)
  note text,
  created_at timestamptz not null default now()
);
comment on table public.order_events is 'The approval log. Entries are never edited or deleted (a trigger refuses it); they go only with their order.';
create index order_events_order on public.order_events (order_id, created_at desc);

create function private.keep_log() returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- the one way out: the order is gone (retention), and its entries go with it
  if tg_op = 'DELETE' and not exists (select 1 from public.orders where id = old.order_id) then
    return old;
  end if;
  -- the one change allowed: a person or decision that is removed is cleared from the entry
  -- (the foreign keys do that); the words and the name as it was stay
  if tg_op = 'UPDATE'
    and (to_jsonb(new) - 'actor_id' - 'decision_id') = (to_jsonb(old) - 'actor_id' - 'decision_id')
    and (new.actor_id is null or new.actor_id = old.actor_id)
    and (new.decision_id is null or new.decision_id = old.decision_id) then
    return new;
  end if;
  raise exception 'The approval log is never edited or deleted' using errcode = '55000';
end $$;
create trigger order_events_keep before update or delete on public.order_events
  for each row execute function private.keep_log();

-- Messages about orders (the queue the notify function sends from) -------------------------------------

create table public.order_notifications (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  event text not null check (event in ('decision_approved', 'changes_asked', 'photo_asked',
    'decision_opened', 'photo_added', 'stage_moved')),
  audience text not null check (audience in ('staff', 'client')),
  channel text not null check (channel in ('email', 'whatsapp')),
  recipient text not null,
  -- queued until the notify function sends it; skipped: the channel is not set up yet
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_id text,
  detail text,
  created_at timestamptz not null default now()
);
comment on table public.order_notifications is 'Every email or WhatsApp message about an order: queued by the functions, sent by notify.';
create index order_notifications_queue on public.order_notifications (created_at) where status = 'queued';
create index order_notifications_order on public.order_notifications (order_id);

-- Access ------------------------------------------------------------------------------------------------

revoke all on public.clients, public.client_members, public.orders, public.order_specs, public.order_decisions,
  public.stage_photos, public.photo_requests, public.order_events, public.order_notifications from anon, authenticated;

alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.orders enable row level security;
alter table public.order_specs enable row level security;
alter table public.order_decisions enable row level security;
alter table public.stage_photos enable row level security;
alter table public.photo_requests enable row level security;
alter table public.order_events enable row level security;
alter table public.order_notifications enable row level security;

-- clients: staff read and edit; a member reads their own brand
grant select, insert, update on public.clients to authenticated;
create policy "staff read clients" on public.clients for select to authenticated using ((select private.is_staff()));
create policy "members read their client" on public.clients for select to authenticated using ((select private.is_member(id)));
create policy "staff add clients" on public.clients for insert to authenticated with check ((select private.is_staff()));
create policy "staff edit clients" on public.clients for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

-- people of a client: staff add and edit; only owners remove; a person reads their own rows
grant select, insert, update, delete on public.client_members to authenticated;
create policy "staff read members" on public.client_members for select to authenticated using ((select private.is_staff()));
create policy "people read themselves" on public.client_members for select to authenticated using (user_id = (select auth.uid()));
create policy "staff add members" on public.client_members for insert to authenticated with check ((select private.is_staff()));
create policy "staff edit members" on public.client_members for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "owners remove members" on public.client_members for delete to authenticated using ((select private.is_owner()));

-- orders: staff read and edit the details (the stage only moves through move_stage); members read their client's
grant select, update (name, product, summary, fabric, qty, status, due_on) on public.orders to authenticated;
create policy "staff read orders" on public.orders for select to authenticated using ((select private.is_staff()));
create policy "members read orders" on public.orders for select to authenticated using ((select private.is_member(client_id)));
create policy "staff edit orders" on public.orders for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

grant select, insert, update, delete on public.order_specs to authenticated;
create policy "staff read specs" on public.order_specs for select to authenticated using ((select private.is_staff()));
create policy "members read specs" on public.order_specs for select to authenticated using ((select private.can_see_order(order_id)));
create policy "staff add specs" on public.order_specs for insert to authenticated with check ((select private.is_staff()));
create policy "staff edit specs" on public.order_specs for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "staff remove specs" on public.order_specs for delete to authenticated using ((select private.is_staff()));

-- decisions, photos, requests, the log: read only; writes go through the functions below
grant select on public.order_decisions, public.stage_photos, public.photo_requests, public.order_events to authenticated;
create policy "staff read decisions" on public.order_decisions for select to authenticated using ((select private.is_staff()));
create policy "members read decisions" on public.order_decisions for select to authenticated using ((select private.can_see_order(order_id)));
create policy "staff read photos" on public.stage_photos for select to authenticated using ((select private.is_staff()));
create policy "members read photos" on public.stage_photos for select to authenticated using ((select private.can_see_order(order_id)));
create policy "staff read photo requests" on public.photo_requests for select to authenticated using ((select private.is_staff()));
create policy "members read photo requests" on public.photo_requests for select to authenticated using ((select private.can_see_order(order_id)));
create policy "staff read the log" on public.order_events for select to authenticated using ((select private.is_staff()));
create policy "members read the log" on public.order_events for select to authenticated using ((select private.can_see_order(order_id)));

-- the message queue: staff read; the functions write
grant select on public.order_notifications to authenticated;
create policy "staff read order notifications" on public.order_notifications for select to authenticated using ((select private.is_staff()));

-- Stage photos: a private bucket, images up to 10 MB, opened through signed links ---------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stage-photos', 'stage-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

create function private.can_see_photo_path(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$ select (storage.foldername(p_name))[1] ~ '^[0-9]+$' and private.can_see_order(((storage.foldername(p_name))[1])::bigint) $$;

create policy "staff add stage photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'stage-photos' and (select private.is_staff()));
create policy "staff read stage photos" on storage.objects for select to authenticated
  using (bucket_id = 'stage-photos' and (select private.is_staff()));
create policy "members read stage photos" on storage.objects for select to authenticated
  using (bucket_id = 'stage-photos' and (select private.can_see_photo_path(name)));

-- Functions: what a client does -------------------------------------------------------------------------

-- Who is calling, as a name for the log: a member of this client, or staff.
create function private.actor_name(p_client bigint) returns text
language sql stable security definer set search_path = ''
as $$ select coalesce(
  (select name from public.client_members where client_id = p_client and user_id = (select auth.uid())),
  (select name from public.staff where user_id = (select auth.uid())),
  'Unknown') $$;

-- Queue an alert for every member of staff (email; the admin badge reads the log).
create function private.queue_staff_alert(p_order bigint, p_event text) returns void
language sql security definer set search_path = ''
as $$ insert into public.order_notifications (order_id, event, audience, channel, recipient)
  select p_order, p_event, 'staff', 'email', u.email from public.staff s join auth.users u on u.id = s.user_id where u.email is not null $$;

-- Queue a message for every person of the order's client (email; WhatsApp joins in phase 4, for
-- those who opted in).
create function private.queue_client_alert(p_order bigint, p_event text) returns void
language sql security definer set search_path = ''
as $$ insert into public.order_notifications (order_id, event, audience, channel, recipient)
  select o.id, p_event, 'client', 'email', m.email from public.orders o join public.client_members m on m.client_id = o.client_id where o.id = p_order $$;

revoke all on function private.is_member(bigint), private.can_see_order(bigint), private.can_see_photo_path(text),
  private.actor_name(bigint), private.queue_staff_alert(bigint, text), private.queue_client_alert(bigint, text) from public;
grant execute on function private.is_member(bigint), private.can_see_order(bigint), private.can_see_photo_path(text) to authenticated;

-- Approve. The decision closes and the log keeps a copy of what was approved. The stage does not
-- move: staff move it (docs/adr/0005).
create function public.approve_decision(p_decision bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare d public.order_decisions; o public.orders; who text;
begin
  select * into d from public.order_decisions where id = p_decision for update;
  select * into o from public.orders where id = d.order_id;
  -- the same answer whether it does not exist or is not theirs
  if d.id is null or o.id is null or not private.is_member(o.client_id) then
    raise exception 'No such decision' using errcode = 'P0002';
  end if;
  if d.status <> 'open' then raise exception 'This decision is already closed' using errcode = '55000'; end if;
  who := private.actor_name(o.client_id);
  update public.order_decisions set status = 'approved', closed_at = now(), closed_by = (select auth.uid()), closed_label = who where id = d.id;
  insert into public.order_events (order_id, kind, side, actor_id, actor_label, stage, decision_id, title, body, photo_ids)
    values (o.id, 'approved', 'client', (select auth.uid()), who, d.stage, d.id, d.title, d.body, d.photo_ids);
  perform private.queue_staff_alert(o.id, 'decision_approved');
end $$;

create function public.request_changes(p_decision bigint, p_note text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare d public.order_decisions; o public.orders; who text; n text := nullif(btrim(p_note), '');
begin
  if n is not null and char_length(n) > 2000 then raise exception 'That note is too long' using errcode = '22001'; end if;
  select * into d from public.order_decisions where id = p_decision for update;
  select * into o from public.orders where id = d.order_id;
  if d.id is null or o.id is null or not private.is_member(o.client_id) then
    raise exception 'No such decision' using errcode = 'P0002';
  end if;
  if d.status <> 'open' then raise exception 'This decision is already closed' using errcode = '55000'; end if;
  who := private.actor_name(o.client_id);
  update public.order_decisions set status = 'changes_asked', note = n, closed_at = now(), closed_by = (select auth.uid()), closed_label = who where id = d.id;
  insert into public.order_events (order_id, kind, side, actor_id, actor_label, stage, decision_id, title, body, photo_ids, note)
    values (o.id, 'changes_asked', 'client', (select auth.uid()), who, d.stage, d.id, d.title, d.body, d.photo_ids, n);
  perform private.queue_staff_alert(o.id, 'changes_asked');
end $$;

-- Ask for a photo of a stage (the current one or an earlier one). One request per stage is open at a time.
create function public.request_photo(p_order bigint, p_stage smallint default null, p_note text default null) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare o public.orders; who text; s smallint; n text := nullif(btrim(p_note), ''); r bigint;
begin
  select * into o from public.orders where id = p_order;
  if o.id is null or not private.is_member(o.client_id) then raise exception 'No such order' using errcode = 'P0002'; end if;
  s := coalesce(p_stage, o.stage);
  if s < 1 or s > o.stage then raise exception 'That stage has not started yet' using errcode = '22023'; end if;
  if n is not null and char_length(n) > 500 then raise exception 'That note is too long' using errcode = '22001'; end if;
  if exists (select 1 from public.photo_requests where order_id = o.id and stage = s and answered_at is null) then
    raise exception 'A photo of this stage is already on its way' using errcode = '55000';
  end if;
  who := private.actor_name(o.client_id);
  insert into public.photo_requests (order_id, stage, note, asked_by, asked_label)
    values (o.id, s, n, (select auth.uid()), who) returning id into r;
  insert into public.order_events (order_id, kind, side, actor_id, actor_label, stage, note)
    values (o.id, 'photo_asked', 'client', (select auth.uid()), who, s, n);
  perform private.queue_staff_alert(o.id, 'photo_asked');
  return r;
end $$;

-- Order updates on WhatsApp or email: the person turns them on or off, and the wording they were
-- shown is stored with the time (docs/production-plan.md §7).
create function public.set_updates_consent(p_channel text, p_opted_in boolean, p_wording text, p_version text) returns void
language plpgsql security definer set search_path = ''
as $$
declare m public.client_members; a text;
begin
  select * into m from public.client_members where user_id = (select auth.uid()) order by id limit 1;
  if m.id is null then raise exception 'Not signed in as a client' using errcode = '42501'; end if;
  if p_channel not in ('email', 'whatsapp') then raise exception 'Unknown channel' using errcode = '22023'; end if;
  a := case p_channel when 'email' then m.email else m.whatsapp end;
  if a is null then raise exception 'There is no WhatsApp number on this account' using errcode = '22023'; end if;
  if p_wording is null or char_length(p_wording) not between 1 and 1000 or p_version is null or char_length(p_version) not between 1 and 40 then
    raise exception 'The wording shown is missing' using errcode = '22023';
  end if;
  insert into public.contact_consents (channel, address, purpose, opted_in, wording, wording_version, source)
    values (p_channel, a, 'order_updates', p_opted_in, p_wording, p_version, 'portal');
end $$;

-- The person's own current choices, per channel.
create function public.my_updates_consent() returns table (channel text, opted_in boolean)
language sql stable security definer set search_path = ''
as $$ select distinct on (c.channel) c.channel, c.opted_in
  from public.contact_consents c join public.client_members m on m.user_id = (select auth.uid())
  where c.purpose = 'order_updates' and ((c.channel = 'email' and c.address = m.email) or (c.channel = 'whatsapp' and c.address = m.whatsapp))
  order by c.channel, c.created_at desc, c.id desc $$;

-- Functions: what staff do ---------------------------------------------------------------------------------

-- Turn a request (or nothing: an order that arrived on WhatsApp) into an order. The order keeps the
-- request's code; a second order from the same request gets -B, -C... (docs/adr/0004). With no
-- request it takes a new code from the same sequence. It starts at the brand's entry stage (01 for
-- Starting, 04 for Scaling) unless a stage is given.
create function public.create_order(p_client bigint, p_name text, p_product text, p_request bigint default null,
  p_entry_stage smallint default null, p_summary text default null, p_fabric text default null,
  p_qty integer default null, p_due_on date default null) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare r public.requests; c text; n int; s smallint; id bigint; who text;
begin
  if not private.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  if not exists (select 1 from public.clients where clients.id = p_client) then raise exception 'No such client' using errcode = 'P0002'; end if;
  if p_request is not null then
    select * into r from public.requests where requests.id = p_request;
    if r.id is null then raise exception 'No such request' using errcode = 'P0002'; end if;
    select count(*) into n from public.orders where request_id = r.id;
    c := case when n = 0 then r.code else r.code || '-' || chr(65 + n) end;
  else
    c := 'FC-' || nextval('public.code_seq');
  end if;
  s := coalesce(p_entry_stage, case when r.path = 'Scaling' then 4 else 1 end);
  insert into public.orders (code, client_id, request_id, name, product, summary, fabric, qty, stage, due_on)
    values (c, p_client, p_request, p_name, p_product, p_summary, p_fabric, p_qty, s, p_due_on) returning orders.id into id;
  who := private.actor_name(p_client);
  insert into public.order_events (order_id, kind, side, actor_id, actor_label, stage, to_stage)
    values (id, 'order_opened', 'staff', (select auth.uid()), who, s, s);
  if r.id is not null then update public.requests set status = 'converted' where requests.id = r.id; end if;
  return id;
end $$;

-- Move an order to another stage. Forward past the sample gate needs the sample approved: bulk
-- production cannot start until the client approves a sample (CONTEXT.md). Moving back is allowed
-- and logged like any move.
create function public.move_stage(p_order bigint, p_to smallint, p_note text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders; who text; n text := nullif(btrim(p_note), '');
begin
  if not private.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'No such order' using errcode = 'P0002'; end if;
  if p_to is null or p_to < 1 or p_to > 8 or p_to = o.stage then raise exception 'Pick another stage between 1 and 8' using errcode = '22023'; end if;
  if n is not null and char_length(n) > 500 then raise exception 'That note is too long' using errcode = '22001'; end if;
  if o.stage <= 5 and p_to >= 6 and not exists (select 1 from public.order_decisions where order_id = o.id and stage = 5 and status = 'approved') then
    raise exception 'The client has not approved a sample yet' using errcode = '55000';
  end if;
  update public.orders set stage = p_to where id = o.id;
  insert into public.order_events (order_id, kind, side, actor_id, actor_label, stage, from_stage, to_stage, note)
    values (o.id, 'stage_moved', 'staff', (select auth.uid()), private.actor_name(o.client_id), p_to, o.stage, p_to, n);
  perform private.queue_client_alert(o.id, 'stage_moved');
end $$;

-- Ask the client for a decision at the order's current stage. One is open at a time.
create function public.open_decision(p_order bigint, p_title text, p_body text default null, p_photo_ids bigint[] default '{}') returns bigint
language plpgsql security definer set search_path = ''
as $$
declare o public.orders; who text; id bigint; ph bigint[] := coalesce(p_photo_ids, '{}');
begin
  if not private.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  select * into o from public.orders where orders.id = p_order for update;
  if o.id is null then raise exception 'No such order' using errcode = 'P0002'; end if;
  if exists (select 1 from public.order_decisions where order_id = o.id and status = 'open') then
    raise exception 'This order already has a decision open' using errcode = '55000';
  end if;
  if (select count(*) from public.stage_photos where order_id = o.id and stage_photos.id = any (ph)) <> cardinality(ph) then
    raise exception 'Those photos are not on this order' using errcode = '22023';
  end if;
  who := private.actor_name(o.client_id);
  insert into public.order_decisions (order_id, stage, title, body, photo_ids, opened_by, opened_label)
    values (o.id, o.stage, p_title, nullif(btrim(p_body), ''), ph, (select auth.uid()), who) returning order_decisions.id into id;
  insert into public.order_events (order_id, kind, side, actor_id, actor_label, stage, decision_id, title, body, photo_ids)
    values (o.id, 'decision_opened', 'staff', (select auth.uid()), who, o.stage, id, p_title, nullif(btrim(p_body), ''), ph);
  perform private.queue_client_alert(o.id, 'decision_opened');
  return id;
end $$;

create function public.withdraw_decision(p_decision bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare d public.order_decisions; o public.orders; who text;
begin
  if not private.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  select * into d from public.order_decisions where id = p_decision for update;
  if d.id is null then raise exception 'No such decision' using errcode = 'P0002'; end if;
  if d.status <> 'open' then raise exception 'This decision is already closed' using errcode = '55000'; end if;
  select * into o from public.orders where id = d.order_id;
  who := private.actor_name(o.client_id);
  update public.order_decisions set status = 'withdrawn', closed_at = now(), closed_by = (select auth.uid()), closed_label = who where id = d.id;
  insert into public.order_events (order_id, kind, side, actor_id, actor_label, stage, decision_id, title)
    values (o.id, 'decision_withdrawn', 'staff', (select auth.uid()), who, d.stage, d.id, d.title);
end $$;

-- Record a photo already uploaded to the stage-photos bucket (under <order id>/). Answers the open
-- request for that stage, if any.
create function public.add_stage_photo(p_order bigint, p_stage smallint, p_object_path text, p_caption text default null) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare o public.orders; who text; id bigint;
begin
  if not private.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  select * into o from public.orders where orders.id = p_order;
  if o.id is null then raise exception 'No such order' using errcode = 'P0002'; end if;
  if p_stage is null or p_stage < 1 or p_stage > 8 then raise exception 'Pick a stage between 1 and 8' using errcode = '22023'; end if;
  if left(p_object_path, length(o.id::text) + 1) <> o.id::text || '/' then raise exception 'The photo must be stored under this order' using errcode = '22023'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'stage-photos' and name = p_object_path) then
    raise exception 'That photo has not been uploaded' using errcode = '22023';
  end if;
  who := private.actor_name(o.client_id);
  insert into public.stage_photos (order_id, stage, object_path, caption, uploaded_by)
    values (o.id, p_stage, p_object_path, nullif(btrim(p_caption), ''), (select auth.uid())) returning stage_photos.id into id;
  insert into public.order_events (order_id, kind, side, actor_id, actor_label, stage, photo_ids, note)
    values (o.id, 'photo_added', 'staff', (select auth.uid()), who, p_stage, array[id], nullif(btrim(p_caption), ''));
  update public.photo_requests set answered_at = now() where order_id = o.id and stage = p_stage and answered_at is null;
  perform private.queue_client_alert(o.id, 'photo_added');
  return id;
end $$;

-- Only signed-in users can call them (the functions check who they are); the publishable key cannot.
revoke all on function public.approve_decision(bigint), public.request_changes(bigint, text), public.request_photo(bigint, smallint, text),
  public.set_updates_consent(text, boolean, text, text), public.my_updates_consent(),
  public.create_order(bigint, text, text, bigint, smallint, text, text, integer, date), public.move_stage(bigint, smallint, text),
  public.open_decision(bigint, text, text, bigint[]), public.withdraw_decision(bigint),
  public.add_stage_photo(bigint, smallint, text, text) from public, anon;
grant execute on function public.approve_decision(bigint), public.request_changes(bigint, text), public.request_photo(bigint, smallint, text),
  public.set_updates_consent(text, boolean, text, text), public.my_updates_consent(),
  public.create_order(bigint, text, text, bigint, smallint, text, text, integer, date), public.move_stage(bigint, smallint, text),
  public.open_decision(bigint, text, text, bigint[]), public.withdraw_decision(bigint),
  public.add_stage_photo(bigint, smallint, text, text) to authenticated;
