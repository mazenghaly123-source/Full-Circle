-- Housekeeping (docs/production-plan.md §4, /privacy): requests and messages that did not lead to an
-- order are deleted a year after they arrived, every night. A request with an order stays as long as
-- the order (the order keeps its code); the consent records stay, without their link to the request,
-- for as long as /privacy says; the log of what was sent about a request or message goes with it.

-- pg_cron is on every Supabase database. (A plain PostgreSQL without it, as scripts/test-db-local.sh
-- runs, gets a stand-in from scripts/supabase-stub.sql.)
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then create extension if not exists pg_cron; end if;
end $$;

create function private.delete_expired(out deleted_requests int, out deleted_messages int)
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.requests q where q.created_at < now() - interval '1 year'
    and not exists (select 1 from public.orders o where o.request_id = q.id);
  get diagnostics deleted_requests = row_count;
  delete from public.messages m where m.created_at < now() - interval '1 year';
  get diagnostics deleted_messages = row_count;
end $$;
comment on function private.delete_expired() is 'Deletes requests without an order and messages, a year after they arrived. Run nightly by pg_cron.';
revoke all on function private.delete_expired() from public;

-- 01:15 UTC (03:15 or 04:15 in Cairo), when nobody is sending forms
select cron.schedule('delete-expired', '15 1 * * *', 'select private.delete_expired()');
