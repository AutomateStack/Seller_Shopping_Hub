
REVOKE ALL ON FUNCTION public.grade_quiz_answer(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_quiz_questions(uuid) FROM PUBLIC, anon, authenticated;
