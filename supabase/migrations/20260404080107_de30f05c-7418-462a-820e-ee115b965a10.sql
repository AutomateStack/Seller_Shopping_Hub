
CREATE TABLE public.stock_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id UUID,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe to stock notifications"
ON public.stock_notifications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view all stock notifications"
ON public.stock_notifications FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own notifications"
ON public.stock_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());
