-- move_stage: the sample gate reads the latest sample decision at 05 (withdrawn ones aside), not any
-- approval there ever was. A sample approved, then a revised one turned down (or still waiting),
-- keeps the order before bulk until the revision is approved.
create or replace function public.move_stage(p_order bigint, p_to smallint, p_note text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders; n text := nullif(btrim(p_note), '');
begin
  if not private.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'No such order' using errcode = 'P0002'; end if;
  if p_to is null or p_to < 1 or p_to > 8 or p_to = o.stage then raise exception 'Pick another stage between 1 and 8' using errcode = '22023'; end if;
  if n is not null and char_length(n) > 500 then raise exception 'That note is too long' using errcode = '22001'; end if;
  if o.stage <= 5 and p_to >= 6 and coalesce((select d.status from public.order_decisions d
      where d.order_id = o.id and d.stage = 5 and d.status <> 'withdrawn'
      order by d.opened_at desc, d.id desc limit 1), '') <> 'approved' then
    raise exception 'The client has not approved a sample yet' using errcode = '55000';
  end if;
  update public.orders set stage = p_to where id = o.id;
  insert into public.order_events (order_id, kind, side, actor_id, actor_label, stage, from_stage, to_stage, note)
    values (o.id, 'stage_moved', 'staff', (select auth.uid()), private.actor_name(o.client_id), p_to, o.stage, p_to, n);
  perform private.queue_client_alert(o.id, 'stage_moved');
end $$;
