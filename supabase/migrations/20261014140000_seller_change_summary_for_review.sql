alter table catalog.product_review_notes
  add column if not exists seller_change_summary text;

drop function if exists public.update_seller_marketplace_product_details(uuid,text,text,text,text,text,numeric,numeric,text[]);

create function public.update_seller_marketplace_product_details(
  p_product_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_brand text,
  p_sku text,
  p_price numeric,
  p_mrp numeric,
  p_image_urls text[],
  p_change_summary text default null
)
returns catalog.products
language plpgsql
security definer
set search_path = pg_catalog, public, catalog, seller
as $$
declare
  v_product catalog.products%rowtype;
  v_updated catalog.products%rowtype;
  v_major_change boolean;
  v_next_status text;
begin
  if auth.uid() is null then raise exception 'Sign in to edit your listing'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 3 and 160
     or char_length(trim(coalesce(p_category,''))) = 0
     or p_price is null or p_price <= 0
     or (p_mrp is not null and p_mrp < p_price)
     or coalesce(array_length(p_image_urls,1),0) > 5 then
    raise exception 'Check product name, category, prices, and image count';
  end if;
  select p.* into v_product
  from catalog.products p join seller.seller_profiles sp on sp.id=p.seller_id
  where p.id=p_product_id and sp.user_id=auth.uid()
    and sp.onboarding_status='approved' and sp.account_status='active'
  for update of p;
  if not found then raise exception 'Listing not found or you do not have permission to edit it'; end if;
  if v_product.status not in ('approved','paused') then raise exception 'This listing cannot be edited in its current status'; end if;

  v_major_change :=
    v_product.title is distinct from trim(p_title)
    or v_product.category is distinct from trim(p_category)
    or v_product.price is distinct from p_price
    or v_product.mrp is distinct from p_mrp
    or v_product.image_urls is distinct from coalesce(p_image_urls,'{}'::text[]);
  if v_major_change and char_length(trim(coalesce(p_change_summary,''))) < 5 then
    raise exception 'Describe the major changes for admin review';
  end if;
  v_next_status := case when v_major_change then 'pending_review' else v_product.status end;
  update catalog.products
  set title=trim(p_title), description=coalesce(p_description,''),
      category=trim(p_category), brand=coalesce(trim(p_brand),''),
      sku=nullif(trim(coalesce(p_sku,'')),''),
      price=p_price, mrp=p_mrp, image_urls=coalesce(p_image_urls,'{}'::text[]),
      status=v_next_status, updated_at=now()
  where id=p_product_id returning * into v_updated;

  if v_major_change then
    insert into catalog.product_review_notes(product_id,review_notes,seller_change_summary,updated_at)
    values(p_product_id,null,trim(p_change_summary),now())
    on conflict(product_id) do update
      set seller_change_summary=excluded.seller_change_summary, updated_at=now();
  end if;
  return v_updated;
end;
$$;
revoke all on function public.update_seller_marketplace_product_details(uuid,text,text,text,text,text,numeric,numeric,text[],text) from public, anon;
grant execute on function public.update_seller_marketplace_product_details(uuid,text,text,text,text,text,numeric,numeric,text[],text) to authenticated;
