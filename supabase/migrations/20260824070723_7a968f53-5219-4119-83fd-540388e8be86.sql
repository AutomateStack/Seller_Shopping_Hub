-- Returns tracking
CREATE TABLE IF NOT EXISTS public.product_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  user_id uuid,
  product_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  refund_amount numeric NOT NULL DEFAULT 0,
  return_shipping_cost numeric NOT NULL DEFAULT 0,
  restocking_cost numeric NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'requested',
  admin_note text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.product_returns TO authenticated;
GRANT ALL ON public.product_returns TO service_role;
ALTER TABLE public.product_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own returns" ON public.product_returns
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own returns" ON public.product_returns
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage returns" ON public.product_returns
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete returns" ON public.product_returns
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_product_returns_updated_at BEFORE UPDATE ON public.product_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_product_returns_created ON public.product_returns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_returns_product ON public.product_returns (product_id);

-- Analytics performance indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_product ON public.analytics_events (((metadata->>'product_id')));
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders (created_at DESC);

-- Aggregated sales + returns analytics (service_role only; called from a verified admin edge function)
CREATE OR REPLACE FUNCTION public.admin_sales_analytics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH since AS (SELECT now() - (p_days || ' days')::interval AS d),
sold AS (
  SELECT oi.product_id, oi.product_name, SUM(oi.quantity)::int AS units, SUM(oi.subtotal)::numeric AS revenue
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.created_at >= (SELECT d FROM since) AND o.status <> 'cancelled'
  GROUP BY oi.product_id, oi.product_name
),
ret AS (
  SELECT r.product_id, max(r.product_name) AS product_name, SUM(r.quantity)::int AS units,
         SUM(r.refund_amount + r.return_shipping_cost + r.restocking_cost)::numeric AS cost
  FROM public.product_returns r
  WHERE r.created_at >= (SELECT d FROM since) AND r.status <> 'rejected'
  GROUP BY r.product_id
),
daily AS (
  SELECT to_char(date_trunc('day', o.created_at), 'YYYY-MM-DD') AS day,
         SUM(o.total_amount)::numeric AS revenue, COUNT(*)::int AS orders
  FROM public.orders o
  WHERE o.created_at >= (SELECT d FROM since) AND o.status <> 'cancelled'
  GROUP BY 1 ORDER BY 1
)
SELECT jsonb_build_object(
  'days', p_days,
  'units_sold', COALESCE((SELECT SUM(units) FROM sold), 0),
  'revenue', COALESCE((SELECT SUM(revenue) FROM sold), 0),
  'orders', COALESCE((SELECT COUNT(*) FROM public.orders o WHERE o.created_at >= (SELECT d FROM since) AND o.status <> 'cancelled'), 0),
  'returns_units', COALESCE((SELECT SUM(units) FROM ret), 0),
  'returns_count', COALESCE((SELECT COUNT(*) FROM public.product_returns r WHERE r.created_at >= (SELECT d FROM since) AND r.status <> 'rejected'), 0),
  'returns_cost', COALESCE((SELECT SUM(cost) FROM ret), 0),
  'avg_return_cost', COALESCE((SELECT SUM(cost) / NULLIF(SUM(units), 0) FROM ret), 0),
  'return_rate', COALESCE((SELECT SUM(units) FROM ret), 0)::numeric / NULLIF((SELECT SUM(units) FROM sold), 0),
  'return_cost_per_unit_sold', COALESCE((SELECT SUM(cost) FROM ret), 0)::numeric / NULLIF((SELECT SUM(units) FROM sold), 0),
  'top_sellers', COALESCE((SELECT jsonb_agg(x) FROM (SELECT product_id, product_name, units, revenue FROM sold ORDER BY units DESC LIMIT 10) x), '[]'::jsonb),
  'top_returned', COALESCE((SELECT jsonb_agg(x) FROM (
      SELECT r.product_id, r.product_name, r.units, r.cost,
             (r.units::numeric / NULLIF(s.units, 0)) AS return_rate
      FROM ret r LEFT JOIN sold s ON s.product_id = r.product_id
      ORDER BY r.units DESC LIMIT 10) x), '[]'::jsonb),
  'daily', COALESCE((SELECT jsonb_agg(x) FROM daily x), '[]'::jsonb)
)
$$;

