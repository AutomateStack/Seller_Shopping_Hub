
-- Lucky Draw Platform Schema

-- Draw status enum
CREATE TYPE public.draw_status AS ENUM ('upcoming', 'active', 'drawing', 'completed', 'cancelled');

-- Draws table
CREATE TABLE public.draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  draw_date timestamp with time zone NOT NULL,
  status draw_status NOT NULL DEFAULT 'upcoming',
  entry_fee numeric NOT NULL DEFAULT 1,
  free_entries_per_user integer NOT NULL DEFAULT 1,
  max_entries_per_user integer DEFAULT NULL,
  total_prize_pool numeric NOT NULL DEFAULT 0,
  draw_seed text,
  draw_hash text,
  winner_count integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Draw prizes
CREATE TABLE public.draw_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid REFERENCES public.draws(id) ON DELETE CASCADE NOT NULL,
  position integer NOT NULL,
  prize_amount numeric NOT NULL,
  prize_label text NOT NULL,
  winner_user_id uuid DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Draw entries
CREATE TABLE public.draw_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid REFERENCES public.draws(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  entry_type text NOT NULL DEFAULT 'free', -- 'free', 'paid', 'referral', 'milestone_bonus'
  is_paid boolean NOT NULL DEFAULT false,
  transaction_id uuid DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Referral system
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'completed', -- 'pending', 'completed'
  bonus_entries_awarded integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, referred_id)
);

-- Referral codes
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  total_referrals integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Wallet
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  total_deposited numeric NOT NULL DEFAULT 0,
  total_won numeric NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  total_withdrawn numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Wallet transactions
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL, -- 'deposit', 'entry_purchase', 'winning', 'withdrawal', 'refund'
  amount numeric NOT NULL,
  description text,
  reference_id text,
  status text NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Withdrawal requests
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  upi_id text,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  admin_note text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Draw winners (for public display)
CREATE TABLE public.draw_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid REFERENCES public.draws(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  prize_position integer NOT NULL,
  prize_amount numeric NOT NULL,
  prize_label text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_winners ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Draws: anyone can view, admins can manage
CREATE POLICY "Anyone can view draws" ON public.draws FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage draws" ON public.draws FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Draw prizes: anyone can view, admins can manage
CREATE POLICY "Anyone can view draw prizes" ON public.draw_prizes FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage draw prizes" ON public.draw_prizes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Draw entries: users see own, admins see all
CREATE POLICY "Users can view own entries" ON public.draw_entries FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own entries" ON public.draw_entries FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage entries" ON public.draw_entries FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Referrals: users see own
CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert referrals" ON public.referrals FOR INSERT TO authenticated WITH CHECK (referred_id = auth.uid());
CREATE POLICY "Admins can manage referrals" ON public.referrals FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Referral codes: users see own
CREATE POLICY "Users can view own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own referral code" ON public.referral_codes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own referral code" ON public.referral_codes FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Wallets: users see own
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own wallet" ON public.wallets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Wallet transactions: users see own
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own transactions" ON public.wallet_transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage transactions" ON public.wallet_transactions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Withdrawal requests: users see own, admins manage
CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own withdrawals" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can update withdrawals" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Draw winners: anyone can view
CREATE POLICY "Anyone can view draw winners" ON public.draw_winners FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage draw winners" ON public.draw_winners FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on draws and wallets
CREATE TRIGGER update_draws_updated_at BEFORE UPDATE ON public.draws FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, upper(substring(md5(NEW.id::text || now()::text) from 1 for 8)))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Function to execute draw (random winner selection)
CREATE OR REPLACE FUNCTION public.execute_draw(p_draw_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_prize RECORD;
  v_winner_id uuid;
  v_seed text;
  v_wallet_id uuid;
BEGIN
  -- Generate seed
  v_seed := md5(p_draw_id::text || now()::text || random()::text);
  
  UPDATE public.draws SET status = 'drawing', draw_seed = v_seed WHERE id = p_draw_id;
  
  -- For each prize position, select a random winner
  FOR v_prize IN 
    SELECT * FROM public.draw_prizes WHERE draw_id = p_draw_id ORDER BY position
  LOOP
    -- Select random winner who hasn't won yet in this draw
    SELECT de.user_id INTO v_winner_id
    FROM public.draw_entries de
    WHERE de.draw_id = p_draw_id
    AND de.user_id NOT IN (SELECT dw.user_id FROM public.draw_winners dw WHERE dw.draw_id = p_draw_id)
    ORDER BY md5(de.id::text || v_seed) -- deterministic random based on seed
    LIMIT 1;
    
    IF v_winner_id IS NOT NULL THEN
      -- Record winner
      INSERT INTO public.draw_winners (draw_id, user_id, prize_position, prize_amount, prize_label)
      VALUES (p_draw_id, v_winner_id, v_prize.position, v_prize.prize_amount, v_prize.prize_label);
      
      -- Update prize
      UPDATE public.draw_prizes SET winner_user_id = v_winner_id WHERE id = v_prize.id;
      
      -- Credit wallet
      SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_winner_id;
      IF v_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, balance, total_won)
        VALUES (v_winner_id, v_prize.prize_amount, v_prize.prize_amount)
        RETURNING id INTO v_wallet_id;
      ELSE
        UPDATE public.wallets SET balance = balance + v_prize.prize_amount, total_won = total_won + v_prize.prize_amount WHERE id = v_wallet_id;
      END IF;
      
      -- Record transaction
      INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference_id)
      VALUES (v_wallet_id, v_winner_id, 'winning', v_prize.prize_amount, v_prize.prize_label || ' - Draw Winner', p_draw_id::text);
    END IF;
  END LOOP;
  
  -- Update draw hash and status
  UPDATE public.draws SET 
    status = 'completed',
    draw_hash = md5(v_seed || (SELECT string_agg(user_id::text, ',' ORDER BY prize_position) FROM public.draw_winners WHERE draw_id = p_draw_id))
  WHERE id = p_draw_id;
END;
$$;
