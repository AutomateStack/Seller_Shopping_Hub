
-- Drop the permissive user update policy
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;

-- Only admins and service-role (edge functions) can update wallets
CREATE POLICY "Only admins can update wallets"
ON public.wallets
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
