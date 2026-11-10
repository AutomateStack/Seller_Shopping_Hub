-- Capture the actual packed parcel before shipment creation and prevent bypassing the AWB workflow.
create table if not exists orders.marketplace_order_packages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders.marketplace_orders(id) on delete cascade,
  seller_id uuid not null references seller.seller_profiles(id) on delete restrict,
  pickup_address_id uuid not null references seller.seller_addresses(id) on delete restrict,
  weight_grams integer not null check (weight_grams > 0),
  length_cm numeric(10,2) not null check (length_cm > 0),
  breadth_cm numeric(10,2) not null check (breadth_cm > 0),
  height_cm numeric(10,2) not null check (height_cm > 0),
  packed_at timestamptz not null default now(),
  packed_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders.marketplace_order_packages enable row level security;
create policy marketplace_order_packages_read_own_or_admin
on orders.marketplace_order_packages for select to authenticated
using (
  exists (select 1 from seller.seller_profiles sp where sp.id = seller_id and sp.user_id = (select auth.uid()))
  or (select public.is_current_marketplace_admin())
);
grant select on orders.marketplace_order_packages to authenticated;
grant all on orders.marketplace_order_packages to service_role;

create trigger marketplace_order_packages_set_updated_at
before update on orders.marketplace_order_packages
for each row execute function public.set_updated_at();

create or replace function public.confirm_marketplace_order_package(
  p_order_id uuid,p_weight_grams integer,p_length_cm numeric,p_breadth_cm numeric,p_height_cm numeric
) returns orders.marketplace_order_packages
language plpgsql security definer
set search_path = 'pg_catalog','public','orders','seller'
as $function$
declare
  v_order orders.marketplace_orders%rowtype;
  v_package orders.marketplace_order_packages%rowtype;
  v_pickup_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_weight_grams is null or p_weight_grams<=0 or p_length_cm is null or p_length_cm<=0
    or p_breadth_cm is null or p_breadth_cm<=0 or p_height_cm is null or p_height_cm<=0 then
    raise exception 'Enter a positive packed weight and all three parcel dimensions';
  end if;
  select * into v_order from orders.marketplace_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not exists (select 1 from seller.seller_profiles sp where sp.id=v_order.seller_id and sp.user_id=auth.uid()
    and sp.onboarding_status='approved' and sp.account_status='active') then
    raise exception 'Only the active seller for this order can confirm packing';
  end if;
  if v_order.status<>'processing' then raise exception 'Only processing orders can be packed'; end if;
  if not exists (select 1 from orders.marketplace_order_items i where i.order_id=v_order.id) then
    raise exception 'This order has no items';
  end if;
  if exists (select 1 from orders.marketplace_order_items i where i.order_id=v_order.id and (
    coalesce(i.hsn_code,'') !~ '^[0-9]{4,8}$' or coalesce(i.seller_gstin,'')=''
    or coalesce(i.shipping_weight_grams,0)<=0 or coalesce(i.package_length_cm,0)<=0
    or coalesce(i.package_breadth_cm,0)<=0 or coalesce(i.package_height_cm,0)<=0
  )) then
    raise exception 'Shipment blocked: one or more products are missing valid HSN, seller GSTIN, weight or package dimensions. Update product details and place a new order.';
  end if;
  select a.id into v_pickup_id from seller.seller_addresses a
  join seller.delhivery_warehouse_mappings wm on wm.address_id=a.id
  where a.seller_id=v_order.seller_id and a.address_type='pickup'
    and a.review_status='approved' and wm.registration_status='registered'
  order by a.created_at desc limit 1;
  if v_pickup_id is null then
    raise exception 'Shipment blocked: approve and register a Delhivery pickup address before packing this order';
  end if;
  insert into orders.marketplace_order_packages(order_id,seller_id,pickup_address_id,weight_grams,length_cm,breadth_cm,height_cm,packed_at,packed_by)
  values(v_order.id,v_order.seller_id,v_pickup_id,p_weight_grams,p_length_cm,p_breadth_cm,p_height_cm,now(),auth.uid())
  on conflict(order_id) do update set pickup_address_id=excluded.pickup_address_id,weight_grams=excluded.weight_grams,
    length_cm=excluded.length_cm,breadth_cm=excluded.breadth_cm,height_cm=excluded.height_cm,packed_at=now(),packed_by=auth.uid()
  returning * into v_package;
  return v_package;
end;
$function$;
revoke all on function public.confirm_marketplace_order_package(uuid,integer,numeric,numeric,numeric) from public;
grant execute on function public.confirm_marketplace_order_package(uuid,integer,numeric,numeric,numeric) to authenticated;

-- A seller/admin cannot mark an order shipped until the package is confirmed and an AWB exists.
create or replace function public.update_marketplace_order_status(p_order_id uuid,p_status text)
returns jsonb language plpgsql security definer
set search_path = 'pg_catalog','public','orders','seller','marketplace','catalog'
as $function$
declare
  v_order orders.marketplace_orders%rowtype;
  v_is_admin boolean := coalesce(public.is_current_marketplace_admin(),false) or coalesce(public.is_current_super_admin(),false);
  v_is_seller boolean := false;
  v_allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status is null or p_status not in ('placed','confirmed','processing','shipped','delivered','cancelled','returned') then raise exception 'Invalid order status'; end if;
  select * into v_order from orders.marketplace_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select exists(select 1 from seller.seller_profiles sp where sp.id=v_order.seller_id and sp.user_id=auth.uid()
    and sp.onboarding_status='approved' and sp.account_status='active') into v_is_seller;
  if not v_is_admin and not v_is_seller then raise exception 'Not authorized to update this order'; end if;
  if v_order.status=p_status then return jsonb_build_object('id',v_order.id,'status',v_order.status,'unchanged',true); end if;
  if p_status='shipped' and not exists(
    select 1 from orders.marketplace_order_packages p join orders.delhivery_shipments ds on ds.order_id=p.order_id
    where p.order_id=v_order.id and p.seller_id=v_order.seller_id and p.packed_at is not null
      and ds.waybill is not null and btrim(ds.waybill)<>''
  ) then
    raise exception 'Shipment blocked: confirm the packed parcel and create a Delhivery AWB before marking this order shipped';
  end if;
  if v_is_admin then
    v_allowed:=case v_order.status when 'placed' then p_status in ('confirmed','cancelled')
      when 'confirmed' then p_status in ('processing','cancelled') when 'processing' then p_status in ('shipped','cancelled')
      when 'shipped' then p_status in ('delivered','returned') when 'delivered' then p_status='returned' else false end;
  else
    v_allowed:=case v_order.status when 'placed' then p_status in ('confirmed','cancelled')
      when 'confirmed' then p_status in ('processing','cancelled') when 'processing' then p_status='shipped'
      when 'shipped' then p_status='delivered' else false end;
  end if;
  if v_allowed is not true then raise exception 'Status transition from % to % is not allowed',v_order.status,p_status; end if;
  if p_status='cancelled' then
    perform set_config('app.inventory_movement_type','order_cancellation_restore',true);
    perform set_config('app.inventory_order_id',v_order.id::text,true);
    update catalog.products p set stock_quantity=p.stock_quantity+i.quantity,updated_at=now()
    from orders.marketplace_order_items i where i.order_id=v_order.id and i.product_id=p.id;
  end if;
  update orders.marketplace_orders set status=p_status,updated_at=now() where id=v_order.id;
  return jsonb_build_object('id',v_order.id,'status',p_status,'unchanged',false);
end;
$function$;