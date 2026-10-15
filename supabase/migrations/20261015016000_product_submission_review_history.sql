-- Preserve every initial product submission review decision, not only the latest note.
create table if not exists catalog.product_submission_review_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references catalog.products(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved','changes_requested','rejected')),
  comment text,
  reviewed_at timestamptz not null default now()
);

create index if not exists product_submission_review_history_product_reviewed_idx
  on catalog.product_submission_review_history(product_id, reviewed_at desc);

alter table catalog.product_submission_review_history enable row level security;
revoke all on catalog.product_submission_review_history from anon, public;
revoke insert, update, delete, truncate, references, trigger
  on catalog.product_submission_review_history from authenticated, anon, public;
grant select on catalog.product_submission_review_history to authenticated;

drop policy if exists "Admins can read product submission review history"
  on catalog.product_submission_review_history;
create policy "Admins can read product submission review history"
  on catalog.product_submission_review_history for select to authenticated
  using (public.is_current_marketplace_admin());

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
