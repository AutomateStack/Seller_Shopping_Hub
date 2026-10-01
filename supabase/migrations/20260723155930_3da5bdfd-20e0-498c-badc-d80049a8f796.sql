-- 1) Hide quiz answer key from clients
REVOKE SELECT (correct_option) ON public.quiz_questions FROM anon, authenticated;

-- 2) Block direct client inserts on quiz_attempts (must go through submit-quiz-attempt edge function)
DROP POLICY IF EXISTS "Users can insert own attempts" ON public.quiz_attempts;

-- 3) Block direct client inserts on draw_entries (must go through claim-free-entry / wallet-buy-entries)
DROP POLICY IF EXISTS "Users can insert own entries" ON public.draw_entries;