-- Shipping and tax data required for Delhivery parcel creation.
alter table catalog.products
  add column if not exists hsn_code text,
  add column if not exists shipping_weight_grams integer,
  add column if not exists package_length_cm numeric(10,2),
  add column if not exists package_breadth_cm numeric(10,2),
  add column if not exists package_height_cm numeric(10,2);

alter table catalog.products
  add constraint products_hsn_code_format_chk check (hsn_code is null or hsn_code ~ '^[0-9]{4,8}$'),
  add constraint products_shipping_weight_positive_chk check (shipping_weight_grams is null or shipping_weight_grams > 0),
  add constraint products_package_dimensions_positive_chk check (
    (package_length_cm is null or package_length_cm > 0)
    and (package_breadth_cm is null or package_breadth_cm > 0)
    and (package_height_cm is null or package_height_cm > 0)
  );

alter table orders.marketplace_order_items
  add column if not exists hsn_code text,
  add column if not exists seller_gstin text,
  add column if not exists shipping_weight_grams integer,
  add column if not exists package_length_cm numeric(10,2),
  add column if not exists package_breadth_cm numeric(10,2),
  add column if not exists package_height_cm numeric(10,2);

create or replace function orders.snapshot_order_item_shipping_details()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.product_id is not null then
    select p.hsn_code,p.shipping_weight_grams,p.package_length_cm,p.package_breadth_cm,p.package_height_cm,sp.gstin
      into new.hsn_code,new.shipping_weight_grams,new.package_length_cm,new.package_breadth_cm,new.package_height_cm,new.seller_gstin
    from catalog.products p join seller.seller_profiles sp on sp.id=p.seller_id
    where p.id=new.product_id and p.seller_id=new.seller_id;
  end if;
  return new;
end;
$$;
drop trigger if exists marketplace_order_items_shipping_snapshot on orders.marketplace_order_items;
create trigger marketplace_order_items_shipping_snapshot before insert on orders.marketplace_order_items
for each row execute function orders.snapshot_order_item_shipping_details();

comment on column catalog.products.hsn_code is 'GST HSN code used for shipping and tax documentation.';
comment on column catalog.products.shipping_weight_grams is 'Actual packed shipping weight in grams.';
comment on column catalog.products.package_length_cm is 'Packed parcel length in centimetres.';
comment on column catalog.products.package_breadth_cm is 'Packed parcel breadth in centimetres.';
comment on column catalog.products.package_height_cm is 'Packed parcel height in centimetres.';
comment on column orders.marketplace_order_items.seller_gstin is 'Seller GSTIN snapshot at order placement.';

-- Include shipping and tax attributes in seller product revision submissions and admin approvals.
create or replace function public.submit_seller_product_revision(
  p_product_id uuid, p_proposed_data jsonb, p_change_summary text
) returns catalog.product_revisions
language plpgsql security definer
set search_path = 'pg_catalog','public','catalog','seller','audit'
as $function$
declare
  v_product catalog.products%rowtype;
  v_revision catalog.product_revisions%rowtype;
  v_previous jsonb;
  v_proposed jsonb;
  v_revision_number integer;
  v_image_urls text[];
  v_old_pending uuid;
  v_hsn text;
  v_weight integer;
  v_length numeric(10,2);
  v_breadth numeric(10,2);
  v_height numeric(10,2);
