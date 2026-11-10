-- The dimensions sent to Delhivery must remain immutable after an AWB is issued.
create or replace function orders.prevent_package_changes_after_awb()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if exists (
    select 1 from orders.delhivery_shipments ds
    where ds.order_id=old.order_id and ds.waybill is not null and btrim(ds.waybill)<>''
  ) then
    raise exception 'Packed parcel details cannot be changed after a Delhivery AWB has been created';
  end if;
  return new;
end;
$$;
drop trigger if exists marketplace_order_packages_lock_after_awb on orders.marketplace_order_packages;
create trigger marketplace_order_packages_lock_after_awb
before update on orders.marketplace_order_packages
for each row execute function orders.prevent_package_changes_after_awb();