-- Preserve the latest available legacy review snapshot without inventing a reviewer identity.
alter table catalog.product_submission_review_history
  alter column reviewer_id drop not null;

insert into catalog.product_submission_review_history
  (product_id, reviewer_id, decision, comment, reviewed_at)
select
  p.id,
  null,
  p.status,
  n.review_notes,
  p.reviewed_at
from catalog.products p
left join catalog.product_review_notes n on n.product_id = p.id
where p.reviewed_at is not null
  and p.status in ('approved', 'changes_requested', 'rejected')
  and not exists (
    select 1
    from catalog.product_submission_review_history h
    where h.product_id = p.id
  );

notify pgrst, 'reload schema';
