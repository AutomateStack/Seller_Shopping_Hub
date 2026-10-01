
CREATE OR REPLACE FUNCTION public.award_referral_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref RECORD;
  v_wallet_id uuid;
  v_reward numeric := 100;
BEGIN
  IF NEW.status IS DISTINCT FROM 'delivered'::order_status OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'delivered'::order_status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_ref FROM public.referrals
  WHERE referred_id = NEW.user_id AND status <> 'rewarded'
  LIMIT 1;

  IF v_ref.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_ref.referrer_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id) VALUES (v_ref.referrer_id) RETURNING id INTO v_wallet_id;
  END IF;

  UPDATE public.wallets
    SET balance = balance + v_reward,
        total_won = total_won + v_reward,
        updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference_id, status)
  VALUES (v_wallet_id, v_ref.referrer_id, 'referral_bonus', v_reward,
          'Referral store credit - friend''s first order delivered', v_ref.id::text, 'completed');

  UPDATE public.referrals SET status = 'rewarded' WHERE id = v_ref.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_referral_credit ON public.orders;
CREATE TRIGGER trg_award_referral_credit
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.award_referral_credit();
