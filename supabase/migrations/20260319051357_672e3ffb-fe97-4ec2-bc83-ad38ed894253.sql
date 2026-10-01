
-- Drop the overly permissive insert policy
DROP POLICY "System can insert status history" ON public.order_status_history;

-- The trigger function uses SECURITY DEFINER which bypasses RLS, so no INSERT policy needed for the trigger.
-- Only admins should be able to manually insert if needed.
CREATE POLICY "Admins can insert status history" ON public.order_status_history
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
