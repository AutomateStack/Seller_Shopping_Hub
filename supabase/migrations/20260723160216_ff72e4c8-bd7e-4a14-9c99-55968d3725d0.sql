CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow checking your own roles from client contexts.
  -- Service role (edge functions / cron) may check any user.
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR _user_id <> auth.uid()) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;