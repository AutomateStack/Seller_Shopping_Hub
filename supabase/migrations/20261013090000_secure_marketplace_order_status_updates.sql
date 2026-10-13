create or replace function public.update_marketplace_order_status(p_order_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, orders, seller, marketplace, catalog
as $$
declare
  v_order orders.marketplace_orders%rowtype;
  v_is_admin boolean := coalesce(public.is_current_marketplace_admin(), false) or coalesce(public.is_current_super_admin(), false);
  v_is_seller boolean := false;
  v_allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('placed','confirmed','processing','shipped','delivered','cancelled','returned') then raise exception 'Invalid order status'; end if;
  select * into v_order from orders.marketplace_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select exists (select 1 from seller.seller_profiles sp where sp.id = v_order.seller_id and sp.user_id = auth.uid() and sp.onboarding_status = 'approved' and sp.account_status = 'active') into v_is_seller;
  if not v_is_admin and not v_is_seller then raise exception 'Not authorized to update this order'; end if;
  if v_order.status = p_status then return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'unchanged', true); end if;
  if v_is_admin then
    v_allowed := case v_order.status when 'placed' then p_status in ('confirmed','cancelled') when 'confirmed' then p_status in ('processing','cancelled') when 'processing' then p_status in ('shipped','cancelled') when 'shipped' then p_status in ('delivered','returned') when 'delivered' then p_status = 'returned' else false end;
  else
    v_allowed := case v_order.status when 'placed' then p_status in ('confirmed','cancelled') when 'confirmed' then p_status in ('processing','cancelled') when 'processing' then p_status = 'shipped' when 'shipped' then p_status = 'delivered' else false end;
  end if;
  if not v_allowed then raise exception 'Status transition from % to % is not allowed', v_order.status, p_status; end if;
  if p_status = 'cancelled' then
    update catalog.products p set stock_quantity = p.stock_quantity + i.quantity, updated_at = now()
    from orders.marketplace_order_items i where i.order_id = v_order.id and i.product_id = p.id;
  end if;
  update orders.marketplace_orders set status = p_status, updated_at = now() where id = v_order.id;
  return jsonb_build_object('id', v_order.id, 'status', p_status, 'unchanged', false);
end;
$$;
revoke all on function public.update_marketplace_order_status(uuid, text) from public;
grant execute on function public.update_marketplace_order_status(uuid, text) to authenticated;
