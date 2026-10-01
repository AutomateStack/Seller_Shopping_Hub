CREATE OR REPLACE FUNCTION public.admin_get_quiz_questions(p_quiz_id uuid)
RETURNS TABLE(
  id uuid,
  quiz_id uuid,
  question text,
  options jsonb,
  correct_option int,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
    SELECT q.id, q.quiz_id, q.question, q.options, q.correct_option, q.created_at
    FROM public.quiz_questions q
    WHERE q.quiz_id = p_quiz_id
    ORDER BY q.created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_quiz_questions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_quiz_questions(uuid) TO authenticated;