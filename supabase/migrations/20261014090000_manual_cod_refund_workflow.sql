-- Safe manual COD refund ledger. This records verified payouts; it never moves money.
create table if not exists orders.marketplace_cod_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders.marketplace_orders(id) on delete restrict,
  seller_id uuid not null references seller.seller_profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payout_method text not null check (payout_method in ('upi','bank_transfer')),
  transaction_reference text not null check (char_length(trim(transaction_reference)) between 4 and 120),
  note text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists marketplace_cod_refunds_order_idx
  on orders.marketplace_cod_refunds(order_id, created_at desc);

alter table orders.marketplace_cod_refunds enable row level security;
revoke all on orders.marketplace_cod_refunds from anon, authenticated;
grant select on orders.marketplace_cod_refunds to authenticated;
grant usage on schema orders to authenticated;

drop policy if exists marketplace_cod_refunds_seller_read on orders.marketplace_cod_refunds;
create policy marketplace_cod_refunds_seller_read on orders.marketplace_cod_refunds
for select to authenticated using (
  exists (
    select 1 from orders.marketplace_orders o
    join seller.seller_profiles sp on sp.id = o.seller_id
    where o.id = order_id and sp.user_id = auth.uid()
  ) or public.is_current_marketplace_admin()
);

create or replace function public.record_marketplace_cod_refund(
  p_order_id uuid,
  p_amount numeric,
  p_payout_method text,
  p_transaction_reference text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, orders, seller
as $$
declare
  v_order orders.marketplace_orders%rowtype;
  v_seller_user uuid;
  v_prior_refunds numeric(12,2);
  v_total_refunds numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Refund amount must be greater than zero and have at most two decimal places';
  end if;
  if p_payout_method not in ('upi','bank_transfer') then raise exception 'Choose UPI or bank transfer'; end if;
  if char_length(trim(coalesce(p_transaction_reference,''))) < 4
     or char_length(trim(coalesce(p_transaction_reference,''))) > 120 then
    raise exception 'Enter the actual payout transaction reference';
  end if;
  if char_length(trim(coalesce(p_note,''))) > 1000 then raise exception 'Note is too long'; end if;

  select * into v_order from orders.marketplace_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  select sp.user_id into v_seller_user
  from seller.seller_profiles sp
  where sp.id = v_order.seller_id and sp.onboarding_status = 'approved' and sp.account_status = 'active';
  if v_seller_user is distinct from auth.uid() and not coalesce(public.is_current_marketplace_admin(), false) then
    raise exception 'Not authorized to record a refund for this order';
  end if;
  if lower(coalesce(v_order.payment_method,'')) <> 'cod' then raise exception 'This workflow is only for COD orders'; end if;
  if v_order.cod_collected_at is null or coalesce(v_order.payment_status,'') not in ('paid','collected') then
    raise exception 'Confirm COD was collected before recording a payout';
  end if;
  if v_order.status <> 'returned' then raise exception 'Only returned orders can be refunded'; end if;

  select coalesce(sum(r.amount),0) into v_prior_refunds
  from orders.marketplace_cod_refunds r where r.order_id = p_order_id;
  v_total_refunds := v_prior_refunds + p_amount;
  if v_total_refunds > v_order.total_amount then
    raise exception 'Refund exceeds the remaining refundable amount of %', (v_order.total_amount - v_prior_refunds);
  end if;

  insert into orders.marketplace_cod_refunds
    (order_id, seller_id, amount, payout_method, transaction_reference, note, recorded_by)
  values
    (v_order.id, v_order.seller_id, p_amount, p_payout_method,
     trim(p_transaction_reference), nullif(trim(coalesce(p_note,'')),''), auth.uid());

  update orders.marketplace_orders
  set refund_status = case when v_total_refunds >= total_amount then 'refunded' else 'refunded' end,
      refund_amount = v_total_refunds,
      refunded_at = now(),
      updated_at = now()
  where id = v_order.id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'payout_amount', p_amount,
    'total_refunded', v_total_refunds,
    'remaining_refundable', v_order.total_amount - v_total_refunds
  );
end;
$$;

revoke all on function public.record_marketplace_cod_refund(uuid,numeric,text,text,text) from public, anon;
grant execute on function public.record_marketplace_cod_refund(uuid,numeric,text,text,text) to authenticated;
