
-- Fix 1: Profiles - add permissive policy requiring authentication
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Fix 2: Orders - add permissive policy requiring authentication
CREATE POLICY "Require authentication for orders"
ON public.orders
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
