-- A developer can do everything an owner can: add and remove staff, change roles, remove a client's people.
create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.staff where user_id = (select auth.uid()) and role in ('owner', 'developer')) $$;
comment on table public.staff is 'Full Circle''s own people. Owners and developers manage staff; everyone on staff reads requests and messages.';
