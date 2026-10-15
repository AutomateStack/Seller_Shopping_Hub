-- Preserve the seller's stated reason alongside each business identity change request.
alter table seller.profile_change_requests
  add column if not exists change_type text,
  add column if not exists seller_explanation text;

alter table seller.profile_change_requests
  drop constraint if exists profile_change_requests_change_type_check;
alter table seller.profile_change_requests
  add constraint profile_change_requests_change_type_check
  check (change_type is null or change_type in ('store_name', 'business_name', 'business_type', 'gstin', 'multiple'));

create or replace function public.submit_seller_profile_change_request_with_reason(
  p_store_name text,
  p_business_name text,
  p_business_type text,
  p_gstin text,
  p_change_type text,
  p_seller_explanation text
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'seller'
as $function$
declare
  v_seller_id uuid;
  v_request_id uuid;
  v_explanation text := nullif(btrim(coalesce(p_seller_explanation, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_change_type not in ('store_name', 'business_name', 'business_type', 'gstin', 'multiple') then
    raise exception 'Choose a valid business detail change type';
  end if;

  if char_length(coalesce(v_explanation, '')) < 10 or char_length(v_explanation) > 1000 then
    raise exception 'Explain the requested change in 10 to 1000 characters';
  end if;

  select id into v_seller_id
  from seller.seller_profiles
  where user_id = auth.uid()
    and onboarding_status = 'approved'
    and account_status = 'active'
  for update;

  if v_seller_id is null then
    raise exception 'An active approved seller account is required';
  end if;

  -- Reuse the established submission function so its existing validation and
  -- pending-request rules remain authoritative.
  perform public.submit_seller_profile_change_request(
    p_store_name, p_business_name, p_business_type, p_gstin
  );

  select id into v_request_id
  from seller.profile_change_requests
  where seller_id = v_seller_id and status = 'pending'
  order by submitted_at desc
  limit 1
  for update;

  if v_request_id is null then
    raise exception 'Submitted request could not be found';
  end if;

  update seller.profile_change_requests
  set change_type = p_change_type,
      seller_explanation = v_explanation
  where id = v_request_id;

  return v_request_id;
end;
$function$;

revoke all on function public.submit_seller_profile_change_request_with_reason(text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_seller_profile_change_request_with_reason(text, text, text, text, text, text) to authenticated;
