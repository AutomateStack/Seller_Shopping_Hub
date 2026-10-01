ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS tracking_number text,
ADD COLUMN IF NOT EXISTS estimated_delivery_date date,
ADD COLUMN IF NOT EXISTS shipping_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0;