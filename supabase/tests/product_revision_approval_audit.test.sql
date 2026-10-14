-- Safe smoke assertions for product revision approval infrastructure.
-- Run against a disposable test database after applying migrations; this file does not mutate business rows.
do $$
begin
  if to_regclass('catalog.product_revisions') is null then
    raise exception 'catalog.product_revisions is missing';
  end if;
  if to_regclass('audit.product_review_events') is null then
    raise exception 'audit.product_review_events is missing';
  end if;
  if to_regclass('seller.product_review_notifications') is null then
    raise exception 'seller.product_review_notifications is missing';
  end if;
  if to_regprocedure('public.submit_seller_product_revision(uuid,jsonb,text)') is null then
    raise exception 'submit_seller_product_revision RPC is missing';
  end if;
  if to_regprocedure('public.review_seller_product_revision(uuid,text,text)') is null then
    raise exception 'review_seller_product_revision RPC is missing';
  end if;
  if to_regprocedure('public.list_product_review_events(uuid[])') is null then
    raise exception 'list_product_review_events RPC is missing';
  end if;
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='audit' and c.relname='product_review_events'
      and t.tgname='product_review_events_immutable' and not t.tgisinternal
  ) then
    raise exception 'Immutable audit trigger is missing';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='catalog' and indexname='product_revisions_one_pending_per_product_idx'
  ) then
    raise exception 'One-pending-revision-per-product constraint is missing';
  end if;
end;
$$;