begin
  if auth.uid() is null then raise exception 'Sign in to edit your listing'; end if;
  if jsonb_typeof(p_proposed_data) <> 'object' then raise exception 'Product revision data must be an object'; end if;
  if char_length(btrim(coalesce(p_change_summary,''))) not between 5 and 1500 then raise exception 'Describe the changes in at least 5 characters'; end if;
  select p.* into v_product from catalog.products p join seller.seller_profiles sp on sp.id=p.seller_id
  where p.id=p_product_id and sp.user_id=auth.uid() and sp.onboarding_status='approved' and sp.account_status='active'
  for update of p;
  if not found then raise exception 'Listing not found or you do not have permission to edit it'; end if;
  if v_product.status not in ('approved','paused') then raise exception 'Only approved or paused listings can submit a detail revision'; end if;
  if jsonb_typeof(p_proposed_data->'image_urls') is distinct from 'array' then raise exception 'Product images must be provided as an array'; end if;
  select coalesce(array_agg(value),'{}'::text[]) into v_image_urls from jsonb_array_elements_text(p_proposed_data->'image_urls') as t(value);
  v_hsn := nullif(btrim(coalesce(p_proposed_data->>'hsn_code','')),'');
  v_weight := nullif(p_proposed_data->>'shipping_weight_grams','')::integer;
  v_length := nullif(p_proposed_data->>'package_length_cm','')::numeric;
  v_breadth := nullif(p_proposed_data->>'package_breadth_cm','')::numeric;
  v_height := nullif(p_proposed_data->>'package_height_cm','')::numeric;
  if char_length(btrim(coalesce(p_proposed_data->>'title',''))) not between 3 and 160
    or char_length(btrim(coalesce(p_proposed_data->>'category','')))=0
    or (p_proposed_data->>'price')::numeric<=0
    or (nullif(p_proposed_data->>'mrp','') is not null and (p_proposed_data->>'mrp')::numeric<(p_proposed_data->>'price')::numeric)
    or cardinality(v_image_urls)>5 or (v_hsn is not null and v_hsn !~ '^[0-9]{4,8}$')
    or (v_weight is not null and v_weight<=0) or (v_length is not null and v_length<=0)
    or (v_breadth is not null and v_breadth<=0) or (v_height is not null and v_height<=0)
  then raise exception 'Check product name, category, prices, HSN, package measurements and image count'; end if;
  v_previous := jsonb_build_object('title',v_product.title,'description',v_product.description,'category',v_product.category,
    'brand',v_product.brand,'sku',v_product.sku,'price',v_product.price,'mrp',v_product.mrp,'image_urls',to_jsonb(v_product.image_urls),
    'hsn_code',v_product.hsn_code,'shipping_weight_grams',v_product.shipping_weight_grams,
    'package_length_cm',v_product.package_length_cm,'package_breadth_cm',v_product.package_breadth_cm,'package_height_cm',v_product.package_height_cm);
  v_proposed := jsonb_build_object('title',btrim(p_proposed_data->>'title'),'description',coalesce(p_proposed_data->>'description',''),
    'category',btrim(p_proposed_data->>'category'),'brand',coalesce(btrim(p_proposed_data->>'brand'),''),'sku',nullif(btrim(coalesce(p_proposed_data->>'sku','')),''),
    'price',(p_proposed_data->>'price')::numeric,'mrp',nullif(p_proposed_data->>'mrp','')::numeric,'image_urls',to_jsonb(v_image_urls),
    'hsn_code',v_hsn,'shipping_weight_grams',v_weight,'package_length_cm',v_length,'package_breadth_cm',v_breadth,'package_height_cm',v_height);
  if v_previous=v_proposed then raise exception 'No product detail changes to submit'; end if;
  update catalog.product_revisions set review_status='superseded',reviewed_by=auth.uid(),reviewed_at=now(),
    review_comment='Superseded by a newer seller submission'
  where product_id=p_product_id and review_status='pending_review' returning id into v_old_pending;
  if v_old_pending is not null then
    insert into audit.product_review_events(revision_id,product_id,seller_id,actor_id,actor_role,action,previous_status,new_status,comment,changes)
    select id,product_id,seller_id,auth.uid(),'seller','superseded','pending_review','superseded','Superseded by a newer seller submission',
      jsonb_build_object('superseded_by_new_submission',true) from catalog.product_revisions where id=v_old_pending;
  end if;
  select coalesce(max(revision_number),0)+1 into v_revision_number from catalog.product_revisions where product_id=p_product_id;
  insert into catalog.product_revisions(product_id,seller_id,revision_number,previous_data,proposed_data,seller_change_summary,submitted_by)
  values(p_product_id,v_product.seller_id,v_revision_number,v_previous,v_proposed,btrim(p_change_summary),auth.uid()) returning * into v_revision;
  insert into audit.product_review_events(revision_id,product_id,seller_id,actor_id,actor_role,action,previous_status,new_status,comment,changes)
  values(v_revision.id,p_product_id,v_product.seller_id,auth.uid(),'seller','submitted','pending_review','pending_review',btrim(p_change_summary),
    jsonb_build_object('previous_data',v_previous,'proposed_data',v_proposed));
  return v_revision;
