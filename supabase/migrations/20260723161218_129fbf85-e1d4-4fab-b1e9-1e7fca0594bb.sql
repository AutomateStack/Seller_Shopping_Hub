
-- Remove the overly-broad public SELECT policy that exposed the entire row
DROP POLICY IF EXISTS "Anyone can view quiz questions" ON public.quiz_questions;

-- Only authenticated users may read quiz questions (they play quizzes)
CREATE POLICY "Authenticated users can view quiz questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (true);

-- Ensure anon cannot read the table at all
REVOKE SELECT ON public.quiz_questions FROM anon;

-- Hide the answer column from clients; grading happens server-side in edge functions
REVOKE SELECT (correct_option) ON public.quiz_questions FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, quiz_id, question, options, created_at) ON public.quiz_questions TO authenticated;
