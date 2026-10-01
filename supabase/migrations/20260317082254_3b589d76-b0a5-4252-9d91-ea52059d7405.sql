
-- Product images table for multi-image gallery
CREATE TABLE public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  alt_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product variants table for size/color options
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL, -- e.g. 'size', 'color'
  variant_value TEXT NOT NULL,
  price_adjustment NUMERIC NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for product_images
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product images"
  ON public.product_images FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert product images"
  ON public.product_images FOR INSERT
  TO public
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update product images"
  ON public.product_images FOR UPDATE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete product images"
  ON public.product_images FOR DELETE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for product_variants
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product variants"
  ON public.product_variants FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert product variants"
  ON public.product_variants FOR INSERT
  TO public
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update product variants"
  ON public.product_variants FOR UPDATE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete product variants"
  ON public.product_variants FOR DELETE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
