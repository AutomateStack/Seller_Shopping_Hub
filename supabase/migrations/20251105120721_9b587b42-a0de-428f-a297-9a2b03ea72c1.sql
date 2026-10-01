-- Drop the overly permissive policy that allows anyone to insert order items
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;

-- Create restricted policy: authenticated users can only insert items for their own orders
CREATE POLICY "Users can insert items for own orders"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = order_id
    AND user_id = auth.uid()
  )
);

-- Create policy: admins can insert any order items (for order management)
CREATE POLICY "Admins can insert order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);