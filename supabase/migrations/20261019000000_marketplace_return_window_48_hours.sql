create or replace function public.request_marketplace_return(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order orders.marketplace_orders%rowtype;
  v_request_id uuid;
  v_delivered_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Please sign in to request a return.';
  end if;
  if length(trim(coalesce(p_reason,''))) < 5 or length(trim(coalesce(p_reason,''))) > 1000 then
    raise exception 'Please provide a return reason (5–1000 characters).';
  end if;

  select * into v_order from orders.marketplace_orders
  where id = p_order_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'Order not found or not yours.'; end if;
  if v_order.status <> 'delivered' then raise exception 'Only delivered orders can have a return requested.'; end if;

  select min(h.changed_at) into v_delivered_at
  from orders.marketplace_order_history h
  where h.order_id = p_order_id
    and h.event_type = 'order_status'
    and lower(coalesce(h.new_value, '')) = 'delivered';

  if v_delivered_at is null then
    raise exception 'The delivery date could not be verified. Please contact support to request a return.';
  end if;
  if now() > v_delivered_at + interval '48 hours' then
    raise exception 'The return window has closed. Returns must be requested within 2 days after delivery.';
  end if;
  if exists (select 1 from orders.marketplace_return_requests where order_id = p_order_id) then
    raise exception 'A return request already exists for this order.';
  end if;

  insert into orders.marketplace_return_requests(order_id, buyer_id, seller_id, reason)
  values (p_order_id, auth.uid(), v_order.seller_id, trim(p_reason))
  returning id into v_request_id;

  insert into orders.marketplace_order_history(order_id, event_type, old_value, new_value, changed_by, changed_at)
  values (p_order_id, 'return_request', null, 'requested', auth.uid(), now());

  return jsonb_build_object('id', v_request_id, 'status', 'requested');
end;
$function$;

revoke all on function public.request_marketplace_return(uuid, text) from public;
grant execute on function public.request_marketplace_return(uuid, text) to authenticated;
