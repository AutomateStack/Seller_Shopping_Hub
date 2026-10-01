-- Drop the current policy that allows viewing orders
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

-- Create restricted policy: authenticated users can ONLY view their own orders (not guest orders)
CREATE POLICY "Authenticated users can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

-- Create policy: admins can view all orders (including guest orders)
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);