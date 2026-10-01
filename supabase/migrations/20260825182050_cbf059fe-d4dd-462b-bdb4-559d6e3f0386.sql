
CREATE OR REPLACE FUNCTION public.admin_user_analytics(p_days integer DEFAULT 30, p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH since AS (SELECT now() - (p_days || ' days')::interval AS d),
ev AS (
  SELECT *, COALESCE(user_id::text, 'guest:' || COALESCE(session_id,'unknown')) AS visitor_key
  FROM public.analytics_events WHERE created_at >= (SELECT d FROM since)
),
base AS (
  SELECT visitor_key,
         max(user_id::text) AS user_id,
         COUNT(DISTINCT session_id)::int AS sessions,
         COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS page_views,
         min(created_at) AS first_seen,
         max(created_at) AS last_seen,
         COALESCE(SUM((metadata->>'dwell_ms')::numeric) FILTER (WHERE event_name = 'product_dwell'), 0) AS dwell_ms,
         COUNT(*) FILTER (WHERE event_name = 'add_to_cart')::int AS add_to_cart,
         COUNT(*) FILTER (WHERE event_name = 'begin_checkout')::int AS checkouts,
         COUNT(*) FILTER (WHERE event_name = 'purchase')::int AS purchases,
         COUNT(*) FILTER (WHERE event_name = 'search')::int AS searches,
         COUNT(*) FILTER (WHERE event_name = 'share')::int AS shares
  FROM ev GROUP BY visitor_key
),
sess AS (
  SELECT visitor_key, SUM(secs)::numeric AS active_secs FROM (
    SELECT visitor_key, session_id,
           EXTRACT(EPOCH FROM (max(created_at) - min(created_at))) AS secs
    FROM ev WHERE session_id IS NOT NULL GROUP BY visitor_key, session_id
  ) s GROUP BY visitor_key
),
prod AS (
  SELECT visitor_key, metadata->>'product_id' AS product_id,
         max(metadata->>'product_name') AS product_name,
         COUNT(*)::int AS views,
         COALESCE(SUM((metadata->>'dwell_ms')::numeric), 0) AS dwell_ms
  FROM ev
  WHERE event_name IN ('view_product','product_dwell') AND metadata->>'product_id' IS NOT NULL
  GROUP BY 1,2
),
prod_top AS (
  SELECT visitor_key, jsonb_agg(x ORDER BY x.dwell_ms DESC, x.views DESC) AS items FROM (
    SELECT p.*, row_number() OVER (PARTITION BY visitor_key ORDER BY dwell_ms DESC, views DESC) AS rn FROM prod p
  ) x WHERE x.rn <= 5 GROUP BY visitor_key
),
paths AS (
  SELECT visitor_key, jsonb_agg(x ORDER BY x.views DESC) AS items FROM (
    SELECT visitor_key, path, COUNT(*)::int AS views,
           row_number() OVER (PARTITION BY visitor_key ORDER BY COUNT(*) DESC) AS rn
    FROM ev WHERE event_name = 'page_view' AND path IS NOT NULL GROUP BY visitor_key, path
  ) x WHERE x.rn <= 5 GROUP BY visitor_key
),
ord AS (
  SELECT user_id::text AS user_id, COUNT(*)::int AS orders, SUM(total_amount)::numeric AS spend
  FROM public.orders
  WHERE user_id IS NOT NULL AND created_at >= (SELECT d FROM since) AND status <> 'cancelled'
  GROUP BY 1
),
rows AS (
  SELECT b.visitor_key, b.user_id, pr.email, pr.full_name,
         b.sessions, b.page_views, b.first_seen, b.last_seen,
         COALESCE(s.active_secs, 0) AS active_secs,
         b.dwell_ms, b.add_to_cart, b.checkouts, b.purchases, b.searches, b.shares,
         COALESCE(o.orders, 0) AS orders, COALESCE(o.spend, 0) AS spend,
         COALESCE(pt.items, '[]'::jsonb) AS top_products,
         COALESCE(pa.items, '[]'::jsonb) AS top_paths,
         CASE
           WHEN COALESCE(o.orders,0) > 0 OR b.purchases > 0 THEN 'customer'
           WHEN b.add_to_cart > 0 OR b.checkouts > 0 THEN 'hot'
           WHEN b.dwell_ms >= 60000 OR b.page_views >= 5 THEN 'interested'
           WHEN b.page_views <= 1 AND b.dwell_ms < 5000 THEN 'bounced'
           ELSE 'browsing'
         END AS interest
  FROM base b
  LEFT JOIN sess s ON s.visitor_key = b.visitor_key
  LEFT JOIN prod_top pt ON pt.visitor_key = b.visitor_key
  LEFT JOIN paths pa ON pa.visitor_key = b.visitor_key
  LEFT JOIN ord o ON o.user_id = b.user_id
  LEFT JOIN public.profiles pr ON pr.id::text = b.user_id
)
SELECT jsonb_build_object(
  'days', p_days,
  'total_visitors', (SELECT COUNT(*) FROM rows),
  'signed_in_visitors', (SELECT COUNT(*) FROM rows WHERE user_id IS NOT NULL),
  'buckets', (SELECT jsonb_object_agg(interest, c) FROM (SELECT interest, COUNT(*)::int c FROM rows GROUP BY 1) z),
  'users', COALESCE((SELECT jsonb_agg(x) FROM (
     SELECT * FROM rows ORDER BY active_secs DESC, page_views DESC LIMIT GREATEST(1, LEAST(500, p_limit))
  ) x), '[]'::jsonb)
)
$$;

REVOKE ALL ON FUNCTION public.admin_user_analytics(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_analytics(integer, integer) TO service_role;

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created ON public.analytics_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_created ON public.analytics_events (session_id, created_at DESC);
