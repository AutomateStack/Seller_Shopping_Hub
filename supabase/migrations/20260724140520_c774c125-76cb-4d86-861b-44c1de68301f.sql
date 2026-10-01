
-- 1) Hide correct_option from anon/authenticated (service role still has full access)
REVOKE SELECT (correct_option) ON public.quiz_questions FROM anon, authenticated, PUBLIC;

-- 2) Hide reviewer user_id from anon/authenticated
REVOKE SELECT (user_id) ON public.product_reviews FROM anon, authenticated, PUBLIC;

-- 3) Lock in first quiz answer per (user, question) so grader can't be used as an oracle
CREATE TABLE IF NOT EXISTS public.quiz_answer_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  selected_option INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

GRANT SELECT ON public.quiz_answer_locks TO authenticated;
GRANT ALL ON public.quiz_answer_locks TO service_role;

ALTER TABLE public.quiz_answer_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own answer locks"
  ON public.quiz_answer_locks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
