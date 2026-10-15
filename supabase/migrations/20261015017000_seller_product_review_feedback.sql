-- Make the latest initial-review feedback available on the seller's own product row.
-- Review status, seller-facing note, admin note, and immutable history remain one transaction.
create or replace function public.review_seller_product_submission(
  p_product_id uuid,
  p_decision text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'catalog'
as $function$
declare
  v_product catalog.products%rowtype;
  v_note text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if auth.uid() is null or not public.is_current_marketplace_admin() then
    raise exception 'Marketplace administrator permission required';
  end if;

  if p_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Unsupported review decision';
  end if;

  if p_decision <> 'approved' and char_length(coalesce(v_note, '')) < 5 then
    raise exception 'A review comment of at least 5 characters is required';
  end if;

  select * into v_product
  from catalog.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if v_product.status <> 'pending_review' then
    raise exception 'Only products awaiting review can be reviewed';
  end if;

  update catalog.products
  set status = p_decision,
      review_notes = v_note,
      reviewed_at = now()
  where id = p_product_id;

  insert into catalog.product_review_notes
    (product_id, review_notes, updated_at)
  values
    (p_product_id, v_note, now())
  on conflict (product_id) do update
    set review_notes = excluded.review_notes,
        updated_at = excluded.updated_at;

  insert into catalog.product_submission_review_history
    (product_id, reviewer_id, decision, comment)
  values
    (p_product_id, auth.uid(), p_decision, v_note);
end;
$function$;

revoke all on function public.review_seller_product_submission(uuid, text, text) from public, anon;
grant execute on function public.review_seller_product_submission(uuid, text, text) to authenticated;
