
-- Drop the overly broad permissive policy on orders
DROP POLICY "Require authentication for orders" ON public.orders;

-- Add a permissive policy that ensures authenticated users can only see orders where user_id matches
-- Guest orders (user_id IS NULL) are only accessible to admins
CREATE POLICY "Authenticated users access own or admin all"
ON public.orders
FOR ALL
TO public
USING (
  (auth.uid() IS NOT NULL AND user_id IS NOT NULL AND auth.uid() = user_id)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id IS NOT NULL AND auth.uid() = user_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);
