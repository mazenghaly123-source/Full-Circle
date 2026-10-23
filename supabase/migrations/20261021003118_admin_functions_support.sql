-- Phase 4: what the admin's two Edge Functions need (docs/production-plan.md §4–5).
--
-- invite: finds the sign-in account for an email before it adds the person to a client or to staff.
-- notify: sends the queued order messages. Each call claims the rows it sends, so two calls at once
-- never send the same message; a claim older than ten minutes (a call that died) is taken again.

create function public.user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = ''
as $$ select id from auth.users where lower(email) = lower(btrim(p_email)) order by created_at limit 1 $$;
comment on function public.user_id_by_email(text) is 'The sign-in account for an email, for the invite function (service role only).';

alter table public.order_notifications add column claimed_at timestamptz;

create function public.claim_order_notifications(p_limit integer default 50) returns setof public.order_notifications
language sql security definer set search_path = ''
as $$
  update public.order_notifications set claimed_at = now()
  where id in (
    select id from public.order_notifications
    where status = 'queued' and (claimed_at is null or claimed_at < now() - interval '10 minutes')
    order by id limit least(greatest(p_limit, 1), 200)
    for update skip locked)
  returning *
$$;
comment on function public.claim_order_notifications(integer) is 'Takes up to p_limit queued order messages for the notify function to send (service role only).';

-- Only the functions (the service role) call these; nobody signed in, and not the publishable key.
revoke all on function public.user_id_by_email(text), public.claim_order_notifications(integer) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text), public.claim_order_notifications(integer) to service_role;
