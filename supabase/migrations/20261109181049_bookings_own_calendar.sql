-- The site keeps its own calendar (Mazen, 9 Nov 2026: no Google setup): the free times are the working hours
-- less the calls already booked here, so one time takes one booking. A booking staff close no longer holds its time.
create unique index bookings_one_per_time on public.bookings (starts_at) where status <> 'closed';
comment on table public.bookings is 'Calls booked on the site, which are its calendar. Inserted only by the book-call Edge Function.';
comment on column public.bookings.google_event_id is 'Not used yet: kept for a calendar link later.';
comment on column public.bookings.meet_url is 'The video link of an online meeting, when the site has one to give.';
