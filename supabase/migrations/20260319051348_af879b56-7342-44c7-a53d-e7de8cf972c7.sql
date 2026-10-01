
-- Create order status history table
CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changed_by uuid
);

-- Enable RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Policies: admins can see all, users can see own order history
CREATE POLICY "Admins can view all status history" ON public.order_status_history
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own order status history" ON public.order_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid()
  ));

-- Allow inserts from trigger (service role) and admins
CREATE POLICY "System can insert status history" ON public.order_status_history
  FOR INSERT WITH CHECK (true);

-- Trigger function to auto-log status changes
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
CREATE TRIGGER on_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();

-- Backfill: insert initial "order placed" entry for all existing orders
INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_at)
SELECT id, NULL, status::text, created_at
FROM public.orders;
