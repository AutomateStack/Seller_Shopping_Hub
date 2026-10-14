-- Index foreign keys used by revision/audit reads and actor history.
create index if not exists product_revisions_submitted_by_idx
  on catalog.product_revisions(submitted_by);
create index if not exists product_revisions_reviewed_by_idx
  on catalog.product_revisions(reviewed_by) where reviewed_by is not null;
create index if not exists product_review_events_actor_idx
  on audit.product_review_events(actor_id) where actor_id is not null;
create index if not exists product_review_events_seller_idx
  on audit.product_review_events(seller_id);
create index if not exists product_review_notifications_revision_idx
  on seller.product_review_notifications(revision_id);

-- Avoid evaluating auth.uid() once per row in ownership predicates.
drop policy if exists "Sellers and admins can read product revisions" on catalog.product_revisions;
create policy "Sellers and admins can read product revisions"
  on catalog.product_revisions for select to authenticated
  using (
    public.is_current_marketplace_admin()
    or exists (
      select 1 from seller.seller_profiles sp
      where sp.id = product_revisions.seller_id and sp.user_id = (select auth.uid())
    )
  );

drop policy if exists "Sellers and admins can read product review events" on audit.product_review_events;
create policy "Sellers and admins can read product review events"
  on audit.product_review_events for select to authenticated
  using (
    public.is_current_marketplace_admin()
    or exists (
      select 1 from seller.seller_profiles sp
      where sp.id = product_review_events.seller_id and sp.user_id = (select auth.uid())
    )
  );

drop policy if exists "Sellers can read their product review notifications" on seller.product_review_notifications;
create policy "Sellers can read their product review notifications"
  on seller.product_review_notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Sellers can mark their product review notifications read" on seller.product_review_notifications;
create policy "Sellers can mark their product review notifications read"
  on seller.product_review_notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
