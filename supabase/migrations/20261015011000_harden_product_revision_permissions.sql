-- Keep revision snapshots read-only to clients; only SECURITY DEFINER workflow RPCs mutate review state.
revoke insert, update, delete, truncate, references, trigger on catalog.product_revisions from authenticated, anon, public;
revoke insert, update, delete, truncate, references, trigger on audit.product_review_events from authenticated, anon, public;
revoke insert, update, delete, truncate, references, trigger on seller.product_review_notifications from authenticated, anon, public;
grant select on catalog.product_revisions to authenticated;
grant select on audit.product_review_events to authenticated;
grant select on seller.product_review_notifications to authenticated;
grant update (read_at) on seller.product_review_notifications to authenticated;

-- Audit records are append-only. The only permitted writes are performed inside trusted server-side workflow functions.
