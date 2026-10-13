-- Seller Shopping Hub: marketplace foundation (additive; preserves the existing leads schema)
create extension if not exists pgcrypto;

create table if not exists public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  store_name text not null check (char_length(trim(store_name)) between 2 and 120),
  store_slug text not null unique check (store_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  contact_name text not null check (char_length(trim(contact_name)) between 2 and 120),
  contact_email text,
  contact_phone text,
  business_type text not null default 'individual' check (business_type in ('individual','sole_proprietorship','partnership','llp','private_limited','other')),
  business_name text,
  gstin text,
  pan_last4 text,
  onboarding_status text not null default 'draft' check (onboarding_status in ('draft','submitted','under_review','approved','rejected','needs_changes')),
  account_status text not null default 'active' check (account_status in ('active','restricted','suspended','closed')),
  performance_tier text not null default 'starter' check (performance_tier in ('starter','silver','gold','platinum')),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_addresses (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  address_type text not null default 'pickup' check (address_type in ('pickup','business','return')),
  contact_name text not null,
  contact_phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country_code text not null default 'IN' check (country_code ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_documents (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  document_type text not null check (document_type in ('pan','gstin_certificate','business_registration','bank_proof','address_proof','other')),
  storage_path text not null,
  file_name text not null,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected','needs_resubmission')),
  reviewer_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  admin_role text not null check (admin_role in ('support','reviewer','operations','super_admin')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.seller_status_events (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('onboarding_submitted','approved','rejected','needs_changes','restricted','suspended','reactivated','tier_changed','note_added')),
  previous_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.seller_appeals (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  appeal_type text not null check (appeal_type in ('rejection','restriction','suspension','tier')),
  explanation text not null check (char_length(trim(explanation)) between 20 and 5000),
  status text not null default 'open' check (status in ('open','in_review','upheld','overturned','more_information')),
  resolution_notes text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists seller_profiles_status_idx on public.seller_profiles(onboarding_status, account_status);
create index if not exists seller_addresses_seller_idx on public.seller_addresses(seller_id);
create index if not exists seller_documents_seller_idx on public.seller_documents(seller_id, review_status);
create index if not exists seller_status_events_seller_idx on public.seller_status_events(seller_id, created_at desc);
create index if not exists seller_appeals_status_idx on public.seller_appeals(status, created_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists seller_profiles_set_updated_at on public.seller_profiles;
create trigger seller_profiles_set_updated_at before update on public.seller_profiles
for each row execute function public.set_updated_at();

drop trigger if exists seller_addresses_set_updated_at on public.seller_addresses;
create trigger seller_addresses_set_updated_at before update on public.seller_addresses
for each row execute function public.set_updated_at();

-- Seller-controlled writes cannot grant approval, tier changes, or account enforcement.
create or replace function public.guard_seller_profile_privileged_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_current_super_admin() then
    if tg_op = 'INSERT' then
      new.onboarding_status := 'draft';
      new.account_status := 'active';
      new.performance_tier := 'starter';
      new.review_notes := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      new.onboarding_status := old.onboarding_status;
      new.account_status := old.account_status;
      new.performance_tier := old.performance_tier;
      new.review_notes := old.review_notes;
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists seller_profiles_guard_privileged_fields on public.seller_profiles;
create trigger seller_profiles_guard_privileged_fields before insert or update on public.seller_profiles
for each row execute function public.guard_seller_profile_privileged_fields();

alter table public.seller_profiles enable row level security;
alter table public.seller_addresses enable row level security;
alter table public.seller_documents enable row level security;
alter table public.marketplace_admins enable row level security;
alter table public.seller_status_events enable row level security;
alter table public.seller_appeals enable row level security;

-- Admin membership is intentionally not self-service. Provision the first super-admin
-- through a trusted SQL/admin workflow, never from the public client.
create or replace function public.is_current_marketplace_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.marketplace_admins ma
    where ma.user_id = auth.uid()
  );
$;

create or replace function public.is_current_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.marketplace_admins ma
    where ma.user_id = auth.uid() and ma.admin_role = 'super_admin'
  );
$;

create policy seller_profiles_select_own on public.seller_profiles
for select to authenticated using (user_id = (select auth.uid()) or (select public.is_current_marketplace_admin()));
create policy seller_profiles_insert_own on public.seller_profiles
for insert to authenticated with check (user_id = (select auth.uid()));
create policy seller_profiles_update_own on public.seller_profiles
for update to authenticated using (user_id = (select auth.uid()) or (select public.is_current_marketplace_admin())) with check (user_id = (select auth.uid()) or (select public.is_current_marketplace_admin()));

create policy seller_addresses_select_own on public.seller_addresses
for select to authenticated using (exists (
  select 1 from public.seller_profiles sp where sp.id = seller_id and sp.user_id = (select auth.uid())
) or (select public.is_current_marketplace_admin()));
create policy seller_addresses_insert_own on public.seller_addresses
for insert to authenticated with check (exists (
  select 1 from public.seller_profiles sp where sp.id = seller_id and sp.user_id = (select auth.uid())
));
create policy seller_addresses_update_own on public.seller_addresses
for update to authenticated using (exists (
  select 1 from public.seller_profiles sp where sp.id = seller_id and sp.user_id = (select auth.uid())
)) with check (exists (
  select 1 from public.seller_profiles sp where sp.id = seller_id and sp.user_id = (select auth.uid())
));
create policy seller_addresses_delete_own on public.seller_addresses
for delete to authenticated using (exists (
  select 1 from public.seller_profiles sp where sp.id = seller_id and sp.user_id = (select auth.uid())
));

create policy seller_documents_select_own on public.seller_documents
for select to authenticated using (exists (
  select 1 from public.seller_profiles sp where sp.id = seller_id and sp.user_id = (select auth.uid())
) or exists (select 1 from public.marketplace_admins ma where ma.user_id = (select auth.uid())));
create policy seller_documents_insert_own on public.seller_documents
for insert to authenticated with check (exists (
  select 1 from public.seller_profiles sp where sp.id = seller_id and sp.user_id = (select auth.uid())
));
create policy seller_documents_admin_update on public.seller_documents
for update to authenticated using ((select public.is_current_marketplace_admin())) with check (exists (
  select 1 from public.marketplace_admins ma where ma.user_id = (select auth.uid())
));

create policy marketplace_admins_read_self_or_super_admin on public.marketplace_admins
for select to authenticated using (user_id = (select auth.uid()) or (select public.is_current_super_admin()));

create policy seller_status_events_select_own_or_admin on public.seller_status_events
for select to authenticated using (exists (
  select 1 from public.seller_profiles sp where sp.id = seller_id and sp.user_id = (select auth.uid())
) or exists (select 1 from public.marketplace_admins ma where ma.user_id = (select auth.uid())));
create policy seller_status_events_insert_admin on public.seller_status_events
for insert to authenticated with check (exists (
  select 1 from public.marketplace_admins ma where ma.user_id = (select auth.uid())
));

create policy seller_appeals_select_own_or_admin on public.seller_appeals
for select to authenticated using (submitted_by = (select auth.uid()) or exists (
  select 1 from public.marketplace_admins ma where ma.user_id = (select auth.uid())
));
create policy seller_appeals_insert_own on public.seller_appeals
for insert to authenticated with check (submitted_by = (select auth.uid()) and exists (
  select 1 from public.seller_profiles sp where sp.id = seller_id and sp.user_id = (select auth.uid())
));
create policy seller_appeals_admin_update on public.seller_appeals
for update to authenticated using (exists (
  select 1 from public.marketplace_admins ma where ma.user_id = (select auth.uid())
)) with check (exists (
  select 1 from public.marketplace_admins ma where ma.user_id = (select auth.uid())
));

grant select, insert, update on public.seller_profiles to authenticated;
grant select, insert, update, delete on public.seller_addresses to authenticated;
grant select, insert, update on public.seller_documents to authenticated;
grant select on public.marketplace_admins to authenticated;
grant select, insert on public.seller_status_events to authenticated;
grant select, insert, update on public.seller_appeals to authenticated;
