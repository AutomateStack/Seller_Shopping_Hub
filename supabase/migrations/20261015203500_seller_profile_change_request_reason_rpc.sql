-- Add seller-provided context to business identity change requests.
ALTER TABLE seller.profile_change_requests
  ADD COLUMN IF NOT EXISTS change_type text,
  ADD COLUMN IF NOT EXISTS seller_explanation text;

ALTER TABLE seller.profile_change_requests
  DROP CONSTRAINT IF EXISTS profile_change_requests_change_type_check;

ALTER TABLE seller.profile_change_requests
  ADD CONSTRAINT profile_change_requests_change_type_check
  CHECK (change_type IS NULL OR change_type IN ('store_name','business_name','business_type','gstin','multiple'));

CREATE OR REPLACE FUNCTION public.submit_seller_profile_change_request_with_reason(
  p_store_name text,
  p_business_name text,
  p_business_type text,
  p_gstin text,
  p_change_type text,
  p_seller_explanation text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'seller'
AS $function$
DECLARE
  v_request_id uuid;
  v_explanation text := trim(coalesce(p_seller_explanation, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_change_type IS NULL OR p_change_type NOT IN ('store_name','business_name','business_type','gstin','multiple') THEN
    RAISE EXCEPTION 'Choose a valid business detail change type';
  END IF;

  IF char_length(v_explanation) < 10 OR char_length(v_explanation) > 1000 THEN
    RAISE EXCEPTION 'Please explain the requested change in 10 to 1000 characters';
  END IF;

  v_request_id := public.submit_seller_profile_change_request(
    p_store_name, p_business_name, p_business_type, p_gstin
  );

  UPDATE seller.profile_change_requests
  SET change_type = p_change_type,
      seller_explanation = v_explanation
  WHERE id = v_request_id
    AND requested_by = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not save the change explanation';
  END IF;

  RETURN v_request_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_seller_profile_change_request_with_reason(text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_seller_profile_change_request_with_reason(text,text,text,text,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
