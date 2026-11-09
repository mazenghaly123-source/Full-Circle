-- Calls booked on the site (Mazen, 9 Nov 2026). The book-call Edge Function saves each one once the time
-- is free (applied as written; 20261109181049 made the site keep its own calendar instead of Google's). Staff see them in the admin's inbox with the requests and messages, and move them on the same way.

create table public.bookings (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('visit', 'phone', 'online')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  name text not null check (char_length(name) between 1 and 200),
  -- the number as typed, and in international form (+20…) when its country could be told
  phone text not null check (char_length(phone) between 7 and 200),
  whatsapp text check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  -- where Google sends the invite
  email text not null check (email = lower(email) and char_length(email) between 3 and 200),
  brand text not null check (char_length(brand) between 1 and 200),
  note text check (char_length(note) <= 4000),
  -- for a calendar link later, and the video link of an online meeting
  google_event_id text,
  meet_url text,
  status text not null default 'new' check (status in ('new', 'replied', 'closed')),
  source jsonb not null default '{}'::jsonb,
  notice_version text not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
comment on table public.bookings is 'Calls booked on the site. Inserted only by the book-call Edge Function.';
create index bookings_created_at on public.bookings (created_at desc);
create index bookings_email on public.bookings (email, created_at desc);

-- as requests and messages: staff read them and move their status on; nothing else changes
revoke all on public.bookings from anon, authenticated;
alter table public.bookings enable row level security;
grant select, update (status) on public.bookings to authenticated;
create policy "staff read bookings" on public.bookings for select to authenticated using ((select private.is_staff()));
create policy "staff update bookings" on public.bookings for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
