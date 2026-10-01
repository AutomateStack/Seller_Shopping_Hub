-- Drop existing SELECT policies on orders table
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view own orders" ON public.orders;

-- Create new, more secure SELECT policies

-- Policy 1: Admins can view all orders (including guest orders)
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy 2: Authenticated users can only view their own orders (not guest orders)
CREATE POLICY "Users can view own orders only"
ON public.orders
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND user_id IS NOT NULL 
  AND auth.uid() = user_id
);

-- Note: Guest orders (where user_id IS NULL) are now only accessible by admins
-- This prevents unauthorized users from accessing sensitive guest customer information