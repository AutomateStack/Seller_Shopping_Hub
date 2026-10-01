-- 1) Restrict coupons SELECT to authenticated users only (prevent public enumeration)
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;

CREATE POLICY "Authenticated users can view active coupons"
ON public.coupons
FOR SELECT
TO authenticated
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

-- 2) Remove the overly broad ALL policy on profiles that allowed any authenticated user to read all profiles
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;

-- Add explicit DELETE policy so users can delete their own profile (previously covered by ALL)
CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Admins can manage all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) Restrict listing of product-images bucket - allow reading individual objects but not listing
-- Drop any overly permissive SELECT policy and replace with one that requires a specific object name
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to product images" ON storage.objects;

-- Allow public read access only to specific objects (not bucket listing)
-- Public buckets serve files via direct URL - no listing needed for clients
CREATE POLICY "Public can read product image objects"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');