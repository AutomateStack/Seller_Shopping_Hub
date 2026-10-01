
-- 1. Column-level SELECT revokes for sensitive UUIDs / answers
REVOKE SELECT (winner_user_id) ON public.draw_prizes FROM anon, PUBLIC;
REVOKE SELECT (user_id)        ON public.draw_winners FROM anon, PUBLIC;
REVOKE SELECT (user_id)        ON public.product_reviews FROM anon, PUBLIC;
REVOKE SELECT (correct_option) ON public.quiz_questions FROM anon, authenticated, PUBLIC;

-- 2. Lock down SECURITY DEFINER functions.
-- Revoke default PUBLIC/anon/authenticated EXECUTE on every definer function, then
-- grant back only where the client / RLS legitimately needs it.

-- Trigger helpers — invoked only by the database engine, never by clients.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_status_change()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_back_in_stock()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_single_default_address()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_referral_counter_tampering()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()            FROM PUBLIC, anon, authenticated;

-- User-facing / RLS-used functions: restrict to signed-in users (+ service_role).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)              FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role)              TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.grade_quiz_answer(uuid, integer)      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.grade_quiz_answer(uuid, integer)      TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_get_quiz_questions(uuid)        FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_get_quiz_questions(uuid)        TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.execute_draw(uuid)                    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.execute_draw(uuid)                    TO authenticated, service_role;

-- 3. Add an internal admin check to execute_draw so signed-in non-admins cannot invoke it.
CREATE OR REPLACE FUNCTION public.execute_draw(p_draw_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prize RECORD;
  v_winner_id uuid;
  v_seed text;
  v_wallet_id uuid;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_seed := md5(p_draw_id::text || now()::text || random()::text);

  UPDATE public.draws SET status = 'drawing', draw_seed = v_seed WHERE id = p_draw_id;

  FOR v_prize IN
    SELECT * FROM public.draw_prizes WHERE draw_id = p_draw_id ORDER BY position
  LOOP
    SELECT de.user_id INTO v_winner_id
    FROM public.draw_entries de
    WHERE de.draw_id = p_draw_id
    AND de.user_id NOT IN (SELECT dw.user_id FROM public.draw_winners dw WHERE dw.draw_id = p_draw_id)
    ORDER BY md5(de.id::text || v_seed)
    LIMIT 1;

    IF v_winner_id IS NOT NULL THEN
      INSERT INTO public.draw_winners (draw_id, user_id, prize_position, prize_amount, prize_label)
      VALUES (p_draw_id, v_winner_id, v_prize.position, v_prize.prize_amount, v_prize.prize_label);

      UPDATE public.draw_prizes SET winner_user_id = v_winner_id WHERE id = v_prize.id;

      SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_winner_id;
      IF v_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, balance, total_won)
        VALUES (v_winner_id, v_prize.prize_amount, v_prize.prize_amount)
        RETURNING id INTO v_wallet_id;
      ELSE
        UPDATE public.wallets SET balance = balance + v_prize.prize_amount, total_won = total_won + v_prize.prize_amount WHERE id = v_wallet_id;
      END IF;

      INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference_id)
      VALUES (v_wallet_id, v_winner_id, 'winning', v_prize.prize_amount, v_prize.prize_label || ' - Draw Winner', p_draw_id::text);
    END IF;
  END LOOP;

  UPDATE public.draws SET
    status = 'completed',
    draw_hash = md5(v_seed || (SELECT string_agg(user_id::text, ',' ORDER BY prize_position) FROM public.draw_winners WHERE draw_id = p_draw_id))
  WHERE id = p_draw_id;
END;
$function$;

-- Re-apply grants after CREATE OR REPLACE (Postgres preserves them, but be explicit)
REVOKE EXECUTE ON FUNCTION public.execute_draw(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.execute_draw(uuid) TO authenticated, service_role;
