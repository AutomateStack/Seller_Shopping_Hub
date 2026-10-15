-- Ensure seller-facing initial product review feedback has a backing column.
-- Some existing databases were initialized before review_notes was present.
alter table catalog.products
  add column if not exists review_notes text;
