-- Restrict SELECT on user identity columns in lucky-draw tables to authenticated users only.
-- Public/anon can still read prize info, draw info, and aggregate stats, but not user UUIDs.

REVOKE SELECT (user_id) ON public.draw_winners FROM anon;
REVOKE SELECT (winner_user_id) ON public.draw_prizes FROM anon;

-- Re-affirm column grants for authenticated users (no-op if already present, but explicit for clarity)
GRANT SELECT ON public.draw_winners TO authenticated;
GRANT SELECT ON public.draw_prizes TO authenticated;