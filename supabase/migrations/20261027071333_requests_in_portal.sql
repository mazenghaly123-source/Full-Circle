-- A brand follows its request on the tracking page from the day it sends it. submit-request creates
-- the sign-in account for the request's email (sign-ups stay off: only staff and the form make
-- accounts), and the portal lists the person's requests until each becomes an order they can see.

-- The signed-in person's open requests: those sent with their account's email that have no order on
-- a client they belong to yet (that order shows instead). Closed requests are left out.
create function public.my_requests() returns table (code text, product text, status text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$ select q.code, q.product, q.status, q.created_at from public.requests q
  where q.email = (select lower(u.email) from auth.users u where u.id = (select auth.uid()))
    and q.status <> 'closed'
    and not exists (select 1 from public.orders o where o.request_id = q.id and private.is_member(o.client_id))
  order by q.created_at desc, q.id desc limit 50 $$;
comment on function public.my_requests() is 'The signed-in person''s requests that have not become an order they can see.';

revoke all on function public.my_requests() from public, anon;
grant execute on function public.my_requests() to authenticated;
