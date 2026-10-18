-- Verified-purchase reviews for seller marketplace catalog products.
create table if not exists catalog.marketplace_product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references catalog.products(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  order_item_id uuid not null references orders.marketplace_order_items(id) on delete cascade,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_product_reviews_one_per_buyer unique (product_id, buyer_id),
  constraint marketplace_product_reviews_one_per_order_item unique (order_item_id)
);

create index if not exists marketplace_product_reviews_product_created_idx
  on catalog.marketplace_product_reviews (product_id, created_at desc);

alter table catalog.marketplace_product_reviews enable row level security;

drop policy if exists "Marketplace product reviews are publicly readable"
  on catalog.marketplace_product_reviews;
create policy "Marketplace product reviews are publicly readable"
  on catalog.marketplace_product_reviews for select
  to anon, authenticated
  using (true);

grant usage on schema catalog to anon, authenticated;
grant select on catalog.marketplace_product_reviews to anon, authenticated;

create or replace function catalog.can_review_marketplace_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, catalog, orders
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from orders.marketplace_orders o
      join orders.marketplace_order_items oi on oi.order_id = o.id
      where o.buyer_id = auth.uid()
        and o.status = 'delivered'
        and oi.product_id = p_product_id
    )
    and not exists (
      select 1 from catalog.marketplace_product_reviews r
      where r.product_id = p_product_id and r.buyer_id = auth.uid()
    );
$$;

create or replace function catalog.submit_marketplace_product_review(
  p_product_id uuid,
  p_rating integer,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, catalog, orders
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_item_id uuid;
  v_reviewer_name text;
  v_review_id uuid;
begin
  if v_user_id is null then
    raise exception 'Please sign in to review this product.';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Choose a rating from 1 to 5 stars.';
  end if;

  select oi.id into v_order_item_id
  from orders.marketplace_orders o
  join orders.marketplace_order_items oi on oi.order_id = o.id
  where o.buyer_id = v_user_id
    and o.status = 'delivered'
    and oi.product_id = p_product_id
  order by o.created_at desc
  limit 1;

  if v_order_item_id is null then
    raise exception 'Only customers with a delivered order can review this product.';
  end if;

  if exists (
    select 1 from catalog.marketplace_product_reviews r
    where r.product_id = p_product_id and r.buyer_id = v_user_id
  ) then
    raise exception 'You have already reviewed this product.';
  end if;

  select coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''),
    'Customer'
  ) into v_reviewer_name;

  insert into catalog.marketplace_product_reviews
    (product_id, buyer_id, order_item_id, reviewer_name, rating, comment)
  values
    (p_product_id, v_user_id, v_order_item_id, v_reviewer_name, p_rating, nullif(btrim(p_comment), ''))
  returning id into v_review_id;

  return v_review_id;
end;
$$;

grant execute on function catalog.can_review_marketplace_product(uuid) to authenticated;
grant execute on function catalog.submit_marketplace_product_review(uuid, integer, text) to authenticated;
