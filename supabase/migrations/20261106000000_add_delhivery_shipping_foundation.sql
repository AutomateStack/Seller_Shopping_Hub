-- Delhivery shipping foundation for Seller Shopping Hub.
-- Seller addresses remain seller-owned; approval and Delhivery registration are backend/admin controlled.

alter table seller.seller_addresses
  add column review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'changes_requested', 'rejected')),
  add column review_note text,
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column reviewed_at timestamptz;

create index seller_addresses_review_status_idx
  on seller.seller_addresses (review_status, created_at desc);

create or replace function public.guard_seller_address_review_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Trusted backend operations (service role) may update registration/review state.
  if auth.uid() is null or public.is_current_marketplace_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.review_status := 'pending';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;

  if row(
    new.address_type, new.contact_name, new.contact_phone,
    new.address_line1, new.address_line2, new.city, new.state,
    new.postal_code, new.country_code, new.is_default
  ) is distinct from row(
    old.address_type, old.contact_name, old.contact_phone,
    old.address_line1, old.address_line2, old.city, old.state,
    old.postal_code, old.country_code, old.is_default
  ) then
    new.review_status := 'pending';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    new.review_status := old.review_status;
    new.review_note := old.review_note;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists seller_addresses_guard_review_fields on seller.seller_addresses;
create trigger seller_addresses_guard_review_fields
before insert or update on seller.seller_addresses
for each row execute function public.guard_seller_address_review_fields();

drop policy if exists seller_addresses_admin_update on seller.seller_addresses;
create policy seller_addresses_admin_update
on seller.seller_addresses
for update to authenticated
using ((select public.is_current_marketplace_admin()))
with check ((select public.is_current_marketplace_admin()));

create table seller.delhivery_warehouse_mappings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references seller.seller_profiles(id) on delete cascade,
  address_id uuid not null unique references seller.seller_addresses(id) on delete cascade,
  warehouse_name text not null unique,
  registration_status text not null default 'pending'
    check (registration_status in ('pending', 'registered', 'failed', 'inactive')),
  delhivery_response jsonb not null default '{}'::jsonb,
  last_error text,
  registered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index delhivery_warehouse_mappings_seller_idx
  on seller.delhivery_warehouse_mappings (seller_id, registration_status);

alter table seller.delhivery_warehouse_mappings enable row level security;

create policy delhivery_warehouse_mappings_read_own_or_admin
on seller.delhivery_warehouse_mappings
for select to authenticated
using (
  exists (
    select 1 from seller.seller_profiles sp
    where sp.id = seller_id and sp.user_id = (select auth.uid())
  )
  or (select public.is_current_marketplace_admin())
);

grant select on seller.delhivery_warehouse_mappings to authenticated;
grant all on seller.delhivery_warehouse_mappings to service_role;

create table orders.delhivery_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders.marketplace_orders(id) on delete cascade,
  seller_id uuid not null references seller.seller_profiles(id) on delete restrict,
  pickup_address_id uuid not null references seller.seller_addresses(id) on delete restrict,
  warehouse_name text not null,
  delhivery_order_id text not null unique,
  waybill text unique,
  shipment_status text not null default 'pending'
    check (shipment_status in (
      'pending', 'manifested', 'ready_for_pickup', 'in_transit',
      'out_for_delivery', 'delivered', 'rto', 'cancelled', 'exception'
    )),
  label_url text,
  delhivery_response jsonb not null default '{}'::jsonb,
  last_tracking_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index delhivery_shipments_seller_status_idx
  on orders.delhivery_shipments (seller_id, shipment_status, created_at desc);
create index delhivery_shipments_waybill_idx
  on orders.delhivery_shipments (waybill) where waybill is not null;

alter table orders.delhivery_shipments enable row level security;

create policy delhivery_shipments_read_buyer_seller_admin
on orders.delhivery_shipments
for select to authenticated
using (
  exists (
    select 1 from orders.marketplace_orders o
    where o.id = order_id and o.buyer_id = (select auth.uid())
  )
  or exists (
    select 1 from seller.seller_profiles sp
    where sp.id = seller_id and sp.user_id = (select auth.uid())
  )
  or (select public.is_current_marketplace_admin())
);

grant select on orders.delhivery_shipments to authenticated;
grant all on orders.delhivery_shipments to service_role;

create table orders.delhivery_pickup_requests (
  id uuid primary key default gen_random_uuid(),
  warehouse_mapping_id uuid not null references seller.delhivery_warehouse_mappings(id) on delete restrict,
  seller_id uuid not null references seller.seller_profiles(id) on delete restrict,
  warehouse_name text not null,
  delhivery_pickup_id text,
  pickup_date date not null,
  pickup_time text not null,
  expected_package_count integer not null check (expected_package_count > 0),
  request_status text not null default 'pending'
    check (request_status in ('pending', 'created', 'completed', 'failed', 'cancelled')),
  delhivery_response jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index delhivery_pickup_requests_warehouse_date_idx
  on orders.delhivery_pickup_requests (warehouse_mapping_id, pickup_date desc);

alter table orders.delhivery_pickup_requests enable row level security;

create policy delhivery_pickup_requests_read_own_or_admin
on orders.delhivery_pickup_requests
for select to authenticated
using (
  exists (
    select 1 from seller.seller_profiles sp
    where sp.id = seller_id and sp.user_id = (select auth.uid())
  )
  or (select public.is_current_marketplace_admin())
);

grant select on orders.delhivery_pickup_requests to authenticated;
grant all on orders.delhivery_pickup_requests to service_role;

create table orders.delhivery_tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references orders.delhivery_shipments(id) on delete cascade,
  event_key text not null,
  status text not null,
  status_detail text,
  location text,
  event_at timestamptz,
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (shipment_id, event_key)
);

create index delhivery_tracking_events_shipment_time_idx
  on orders.delhivery_tracking_events (shipment_id, event_at desc nulls last);

alter table orders.delhivery_tracking_events enable row level security;

create policy delhivery_tracking_events_read_buyer_seller_admin
on orders.delhivery_tracking_events
for select to authenticated
using (
  exists (
    select 1
    from orders.delhivery_shipments ds
    join orders.marketplace_orders o on o.id = ds.order_id
    where ds.id = shipment_id
      and (
        o.buyer_id = (select auth.uid())
        or exists (
          select 1 from seller.seller_profiles sp
          where sp.id = ds.seller_id and sp.user_id = (select auth.uid())
        )
      )
  )
  or (select public.is_current_marketplace_admin())
);

grant select on orders.delhivery_tracking_events to authenticated;
grant all on orders.delhivery_tracking_events to service_role;

create trigger delhivery_warehouse_mappings_set_updated_at
before update on seller.delhivery_warehouse_mappings
for each row execute function public.set_updated_at();

create trigger delhivery_shipments_set_updated_at
before update on orders.delhivery_shipments
for each row execute function public.set_updated_at();

create trigger delhivery_pickup_requests_set_updated_at
before update on orders.delhivery_pickup_requests
for each row execute function public.set_updated_at();