-- Aggregated site traffic / behaviour analytics
CREATE OR REPLACE FUNCTION public.admin_traffic_analytics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH since AS (SELECT now() - (p_days || ' days')::interval AS d),
ev AS (
  SELECT * FROM public.analytics_events WHERE created_at >= (SELECT d FROM since)
),
pv AS (SELECT * FROM ev WHERE event_name = 'page_view'),
prod AS (
  SELECT metadata->>'product_id' AS product_id,
         max(metadata->>'product_name') AS product_name,
         COUNT(*)::int AS views,
         COUNT(DISTINCT session_id)::int AS sessions,
         AVG(NULLIF((metadata->>'dwell_ms')::numeric, 0)) AS avg_dwell_ms
  FROM ev WHERE event_name IN ('view_product','product_dwell') AND metadata->>'product_id' IS NOT NULL
  GROUP BY 1
),
paths AS (
  SELECT path, COUNT(*)::int AS views, COUNT(DISTINCT session_id)::int AS sessions
  FROM pv WHERE path IS NOT NULL GROUP BY path ORDER BY views DESC LIMIT 15
),
daily AS (
  SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
         COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS page_views,
         COUNT(DISTINCT session_id)::int AS sessions
  FROM ev GROUP BY 1 ORDER BY 1
),
sess AS (
  SELECT session_id, EXTRACT(EPOCH FROM (max(created_at) - min(created_at))) AS secs, COUNT(*) AS hits
  FROM ev WHERE session_id IS NOT NULL GROUP BY session_id
),
funnel AS (
  SELECT
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'view_product')::int AS viewed,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'add_to_cart')::int AS carted,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'begin_checkout')::int AS checkout,
    COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'purchase')::int AS purchased
  FROM ev
)
SELECT jsonb_build_object(
  'days', p_days,
  'page_views', (SELECT COUNT(*) FROM pv),
  'sessions', (SELECT COUNT(DISTINCT session_id) FROM ev),
  'known_users', (SELECT COUNT(DISTINCT user_id) FROM ev WHERE user_id IS NOT NULL),
  'avg_session_seconds', COALESCE((SELECT AVG(secs) FROM sess WHERE hits > 1), 0),
  'bounce_rate', COALESCE((SELECT COUNT(*) FILTER (WHERE hits = 1)::numeric / NULLIF(COUNT(*), 0) FROM sess), 0),
  'funnel', (SELECT to_jsonb(f) FROM funnel f),
  'top_products', COALESCE((SELECT jsonb_agg(x) FROM (SELECT * FROM prod ORDER BY views DESC LIMIT 12) x), '[]'::jsonb),
  'longest_dwell', COALESCE((SELECT jsonb_agg(x) FROM (SELECT * FROM prod WHERE avg_dwell_ms IS NOT NULL ORDER BY avg_dwell_ms DESC LIMIT 10) x), '[]'::jsonb),
  'top_paths', COALESCE((SELECT jsonb_agg(x) FROM paths x), '[]'::jsonb),
  'top_searches', COALESCE((SELECT jsonb_agg(x) FROM (
      SELECT metadata->>'query' AS query, COUNT(*)::int AS count FROM ev
      WHERE event_name = 'search' AND metadata->>'query' IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10) x), '[]'::jsonb),
  'shares', COALESCE((SELECT jsonb_agg(x) FROM (
      SELECT metadata->>'channel' AS channel, COUNT(*)::int AS count FROM ev
      WHERE event_name = 'share' GROUP BY 1 ORDER BY 2 DESC LIMIT 10) x), '[]'::jsonb),
  'daily', COALESCE((SELECT jsonb_agg(x) FROM daily x), '[]'::jsonb)
)
$$;

REVOKE ALL ON FUNCTION public.admin_sales_analytics(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_traffic_analytics(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sales_analytics(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_traffic_analytics(integer) TO service_role;