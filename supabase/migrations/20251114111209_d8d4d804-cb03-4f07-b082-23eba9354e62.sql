-- Secure orders INSERT policies: no anonymous inserts
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;

-- Allow admins to insert any orders
CREATE POLICY "Admins can insert orders"
ON public.orders
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow authenticated users to insert their own orders only
CREATE POLICY "Users can insert own orders"
ON public.orders
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id IS NOT NULL
  AND auth.uid() = user_id
);
