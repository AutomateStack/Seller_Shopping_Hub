CREATE OR REPLACE VIEW seller.public_seller_profiles
WITH (security_barrier = true)
AS
SELECT
  id,
  store_name,
  business_name,
  profile_photo_url
FROM seller.seller_profiles;

GRANT USAGE ON SCHEMA seller TO anon, authenticated;
GRANT SELECT ON seller.public_seller_profiles TO anon, authenticated;
