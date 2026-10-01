-- Phase 6: Engagement automation schema

-- 1) Cart: track last reminder for abandoned-cart emails
ALTER TABLE public.cart
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;

-- 2) Email campaigns table for newsletter broadcasts
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body_html text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft | sending | sent | failed
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaigns"
  ON public.email_campaigns
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Stock notification trigger: when stock changes from 0 -> >0, invoke edge function
CREATE OR REPLACE FUNCTION public.notify_back_in_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_count int;
BEGIN
  IF (COALESCE(OLD.stock, 0) = 0) AND (COALESCE(NEW.stock, 0) > 0) THEN
    SELECT COUNT(*) INTO v_pending_count
    FROM public.stock_notifications
    WHERE product_id = NEW.id AND notified = false;

    IF v_pending_count > 0 THEN
      PERFORM net.http_post(
        url := 'https://txngfowybzpcllvhebvj.supabase.co/functions/v1/send-back-in-stock',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('product_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_back_in_stock ON public.products;
CREATE TRIGGER trg_notify_back_in_stock
AFTER UPDATE OF stock ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_back_in_stock();