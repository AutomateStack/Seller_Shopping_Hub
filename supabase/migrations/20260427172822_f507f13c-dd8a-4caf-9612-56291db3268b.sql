-- Phase 11: Lightweight client analytics events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  user_id UUID,
  session_id TEXT,
  path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Helpful indexes for the admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON public.analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);

-- Enable Row Level Security
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including guests) can insert events. We trust the event_name + metadata
-- as non-sensitive telemetry (no PII required); user_id is optional and validated
-- server-side via the WITH CHECK below if provided.
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_name IS NOT NULL
  AND length(event_name) <= 64
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- Only admins can read analytics
CREATE POLICY "Admins can view analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete analytics events (cleanup)
CREATE POLICY "Admins can delete analytics events"
ON public.analytics_events
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));