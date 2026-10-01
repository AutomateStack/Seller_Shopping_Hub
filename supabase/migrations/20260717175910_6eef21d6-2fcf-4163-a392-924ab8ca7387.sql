
-- 1) order_items: scope SELECT policy to authenticated
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
);

-- 2) product_reviews: hide user_id from anon/authenticated (column-level)
REVOKE SELECT (user_id) ON public.product_reviews FROM anon;
REVOKE SELECT (user_id) ON public.product_reviews FROM authenticated;
REVOKE SELECT (user_id) ON public.product_reviews FROM PUBLIC;

-- 3) Lock down SECURITY DEFINER functions from direct client execution.
-- Trigger functions do not need EXECUTE by users (triggers run as table owner).
REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_single_default_address() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_referral_counter_tampering() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_back_in_stock() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies (server-side); clients do not need EXECUTE.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- execute_draw is admin-only and enforces its own admin check; only service_role needs EXECUTE.
REVOKE ALL ON FUNCTION public.execute_draw(uuid) FROM PUBLIC, anon, authenticated;

-- Keep RPCs that the client legitimately calls, but restrict to authenticated only.
REVOKE ALL ON FUNCTION public.grade_quiz_answer(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_quiz_answer(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_get_quiz_questions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_quiz_questions(uuid) TO authenticated;
