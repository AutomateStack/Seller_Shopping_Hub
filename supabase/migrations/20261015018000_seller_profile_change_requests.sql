-- Dedicated approved-seller store details and admin-reviewed business identity changes.
create table if not exists seller.profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references seller.seller_profiles(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  proposed_store_name text not null check (char_length(trim(proposed_store_name)) between 2 and 120),
  proposed_business_name text,
  proposed_business_type text not null check (proposed_business_type in ('individual','sole_proprietorship','partnership','llp','private_limited','other')),
  proposed_gstin text,
  status text not null default 'pending' check (status in ('pending','approved','changes_requested','rejected')),
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create index if not exists profile_change_requests_seller_submitted_idx
  on seller.profile_change_requests(seller_id, submitted_at desc);
create index if not exists profile_change_requests_status_idx
  on seller.profile_change_requests(status, submitted_at desc);
alter table seller.profile_change_requests enable row level security;
drop policy if exists "Sellers read their profile change requests" on seller.profile_change_requests;
create policy "Sellers read their profile change requests" on seller.profile_change_requests
  for select to authenticated using (
    exists (select 1 from seller.seller_profiles sp where sp.id = seller_id and sp.user_id = auth.uid())
  );
drop policy if exists "Admins read all profile change requests" on seller.profile_change_requests;
create policy "Admins read all profile change requests" on seller.profile_change_requests
  for select to authenticated using (public.is_current_marketplace_admin());
grant usage on schema seller to authenticated, service_role;
grant select on seller.profile_change_requests to authenticated;
grant all on seller.profile_change_requests to service_role;

create or replace function public.update_seller_contact_details(
  p_contact_name text,
  p_contact_phone text
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public, seller
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_contact_name,''))) < 2 or char_length(trim(p_contact_name)) > 120 then
    raise exception 'Contact name must be between 2 and 120 characters';
  end if;
  if length(coalesce(p_contact_phone,'')) > 20 then raise exception 'Contact phone must be 20 characters or fewer'; end if;
  update seller.seller_profiles
    set contact_name = trim(p_contact_name),
        contact_phone = nullif(trim(coalesce(p_contact_phone,'')), '')
    where user_id = auth.uid()
      and onboarding_status = 'approved'
      and account_status = 'active';
  if not found then raise exception 'An approved, active seller account is required'; end if;
end;
$$;

create or replace function public.submit_seller_profile_change_request(
  p_store_name text,
  p_business_name text,
  p_business_type text,
  p_gstin text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, seller
as $$
declare
  v_seller seller.seller_profiles%rowtype;
  v_request_id uuid;
  v_gstin text := upper(trim(coalesce(p_gstin,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_store_name,''))) not between 2 and 120 then raise exception 'Store name must be between 2 and 120 characters'; end if;
  if p_business_type not in ('individual','sole_proprietorship','partnership','llp','private_limited','other') then raise exception 'Choose a valid business type'; end if;
  if length(v_gstin) > 15 then raise exception 'GSTIN must be 15 characters or fewer'; end if;
  if v_gstin <> '' and v_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then raise exception 'Check the GSTIN format'; end if;
  select * into v_seller from seller.seller_profiles
    where user_id = auth.uid() and onboarding_status = 'approved' and account_status = 'active'
    for update;
  if not found then raise exception 'An approved, active seller account is required'; end if;
  if exists (select 1 from seller.profile_change_requests where seller_id = v_seller.id and status = 'pending') then
    raise exception 'You already have a business details change awaiting review';
  end if;
  insert into seller.profile_change_requests (
    seller_id, requested_by, proposed_store_name, proposed_business_name,
    proposed_business_type, proposed_gstin
  ) values (
    v_seller.id, auth.uid(), trim(p_store_name), nullif(trim(coalesce(p_business_name,'')), ''),
    p_business_type, nullif(v_gstin,'')
  ) returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.review_seller_profile_change_request(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public, seller
as $$
declare
  v_request seller.profile_change_requests%rowtype;
  v_note text := trim(coalesce(p_review_note,''));
begin
  if not public.is_current_marketplace_admin() then raise exception 'Admin permission required'; end if;
  if p_decision not in ('approved','changes_requested','rejected') then raise exception 'Invalid review decision'; end if;
  if p_decision <> 'approved' and char_length(v_note) < 5 then raise exception 'Provide at least 5 characters explaining the decision'; end if;
  select * into v_request from seller.profile_change_requests where id = p_request_id for update;
  if not found then raise exception 'Change request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'This change request has already been reviewed'; end if;

  if p_decision = 'approved' then
    update seller.seller_profiles set
      store_name = v_request.proposed_store_name,
      store_slug = trim(both '-' from regexp_replace(lower(v_request.proposed_store_name), '[^a-z0-9]+', '-', 'g')),
      business_name = v_request.proposed_business_name,
      business_type = v_request.proposed_business_type,
      gstin = v_request.proposed_gstin
    where id = v_request.seller_id
      and onboarding_status = 'approved' and account_status = 'active';
    if not found then raise exception 'Seller is no longer approved and active'; end if;
  end if;

  update seller.profile_change_requests set
    status = p_decision, review_note = nullif(v_note,''), reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id;
end;
$$;

revoke all on function public.update_seller_contact_details(text,text) from public, anon;
revoke all on function public.submit_seller_profile_change_request(text,text,text,text) from public, anon;
revoke all on function public.review_seller_profile_change_request(uuid,text,text) from public, anon;
grant execute on function public.update_seller_contact_details(text,text) to authenticated;
grant execute on function public.submit_seller_profile_change_request(text,text,text,text) to authenticated;
grant execute on function public.review_seller_profile_change_request(uuid,text,text) to authenticated;
