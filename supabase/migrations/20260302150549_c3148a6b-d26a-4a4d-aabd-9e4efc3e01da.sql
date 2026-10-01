
-- Fix 1: Update storage policy to allow blog/ folder uploads
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;

CREATE POLICY "Admins can upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    (storage.foldername(name))[1] = 'products'
    OR (storage.foldername(name))[1] = 'blog'
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 2: Add stock non-negative constraint
ALTER TABLE public.products ADD CONSTRAINT stock_non_negative CHECK (stock >= 0);
