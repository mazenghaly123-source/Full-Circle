-- Deleting an order (Mazen, 30 Oct 2026: a test order, or one opened by mistake). Only an owner or a
-- developer, and only once the order is cancelled, so a live order is never one click from gone. The
-- order goes with everything on it: its log (private.keep_log lets entries go with their order), decisions,
-- photos' records, specs and messages. The request it came from goes back to the inbox, unless another
-- order still holds it. Returns the photos' paths in stage-photos, which the admin then removes through
-- the Storage API (files can't be removed from SQL).
create function public.delete_order(p_order bigint) returns text[]
language plpgsql security definer set search_path = ''
as $$
declare o public.orders; paths text[];
begin
  if not private.is_owner() then raise exception 'Only an owner or a developer deletes orders' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'No such order' using errcode = 'P0002'; end if;
  if o.status <> 'cancelled' then raise exception 'Cancel the order first' using errcode = '55000'; end if;
  select coalesce(array_agg(object_path), '{}') into paths from public.stage_photos where order_id = o.id;
  delete from public.orders where id = o.id;
  if o.request_id is not null and not exists (select 1 from public.orders where request_id = o.request_id) then
    update public.requests set status = 'replied' where id = o.request_id and status = 'converted';
  end if;
  return paths;
end $$;
comment on function public.delete_order(bigint) is 'Deletes a cancelled order and everything on it (owners and developers). Returns its photos'' paths in stage-photos.';
revoke all on function public.delete_order(bigint) from public;
grant execute on function public.delete_order(bigint) to authenticated;

-- the photos' files go after their order, through the Storage API, by an owner or a developer
create policy "owners remove stage photos" on storage.objects for delete to authenticated
  using (bucket_id = 'stage-photos' and (select private.is_owner()));
