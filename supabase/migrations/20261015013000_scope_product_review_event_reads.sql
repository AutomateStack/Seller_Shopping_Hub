-- Read revision audit events through a narrowly scoped RPC so the private audit schema
-- does not need to be added to the PostgREST exposed-schema allowlist.
create or replace function public.list_product_review_events(p_revision_ids uuid[])
returns table (
  id uuid,
  revision_id uuid,
  actor_id uuid,
  actor_role text,
  action text,
  previous_status text,
  new_status text,
  comment text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'catalog', 'seller', 'audit'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if coalesce(cardinality(p_revision_ids), 0) > 200 then
    raise exception 'Request too many revision audit histories at once';
  end if;

  return query
  select e.id, e.revision_id, e.actor_id, e.actor_role, e.action,
         e.previous_status, e.new_status, e.comment, e.created_at
  from audit.product_review_events e
  where e.revision_id = any(coalesce(p_revision_ids, '{}'::uuid[]))
    and (
      public.is_current_marketplace_admin()
      or exists (
        select 1 from seller.seller_profiles sp
        where sp.id = e.seller_id and sp.user_id = auth.uid()
      )
    )
  order by e.created_at desc;
end;
$function$;

revoke all on function public.list_product_review_events(uuid[]) from public, anon;
grant execute on function public.list_product_review_events(uuid[]) to authenticated;
