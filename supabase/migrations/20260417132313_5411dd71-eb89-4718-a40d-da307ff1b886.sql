-- Categories taxonomy
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE INDEX idx_subcategories_category ON public.subcategories(category_id);

-- Link products to subcategory (keep legacy 'category' text column for backwards-compat)
ALTER TABLE public.products
  ADD COLUMN subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL;

CREATE INDEX idx_products_subcategory ON public.products(subcategory_id);

-- RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
ON public.categories FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view subcategories"
ON public.subcategories FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage subcategories"
ON public.subcategories FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- updated_at triggers
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subcategories_updated_at
BEFORE UPDATE ON public.subcategories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed taxonomy
INSERT INTO public.categories (name, slug, display_order, icon) VALUES
  ('Clothing', 'clothing', 1, 'Shirt'),
  ('Jewelry', 'jewelry', 2, 'Gem'),
  ('Electronics', 'electronics', 3, 'Smartphone'),
  ('Home & Kitchen', 'home-kitchen', 4, 'Home');

INSERT INTO public.subcategories (category_id, name, slug, display_order)
SELECT c.id, s.name, s.slug, s.display_order FROM public.categories c
JOIN (VALUES
  ('clothing', 'Men', 'men', 1),
  ('clothing', 'Women', 'women', 2),
  ('clothing', 'Kids', 'kids', 3),
  ('clothing', 'T-Shirts', 't-shirts', 4),
  ('clothing', 'Dresses', 'dresses', 5),
  ('clothing', 'Ethnic Wear', 'ethnic-wear', 6),
  ('jewelry', 'Earrings (Girls)', 'earrings-girls', 1),
  ('jewelry', 'Earrings (Women)', 'earrings-women', 2),
  ('jewelry', 'Necklaces', 'necklaces', 3),
  ('jewelry', 'Bangles', 'bangles', 4),
  ('jewelry', 'Rings', 'rings', 5),
  ('electronics', 'Phones', 'phones', 1),
  ('electronics', 'Laptops', 'laptops', 2),
  ('electronics', 'Audio', 'audio', 3),
  ('electronics', 'Accessories', 'accessories', 4),
  ('home-kitchen', 'Decor', 'decor', 1),
  ('home-kitchen', 'Cookware', 'cookware', 2),
  ('home-kitchen', 'Storage', 'storage', 3),
  ('home-kitchen', 'Bedding', 'bedding', 4)
) AS s(cat_slug, name, slug, display_order) ON c.slug = s.cat_slug;