end;
$function$;

create or replace function public.review_seller_product_revision(
  p_revision_id uuid,p_decision text,p_comment text default null
) returns catalog.product_revisions
language plpgsql security definer
set search_path = 'pg_catalog','public','catalog','seller','audit'
as $function$
declare
  v_revision catalog.product_revisions%rowtype;
  v_product catalog.products%rowtype;
  v_seller_user_id uuid;
begin
  if auth.uid() is null or not public.is_current_marketplace_admin() then raise exception 'Marketplace administrator permission required'; end if;
  if p_decision not in ('approved','changes_requested','rejected') then raise exception 'Unsupported review decision'; end if;
  if p_decision<>'approved' and char_length(btrim(coalesce(p_comment,'')))<5 then raise exception 'A review comment of at least 5 characters is required'; end if;
  select * into v_revision from catalog.product_revisions where id=p_revision_id;
  if not found then raise exception 'Product revision not found'; end if;
  select * into v_product from catalog.products where id=v_revision.product_id for update;
  if not found then raise exception 'Product not found'; end if;
  select * into v_revision from catalog.product_revisions where id=p_revision_id for update;
  if v_revision.review_status<>'pending_review' then raise exception 'This revision has already been reviewed or superseded'; end if;
  if p_decision='approved' then
    update catalog.products set title=v_revision.proposed_data->>'title',description=coalesce(v_revision.proposed_data->>'description',''),
      category=v_revision.proposed_data->>'category',brand=coalesce(v_revision.proposed_data->>'brand',''),
      sku=nullif(v_revision.proposed_data->>'sku',''),price=(v_revision.proposed_data->>'price')::numeric,
      mrp=nullif(v_revision.proposed_data->>'mrp','')::numeric,
      image_urls=array(select jsonb_array_elements_text(v_revision.proposed_data->'image_urls')),
      hsn_code=nullif(v_revision.proposed_data->>'hsn_code',''),
      shipping_weight_grams=nullif(v_revision.proposed_data->>'shipping_weight_grams','')::integer,
      package_length_cm=nullif(v_revision.proposed_data->>'package_length_cm','')::numeric,
      package_breadth_cm=nullif(v_revision.proposed_data->>'package_breadth_cm','')::numeric,
      package_height_cm=nullif(v_revision.proposed_data->>'package_height_cm','')::numeric,
      updated_at=now(),reviewed_at=now() where id=v_product.id;
  end if;
  update catalog.product_revisions set review_status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),
    review_comment=nullif(btrim(coalesce(p_comment,'')),'') where id=p_revision_id returning * into v_revision;
  insert into audit.product_review_events(revision_id,product_id,seller_id,actor_id,actor_role,action,previous_status,new_status,comment,changes)
  values(v_revision.id,v_revision.product_id,v_revision.seller_id,auth.uid(),'admin',p_decision,'pending_review',p_decision,
    nullif(btrim(coalesce(p_comment,'')),''),jsonb_build_object('previous_data',v_revision.previous_data,'proposed_data',v_revision.proposed_data));
  select user_id into v_seller_user_id from seller.seller_profiles where id=v_revision.seller_id;
  insert into seller.product_review_notifications(user_id,revision_id,title,body,payload)
  values(v_seller_user_id,v_revision.id,
    case p_decision when 'approved' then 'Product changes approved' when 'changes_requested' then 'Product changes requested' else 'Product revision rejected' end,
    case p_decision when 'approved' then 'Your submitted product changes were approved.'
      when 'changes_requested' then coalesce(nullif(btrim(p_comment),''),'Please review the admin feedback and resubmit your changes.')
      else coalesce(nullif(btrim(p_comment),''),'Your submitted product revision was rejected.') end,
    jsonb_build_object('product_id',v_revision.product_id,'revision_id',v_revision.id,'decision',p_decision,'comment',nullif(btrim(coalesce(p_comment,'')),'')));
  return v_revision;
end;
$function$;
