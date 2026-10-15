-- Phase 2: sample requests and contact messages (docs/production-plan.md §4).
--
-- Row-level security is on for every table, and the publishable key reaches none of them: the two
-- forms write through the submit-request and submit-contact Edge Functions (which use the service
-- role), and staff read once they can sign in (the admin, phase 4). Option lists (products,
-- quantities...) are checked by the functions against supabase/functions/_shared/forms.ts, the one
-- copy the site uses too, so adding an option needs no migration.

-- Functions the policies call. They live outside the API's schemas, so nobody can call them
-- through the API.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- Staff ----------------------------------------------------------------------------------------

create type public.staff_role as enum ('owner', 'staff');

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  role public.staff_role not null default 'staff',
  created_at timestamptz not null default now()
);
comment on table public.staff is 'Full Circle''s own people. Owners manage staff; everyone on staff reads requests and messages.';

create function private.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.staff where user_id = (select auth.uid())) $$;

create function private.is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'owner') $$;

revoke all on function private.is_staff(), private.is_owner() from public;
grant execute on function private.is_staff(), private.is_owner() to authenticated;

-- Codes (docs/adr/0004): one sequence issues FC-####, and the code a request gets stays with its
-- order. It starts above the codes the demos on the site show (FC-2418 and the like).

create sequence public.code_seq start with 2501;

-- Requests ---------------------------------------------------------------------------------------

create table public.requests (
  id bigint generated always as identity primary key,
  code text not null unique default ('FC-' || nextval('public.code_seq')),
  -- the four picks; the brand stage and the product are required by the form
  path text not null,
  product text not null,
  qty text,
  have text,
  brand text not null check (char_length(brand) between 1 and 200),
  -- the contact as typed, and how it was read: an email (lower case) or a WhatsApp number
  -- (international form, +20…) when the number could be read as one
  contact text not null check (char_length(contact) between 3 and 200),
  contact_channel text not null check (contact_channel in ('email', 'whatsapp')),
  email text check (email = lower(email)),
  whatsapp text check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  note text check (char_length(note) <= 4000),
  status text not null default 'new' check (status in ('new', 'replied', 'converted', 'closed')),
  -- where the visitor came from: utm_* parameters, the referring site and the first page
  source jsonb not null default '{}'::jsonb,
  -- the version of the privacy line shown under the button
  notice_version text not null,
  created_at timestamptz not null default now(),
  check ((contact_channel = 'email') = (email is not null))
);
comment on table public.requests is 'Sample requests from the request form. Inserted only by the submit-request Edge Function.';
create index requests_created_at on public.requests (created_at desc);

create table public.request_files (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.requests (id) on delete cascade,
  -- the object's path in the private request-files bucket
  object_path text not null unique,
  name text not null check (char_length(name) <= 200),
  size integer not null check (size > 0),
  type text not null,
  created_at timestamptz not null default now()
);
comment on table public.request_files is 'Files sent with a request (sketches, tech packs, photos), kept in the private request-files bucket.';
create index request_files_request on public.request_files (request_id);

-- Contact messages -------------------------------------------------------------------------------

create table public.messages (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 200),
  contact text not null check (char_length(contact) between 3 and 200),
  contact_channel text not null check (contact_channel in ('email', 'whatsapp')),
  email text check (email = lower(email)),
  whatsapp text check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  text text not null check (char_length(text) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'replied', 'closed')),
  source jsonb not null default '{}'::jsonb,
  notice_version text not null,
  created_at timestamptz not null default now(),
  check ((contact_channel = 'email') = (email is not null))
);
comment on table public.messages is 'Messages from the contact form. Inserted only by the submit-contact Edge Function.';
create index messages_created_at on public.messages (created_at desc);

-- Consent records (§7): what someone agreed to, in which words, when and where ------------------

create table public.contact_consents (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('email', 'whatsapp')),
  -- the email, or the number in international form
  address text not null,
  purpose text not null check (purpose in ('order_updates')),
  opted_in boolean not null,
  wording text not null,
  wording_version text not null,
  -- where it was given: "request FC-2501", later "portal"
  source text not null,
  request_id bigint references public.requests (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.contact_consents is 'Opt-ins and opt-outs, with the exact wording shown. Kept when the request itself is deleted.';
create index contact_consents_address on public.contact_consents (channel, address, created_at desc);

-- Every message the system sends ----------------------------------------------------------------

create table public.notifications (
  id bigint generated always as identity primary key,
  event text not null check (event in ('request_received', 'contact_message')),
  audience text not null check (audience in ('staff', 'client')),
  channel text not null check (channel in ('email', 'whatsapp')),
  recipient text not null,
  -- skipped: the channel is not set up yet (no Resend key, WhatsApp before phase 4)
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_id text,
  detail text,
  request_id bigint references public.requests (id) on delete cascade,
  message_id bigint references public.messages (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.notifications is 'Every email or WhatsApp message sent (or not) about a request or message.';
create index notifications_request on public.notifications (request_id);
create index notifications_message on public.notifications (message_id);

-- Access ------------------------------------------------------------------------------------------
-- Supabase grants every role everything on new tables in public; take that back, so a missing
-- policy can never be the only thing standing in the way.

revoke all on public.staff, public.requests, public.request_files, public.messages,
  public.contact_consents, public.notifications from anon, authenticated;
revoke all on sequence public.code_seq from anon, authenticated;

alter table public.staff enable row level security;
alter table public.requests enable row level security;
alter table public.request_files enable row level security;
alter table public.messages enable row level security;
alter table public.contact_consents enable row level security;
alter table public.notifications enable row level security;

-- staff: everyone on staff sees the list; owners add, change and remove people
grant select, insert, update, delete on public.staff to authenticated;
create policy "staff read staff" on public.staff for select to authenticated using ((select private.is_staff()));
create policy "owners add staff" on public.staff for insert to authenticated with check ((select private.is_owner()));
create policy "owners change staff" on public.staff for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owners remove staff" on public.staff for delete to authenticated using ((select private.is_owner()));

-- requests and messages: staff read them and move their status on; nothing else changes
grant select, update (status) on public.requests to authenticated;
create policy "staff read requests" on public.requests for select to authenticated using ((select private.is_staff()));
create policy "staff update requests" on public.requests for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

grant select, update (status) on public.messages to authenticated;
create policy "staff read messages" on public.messages for select to authenticated using ((select private.is_staff()));
create policy "staff update messages" on public.messages for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

-- files, consents and the message log: read only
grant select on public.request_files, public.contact_consents, public.notifications to authenticated;
create policy "staff read request files" on public.request_files for select to authenticated using ((select private.is_staff()));
create policy "staff read consents" on public.contact_consents for select to authenticated using ((select private.is_staff()));
create policy "staff read notifications" on public.notifications for select to authenticated using ((select private.is_staff()));

-- Uploads ---------------------------------------------------------------------------------------
-- A private bucket: images and PDFs up to 10 MB. Staff open them through signed links.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-files', 'request-files', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'application/pdf']);

create policy "staff read request files" on storage.objects for select to authenticated
  using (bucket_id = 'request-files' and (select private.is_staff()));
