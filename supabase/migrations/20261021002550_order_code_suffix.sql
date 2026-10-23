-- create_order: a second order's suffix (-B, -C...) is the first one not in use from the count of
-- the request's orders on, so an order deleted in between cannot make two orders want one code;
-- and the request row is locked, so two staff converting it at once take turns.
create or replace function public.create_order(p_client bigint, p_name text, p_product text, p_request bigint default null,
  p_entry_stage smallint default null, p_summary text default null, p_fabric text default null,
  p_qty integer default null, p_due_on date default null) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare r public.requests; c text; n int; s smallint; id bigint; who text;
begin
  if not private.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  if not exists (select 1 from public.clients where clients.id = p_client) then raise exception 'No such client' using errcode = 'P0002'; end if;
  if p_request is not null then
    select * into r from public.requests where requests.id = p_request for update;
    if r.id is null then raise exception 'No such request' using errcode = 'P0002'; end if;
    select count(*) into n from public.orders where request_id = r.id;
    loop
      c := case when n = 0 then r.code else r.code || '-' || chr(65 + n) end;
      exit when not exists (select 1 from public.orders where orders.code = c);
      n := n + 1;
    end loop;
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
