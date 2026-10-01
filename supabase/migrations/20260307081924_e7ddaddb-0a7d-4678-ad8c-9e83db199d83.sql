
-- Create coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  min_order_amount numeric DEFAULT 0,
  max_discount_amount numeric,
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Anyone can read active coupons (needed for coupon validation at checkout)
CREATE POLICY "Anyone can view active coupons"
ON public.coupons FOR SELECT
USING (true);

-- Only admins can insert/update/delete coupons
CREATE POLICY "Admins can insert coupons"
ON public.coupons FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update coupons"
ON public.coupons FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete coupons"
ON public.coupons FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add coupon tracking columns to orders table
ALTER TABLE public.orders ADD COLUMN coupon_code text;
ALTER TABLE public.orders ADD COLUMN discount_amount numeric DEFAULT 0;
