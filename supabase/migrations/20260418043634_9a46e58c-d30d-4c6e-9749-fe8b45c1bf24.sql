-- Tighten newsletter_subscribers INSERT policy: validate email format and length
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe with valid email"
ON public.newsletter_subscribers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(email) BETWEEN 5 AND 255
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- Tighten stock_notifications INSERT policy: validate email + product exists, and require user_id match if authenticated
DROP POLICY IF EXISTS "Anyone can subscribe to stock notifications" ON public.stock_notifications;
CREATE POLICY "Anyone can subscribe to stock with valid email"
ON public.stock_notifications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(email) BETWEEN 5 AND 255
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND EXISTS (SELECT 1 FROM public.products WHERE id = stock_notifications.product_id)
  AND (
    -- Anonymous users must not set a user_id
    (auth.uid() IS NULL AND user_id IS NULL)
    OR
    -- Authenticated users must set their own user_id
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
  )
);

-- Restrict storage bucket listing on product-images: scope public SELECT to actual file reads
-- The current "Public can read product image objects" policy with USING (bucket_id = 'product-images')
-- already allows listing. We restrict listing by limiting to a known prefix structure used by the app
-- (products/* and blog/*) which prevents enumeration of unrelated paths but still allows direct reads.
-- Note: Supabase public buckets allow direct URL access regardless; the goal is to prevent LIST API enumeration.
DROP POLICY IF EXISTS "Public can read product image objects" ON storage.objects;
CREATE POLICY "Public can read product image objects"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'product-images'
  AND (
    (storage.foldername(name))[1] = 'products'
    OR (storage.foldername(name))[1] = 'blog'
  )
);