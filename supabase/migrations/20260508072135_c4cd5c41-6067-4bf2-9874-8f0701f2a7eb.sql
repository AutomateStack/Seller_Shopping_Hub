-- 1. Hide quiz_questions.correct_option from public/auth roles
REVOKE SELECT ON public.quiz_questions FROM anon, authenticated;
GRANT SELECT (id, quiz_id, question, options, created_at) ON public.quiz_questions TO anon, authenticated;

-- Secure grading function
CREATE OR REPLACE FUNCTION public.grade_quiz_answer(p_question_id uuid, p_selected_option int)
RETURNS TABLE(is_correct boolean, correct_option int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct int;
BEGIN
  SELECT q.correct_option INTO v_correct
  FROM public.quiz_questions q
  WHERE q.id = p_question_id;

  IF v_correct IS NULL THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  RETURN QUERY SELECT (p_selected_option = v_correct) AS is_correct, v_correct AS correct_option;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_quiz_answer(uuid, int) TO anon, authenticated;

-- 2. Remove user INSERT on wallet_transactions (privilege escalation risk)
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.wallet_transactions;