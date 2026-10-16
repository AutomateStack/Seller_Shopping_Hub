-- Super-admin-controlled seller marketplace featuring on the public homepage.
ALTER TABLE catalog.products
  ADD COLUMN IF NOT EXISTS featured_on_home boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION catalog.guard_home_featured_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.featured_on_home IS DISTINCT FROM OLD.featured_on_home
     AND NOT EXISTS (
       SELECT 1
       FROM marketplace.marketplace_admins ma
       WHERE ma.user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Only marketplace administrators can feature seller products on the homepage'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_home_featured_products ON catalog.products;
CREATE TRIGGER guard_home_featured_products
BEFORE UPDATE OF featured_on_home ON catalog.products
FOR EACH ROW EXECUTE FUNCTION catalog.guard_home_featured_products();

CREATE OR REPLACE FUNCTION catalog.set_product_home_featured(
  p_product_id uuid,
  p_featured boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_seller_id uuid;
  v_current boolean;
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM marketplace.marketplace_admins ma
    WHERE ma.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only marketplace administrators can manage homepage features'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.seller_id, p.featured_on_home
    INTO v_seller_id, v_current
  FROM catalog.products p
  WHERE p.id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seller product not found';
  END IF;

  IF p_featured AND NOT v_current THEN
    IF NOT EXISTS (
      SELECT 1 FROM catalog.products p
      WHERE p.id = p_product_id
        AND p.status = 'approved'
        AND p.stock_quantity > 0
        AND COALESCE(array_length(p.image_urls, 1), 0) > 0
    ) THEN
      RAISE EXCEPTION 'Only approved, in-stock products with an image can be featured';
    END IF;

    PERFORM 1 FROM seller.seller_profiles s WHERE s.id = v_seller_id FOR UPDATE;

    SELECT count(*) INTO v_count
    FROM catalog.products p
    WHERE p.seller_id = v_seller_id AND p.featured_on_home = true;

    IF v_count >= 2 THEN
      RAISE EXCEPTION 'Each store can feature up to two products on the homepage';
    END IF;
  END IF;

  UPDATE catalog.products
  SET featured_on_home = p_featured
  WHERE id = p_product_id;
END;
$$;

REVOKE ALL ON FUNCTION catalog.set_product_home_featured(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION catalog.set_product_home_featured(uuid, boolean) TO authenticated;
