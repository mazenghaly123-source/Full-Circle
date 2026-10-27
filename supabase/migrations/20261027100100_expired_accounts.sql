-- The sign-in accounts the request form creates (20261027071333) follow their requests out: the
-- nightly clean-up also deletes an account a year old that no request, client or staff row needs.
create or replace function private.delete_expired(out deleted_requests int, out deleted_messages int)
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.requests q where q.created_at < now() - interval '1 year'
    and not exists (select 1 from public.orders o where o.request_id = q.id);
  get diagnostics deleted_requests = row_count;
  delete from public.messages m where m.created_at < now() - interval '1 year';
  get diagnostics deleted_messages = row_count;
  delete from auth.users u where u.created_at < now() - interval '1 year'
    and not exists (select 1 from public.staff s where s.user_id = u.id)
    and not exists (select 1 from public.client_members m where m.user_id = u.id)
    and not exists (select 1 from public.requests q where q.email = lower(u.email));
end $$;
comment on function private.delete_expired() is 'Deletes requests without an order, messages, and sign-in accounts nothing needs, a year after they arrived. Run nightly by pg_cron.';
revoke all on function private.delete_expired() from public;
