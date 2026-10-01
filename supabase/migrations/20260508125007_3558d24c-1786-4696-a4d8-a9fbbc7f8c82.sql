
-- 1. Wallets: enforce zero starting balances on user-created rows
DROP POLICY IF EXISTS "Users can insert own wallet" ON public.wallets;

CREATE POLICY "Users can insert own wallet"
ON public.wallets
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND COALESCE(balance, 0) = 0
  AND COALESCE(total_deposited, 0) = 0
  AND COALESCE(total_won, 0) = 0
  AND COALESCE(total_spent, 0) = 0
  AND COALESCE(total_withdrawn, 0) = 0
);

-- 2. Referral codes: prevent users from inflating their own total_referrals
DROP POLICY IF EXISTS "Users can update own referral code" ON public.referral_codes;

CREATE OR REPLACE FUNCTION public.prevent_referral_counter_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role and admins to change counters freely
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- For normal users, lock down counter and ownership fields
  IF NEW.total_referrals IS DISTINCT FROM OLD.total_referrals
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Not allowed to modify referral counters';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_referral_counter_tampering ON public.referral_codes;
CREATE TRIGGER trg_prevent_referral_counter_tampering
BEFORE UPDATE ON public.referral_codes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_referral_counter_tampering();

CREATE POLICY "Users can update own referral code"
ON public.referral_codes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
