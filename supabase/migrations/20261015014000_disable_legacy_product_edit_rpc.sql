-- Close the legacy direct-edit RPC so older clients cannot bypass revision approval.
-- Current seller UI now uses submit_seller_product_revision for approved/paused listing details.
revoke all on function public.update_seller_marketplace_product_details(uuid,text,text,text,text,text,numeric,numeric,text[],text) from public, anon, authenticated;
