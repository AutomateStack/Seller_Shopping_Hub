-- Store quantity-based pricing tiers as JSON so product, cart, and checkout
-- flows use the same schema contract.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS volume_tiers JSONB;

NOTIFY pgrst, 'reload schema';