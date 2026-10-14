-- Add immutable product revisions and review audit history.
-- This migration is additive: it does not rewrite existing approved product data.

create table if not exists catalog.product_revisions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references catalog.products(id) on delete restrict,
  seller_id uuid not null references seller.seller_profiles(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  previous_data jsonb not null,
  proposed_data jsonb not null,
  seller_change_summary text not null check (char_length(btrim(seller_change_summary)) between 5 and 1500),
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review','approved','changes_requested','rejected','superseded')),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  unique (product_id, revision_number)
);

create unique index if not exists product_revisions_one_pending_per_product_idx
  on catalog.product_revisions(product_id) where review_status = 'pending_review';

create index if not exists product_revisions_product_submitted_idx
  on catalog.product_revisions(product_id, submitted_at desc);
create index if not exists product_revisions_status_submitted_idx
  on catalog.product_revisions(review_status, submitted_at desc);
create index if not exists product_revisions_seller_submitted_idx
  on catalog.product_revisions(seller_id, submitted_at desc);

create table if not exists audit.product_review_events (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references catalog.product_revisions(id) on delete restrict,
  product_id uuid not null references catalog.products(id) on delete restrict,
  seller_id uuid not null references seller.seller_profiles(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  actor_role text not null check (actor_role in ('seller','admin','system')),
  action text not null check (action in ('submitted','approved','changes_requested','rejected','superseded')),
  previous_status text,
  new_status text not null,
  comment text,
  changes jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists product_review_events_revision_created_idx
  on audit.product_review_events(revision_id, created_at desc);
create index if not exists product_review_events_product_created_idx
  on audit.product_review_events(product_id, created_at desc);

create table if not exists seller.product_review_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  revision_id uuid not null references catalog.product_revisions(id) on delete restrict,
  notification_type text not null default 'product_review',
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists product_review_notifications_user_created_idx
  on seller.product_review_notifications(user_id, created_at desc);

grant usage on schema catalog, audit, seller to authenticated;
alter table catalog.product_revisions enable row level security;
alter table audit.product_review_events enable row level security;
alter table seller.product_review_notifications enable row level security;

drop policy if exists "Sellers and admins can read product revisions" on catalog.product_revisions;
create policy "Sellers and admins can read product revisions"
  on catalog.product_revisions for select to authenticated
  using (
    public.is_current_marketplace_admin()
    or exists (
      select 1 from seller.seller_profiles sp
      where sp.id = product_revisions.seller_id and sp.user_id = auth.uid()
    )
  );

drop policy if exists "Sellers and admins can read product review events" on audit.product_review_events;
create policy "Sellers and admins can read product review events"
  on audit.product_review_events for select to authenticated
  using (
    public.is_current_marketplace_admin()
    or exists (
      select 1 from seller.seller_profiles sp
      where sp.id = product_review_events.seller_id and sp.user_id = auth.uid()
    )
  );

drop policy if exists "Sellers can read their product review notifications" on seller.product_review_notifications;
create policy "Sellers can read their product review notifications"
  on seller.product_review_notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Sellers can mark their product review notifications read" on seller.product_review_notifications;
create policy "Sellers can mark their product review notifications read"
  on seller.product_review_notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function audit.prevent_product_review_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Product review audit events are immutable';
end;
$$;

drop trigger if exists product_review_events_immutable on audit.product_review_events;
create trigger product_review_events_immutable
  before update or delete on audit.product_review_events
  for each row execute function audit.prevent_product_review_event_mutation();

revoke all on catalog.product_revisions from anon, public;
revoke all on audit.product_review_events from anon, public;
revoke all on seller.product_review_notifications from anon, public;
grant select on catalog.product_revisions to authenticated;
grant select on audit.product_review_events to authenticated;
grant select on seller.product_review_notifications to authenticated;
grant update (read_at) on seller.product_review_notifications to authenticated;

create or replace function public.submit_seller_product_revision(
  p_product_id uuid,
  p_proposed_data jsonb,
  p_change_summary text
)
returns catalog.product_revisions
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'catalog', 'seller', 'audit'
as $function$
declare
  v_product catalog.products%rowtype;
  v_revision catalog.product_revisions%rowtype;
  v_previous jsonb;
  v_proposed jsonb;
  v_revision_number integer;
  v_image_urls text[];
  v_price numeric;
  v_mrp numeric;
  v_title text;
  v_description text;
  v_category text;
  v_brand text;
  v_sku text;
  v_old_pending uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to edit your listing'; end if;
  if jsonb_typeof(p_proposed_data) <> 'object' then raise exception 'Product revision data must be an object'; end if;
  if char_length(btrim(coalesce(p_change_summary, ''))) not between 5 and 1500 then
    raise exception 'Describe the changes in at least 5 characters';
  end if;

  select p.* into v_product
  from catalog.products p
  join seller.seller_profiles sp on sp.id = p.seller_id
  where p.id = p_product_id
    and sp.user_id = auth.uid()
    and sp.onboarding_status = 'approved'
    and sp.account_status = 'active'
  for update of p;

  if not found then raise exception 'Listing not found or you do not have permission to edit it'; end if;
  if v_product.status not in ('approved','paused') then
    raise exception 'Only approved or paused listings can submit a detail revision';
  end if;

  v_title := btrim(coalesce(p_proposed_data->>'title',''));
  v_description := coalesce(p_proposed_data->>'description','');
  v_category := btrim(coalesce(p_proposed_data->>'category',''));
  v_brand := btrim(coalesce(p_proposed_data->>'brand',''));
  v_sku := nullif(btrim(coalesce(p_proposed_data->>'sku','')),'');
  v_price := (p_proposed_data->>'price')::numeric;
  v_mrp := nullif(p_proposed_data->>'mrp','')::numeric;

  if jsonb_typeof(p_proposed_data->'image_urls') is distinct from 'array' then
    raise exception 'Product images must be provided as an array';
  end if;
  select coalesce(array_agg(value), '{}'::text[]) into v_image_urls
  from jsonb_array_elements_text(p_proposed_data->'image_urls') as t(value);

  if char_length(v_title) not between 3 and 160
     or char_length(v_category) = 0
     or v_price is null or v_price <= 0
     or (v_mrp is not null and v_mrp < v_price)
     or cardinality(v_image_urls) > 5 then
    raise exception 'Check product name, category, prices, and image count';
  end if;

  v_previous := jsonb_build_object(
    'title',v_product.title,'description',v_product.description,'category',v_product.category,
    'brand',v_product.brand,'sku',v_product.sku,'price',v_product.price,'mrp',v_product.mrp,
    'image_urls',to_jsonb(v_product.image_urls)
  );
  v_proposed := jsonb_build_object(
    'title',v_title,'description',v_description,'category',v_category,'brand',v_brand,
    'sku',v_sku,'price',v_price,'mrp',v_mrp,'image_urls',to_jsonb(v_image_urls)
  );

  if v_previous = v_proposed then
    raise exception 'No product detail changes to submit';
  end if;

  update catalog.product_revisions
    set review_status = 'superseded',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_comment = 'Superseded by a newer seller submission'
    where product_id = p_product_id and review_status = 'pending_review'
    returning id into v_old_pending;

  if v_old_pending is not null then
    insert into audit.product_review_events
      (revision_id,product_id,seller_id,actor_id,actor_role,action,previous_status,new_status,comment,changes)
    select id,product_id,seller_id,auth.uid(),'seller','superseded','pending_review','superseded',
           'Superseded by a newer seller submission',jsonb_build_object('superseded_by_new_submission',true)
    from catalog.product_revisions where id = v_old_pending;
  end if;

  select coalesce(max(revision_number),0)+1 into v_revision_number
    from catalog.product_revisions where product_id = p_product_id;

  insert into catalog.product_revisions
    (product_id,seller_id,revision_number,previous_data,proposed_data,seller_change_summary,submitted_by)
  values
    (p_product_id,v_product.seller_id,v_revision_number,v_previous,v_proposed,btrim(p_change_summary),auth.uid())
  returning * into v_revision;

  insert into audit.product_review_events
    (revision_id,product_id,seller_id,actor_id,actor_role,action,previous_status,new_status,comment,changes)
  values
    (v_revision.id,p_product_id,v_product.seller_id,auth.uid(),'seller','submitted',
     'pending_review',
     'pending_review',btrim(p_change_summary),
     jsonb_build_object('previous_data',v_previous,'proposed_data',v_proposed));

  return v_revision;
end;
$function$;

create or replace function public.review_seller_product_revision(
  p_revision_id uuid,
  p_decision text,
  p_comment text default null
)
returns catalog.product_revisions
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'catalog', 'seller', 'audit'
as $function$
declare
  v_revision catalog.product_revisions%rowtype;
  v_product catalog.products%rowtype;
  v_seller_user_id uuid;
  v_next_status text;
begin
  if auth.uid() is null or not public.is_current_marketplace_admin() then
    raise exception 'Marketplace administrator permission required';
  end if;
  if p_decision not in ('approved','changes_requested','rejected') then
    raise exception 'Unsupported review decision';
  end if;
  if p_decision <> 'approved' and char_length(btrim(coalesce(p_comment,''))) < 5 then
    raise exception 'A review comment of at least 5 characters is required';
  end if;

  -- Lock in the same order as seller submission (product, then revision) to avoid deadlocks.
  select * into v_revision from catalog.product_revisions where id = p_revision_id;
  if not found then raise exception 'Product revision not found'; end if;

  select * into v_product from catalog.products where id=v_revision.product_id for update;
  if not found then raise exception 'Product not found'; end if;

  select * into v_revision from catalog.product_revisions
    where id = p_revision_id for update;
  if not found or v_revision.review_status <> 'pending_review' then
    raise exception 'This revision has already been reviewed or superseded';
  end if;

  if p_decision = 'approved' then
    update catalog.products
      set title = v_revision.proposed_data->>'title',
          description = coalesce(v_revision.proposed_data->>'description',''),
          category = v_revision.proposed_data->>'category',
          brand = coalesce(v_revision.proposed_data->>'brand',''),
          sku = nullif(v_revision.proposed_data->>'sku',''),
          price = (v_revision.proposed_data->>'price')::numeric,
          mrp = nullif(v_revision.proposed_data->>'mrp','')::numeric,
          image_urls = array(select jsonb_array_elements_text(v_revision.proposed_data->'image_urls')),
          updated_at = now(),
          reviewed_at = now()
      where id=v_product.id;
  end if;

  update catalog.product_revisions
    set review_status=p_decision, reviewed_by=auth.uid(), reviewed_at=now(),
        review_comment=nullif(btrim(coalesce(p_comment,'')),'')
    where id=p_revision_id
    returning * into v_revision;

  insert into audit.product_review_events
    (revision_id,product_id,seller_id,actor_id,actor_role,action,previous_status,new_status,comment,changes)
  values
    (v_revision.id,v_revision.product_id,v_revision.seller_id,auth.uid(),'admin',p_decision,
     'pending_review',p_decision,nullif(btrim(coalesce(p_comment,'')),''),
     jsonb_build_object('previous_data',v_revision.previous_data,'proposed_data',v_revision.proposed_data));

  select user_id into v_seller_user_id from seller.seller_profiles where id=v_revision.seller_id;
  insert into seller.product_review_notifications
    (user_id,revision_id,title,body,payload)
  values
    (v_seller_user_id,v_revision.id,
     case p_decision when 'approved' then 'Product changes approved'
       when 'changes_requested' then 'Product changes requested' else 'Product revision rejected' end,
     case p_decision when 'approved' then 'Your submitted product changes were approved.'
       when 'changes_requested' then coalesce(nullif(btrim(p_comment),''),'Please review the admin feedback and resubmit your changes.')
       else coalesce(nullif(btrim(p_comment),''),'Your submitted product revision was rejected.') end,
     jsonb_build_object('product_id',v_revision.product_id,'revision_id',v_revision.id,'decision',p_decision,'comment',nullif(btrim(coalesce(p_comment,'')),'')));

  return v_revision;
end;
$function$;

revoke all on function public.submit_seller_product_revision(uuid,jsonb,text) from public, anon;
grant execute on function public.submit_seller_product_revision(uuid,jsonb,text) to authenticated;
revoke all on function public.review_seller_product_revision(uuid,text,text) from public, anon;
grant execute on function public.review_seller_product_revision(uuid,text,text) to authenticated;
