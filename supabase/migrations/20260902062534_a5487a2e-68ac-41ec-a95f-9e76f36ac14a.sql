CREATE TABLE public.loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_used integer NOT NULL CHECK (points_used > 0),
  credit_amount numeric NOT NULL CHECK (credit_amount > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_redemptions TO authenticated;
GRANT ALL ON public.loyalty_redemptions TO service_role;

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemptions"
ON public.loyalty_redemptions FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_loyalty_redemptions_user ON public.loyalty_redemptions(user_id, created_at DESC);