-- Safe seller listing lifecycle: pause, resume, and soft-archive without deleting order history.
alter table catalog.products drop constraint if exists products_status_check;
alter table catalog.products
  add constraint products_status_check
  check (status in ('draft','pending_review','approved','rejected','changes_requested','paused','archived'));

create or replace function public.manage_seller_product_listing(
  p_product_id uuid,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, catalog, seller
as $$
declare
  v_product catalog.products%rowtype;
  v_next_status text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to manage your listing';
  end if;

  if p_action not in ('pause','resume','archive') then
    raise exception 'Unsupported listing action';
  end if;

  select p.* into v_product
  from catalog.products p
  join seller.seller_profiles sp on sp.id = p.seller_id
  where p.id = p_product_id
    and sp.user_id = auth.uid()
    and sp.onboarding_status = 'approved'
    and sp.account_status = 'active'
  for update of p;

  if not found then
    raise exception 'Listing not found or you do not have permission to manage it';
  end if;

  if p_action = 'pause' then
    if v_product.status <> 'approved' then
      raise exception 'Only approved listings can be paused';
    end if;
    v_next_status := 'paused';
  elsif p_action = 'resume' then
    if v_product.status <> 'paused' then
      raise exception 'Only paused listings can be resumed';
    end if;
    if v_product.stock_quantity < 1 then
      raise exception 'Add available stock before resuming this listing';
    end if;
    v_next_status := 'approved';
  else
    if v_product.status not in ('approved','paused') then
      raise exception 'Only approved or paused listings can be archived';
    end if;
    v_next_status := 'archived';
  end if;

  update catalog.products
  set status = v_next_status, updated_at = now()
  where id = v_product.id;

  return v_next_status;
end;
$$;

revoke all on function public.manage_seller_product_listing(uuid, text) from public, anon;
grant execute on function public.manage_seller_product_listing(uuid, text) to authenticated;
