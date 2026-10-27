-- my_requests (20261027071333) leaves out a request once its order shows on the person's Track page.
-- Staff see every order there, so for them every converted request's order already shows.
create or replace function public.my_requests() returns table (code text, product text, status text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$ select q.code, q.product, q.status, q.created_at from public.requests q
  where q.email = (select lower(u.email) from auth.users u where u.id = (select auth.uid()))
    and q.status <> 'closed'
    and not exists (select 1 from public.orders o where o.request_id = q.id and (private.is_staff() or private.is_member(o.client_id)))
  order by q.created_at desc, q.id desc limit 50 $$;
