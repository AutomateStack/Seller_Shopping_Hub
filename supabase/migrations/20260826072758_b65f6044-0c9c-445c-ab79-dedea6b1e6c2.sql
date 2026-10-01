CREATE TABLE public.product_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid,
  asker_name text NOT NULL DEFAULT 'Customer',
  question text NOT NULL,
  answer text,
  answered_at timestamp with time zone,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_questions TO anon;
GRANT SELECT, INSERT ON public.product_questions TO authenticated;
GRANT ALL ON public.product_questions TO service_role;

ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published questions are viewable by everyone"
  ON public.product_questions FOR SELECT
  USING (is_published = true);

CREATE POLICY "Users can view their own questions"
  ON public.product_questions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all questions"
  ON public.product_questions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can ask questions"
  ON public.product_questions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_published = false AND answer IS NULL);

CREATE POLICY "Admins can update questions"
  ON public.product_questions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete questions"
  ON public.product_questions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_product_questions_product ON public.product_questions(product_id, is_published, created_at DESC);

CREATE TRIGGER update_product_questions_updated_at
  BEFORE UPDATE ON public.product_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();