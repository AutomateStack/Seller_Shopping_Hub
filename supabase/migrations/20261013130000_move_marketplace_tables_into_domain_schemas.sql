-- Move marketplace tables into domain schemas and keep secure RPCs working.
alter table public.seller_profiles set schema seller;
alter table public.seller_addresses set schema seller;
alter table public.seller_documents set schema seller;
alter table public.marketplace_admins set schema marketplace;
alter table public.seller_status_events set schema audit;
alter table public.seller_appeals set schema support;

grant usage on schema seller, marketplace, audit, support to authenticated;
grant usage on schema seller, marketplace, audit, support to service_role;
grant select, insert, update on seller.seller_profiles to authenticated;
grant select, insert, update, delete on seller.seller_addresses to authenticated;
grant select, insert, update on seller.seller_documents to authenticated;
grant select on marketplace.marketplace_admins to authenticated;
grant select, insert on audit.seller_status_events to authenticated;
grant select, insert, update on support.seller_appeals to authenticated;

create or replace function public.is_current_marketplace_admin()
returns boolean language sql stable security definer set search_path = ''
as 'select exists (select 1 from marketplace.marketplace_admins ma where ma.user_id = auth.uid())';

create or replace function public.is_current_super_admin()
returns boolean language sql stable security definer set search_path = ''
as 'select exists (select 1 from marketplace.marketplace_admins ma where ma.user_id = auth.uid() and ma.admin_role = ''super_admin'')';

create or replace function public.submit_seller_onboarding(p_seller_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid; v_status text;
begin
  select sp.user_id, sp.onboarding_status into v_user_id, v_status
  from seller.seller_profiles sp where sp.id = p_seller_id for update;
  if not found or v_user_id <> auth.uid() then raise exception 'Seller profile not found'; end if;
  if v_status not in ('draft', 'needs_changes') then raise exception 'This application cannot be submitted in its current status'; end if;
  perform set_config('app.seller_onboarding_submission', 'on', true);
  update seller.seller_profiles set onboarding_status = 'submitted', updated_at = now() where id = p_seller_id;
  insert into audit.seller_status_events (seller_id, actor_user_id, event_type, previous_value, new_value)
  values (p_seller_id, auth.uid(), 'onboarding_submitted',
    jsonb_build_object('onboarding_status', v_status),
    jsonb_build_object('onboarding_status', 'submitted'));
end;
$$;
revoke all on function public.submit_seller_onboarding(uuid) from public, anon;
grant execute on function public.submit_seller_onboarding(uuid) to authenticated;

create or replace function public.review_seller_application(p_seller_id uuid, p_decision text, p_reason text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_old_status text; v_role text;
begin
  select ma.admin_role into v_role from marketplace.marketplace_admins ma where ma.user_id = auth.uid();
  if v_role is null or v_role not in ('reviewer', 'operations', 'super_admin') then raise exception 'You are not authorized to review seller applications'; end if;
  if p_decision not in ('approved', 'rejected', 'needs_changes') then raise exception 'Unsupported seller review decision'; end if;
  if p_decision in ('rejected', 'needs_changes') and char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Please provide a reason of at least 5 characters'; end if;
  select sp.onboarding_status into v_old_status from seller.seller_profiles sp where sp.id = p_seller_id for update;
  if not found then raise exception 'Seller application not found'; end if;
  if v_old_status not in ('submitted', 'under_review', 'needs_changes') then raise exception 'Only submitted applications can be reviewed'; end if;
  perform set_config('app.seller_onboarding_submission', 'on', true);
  update seller.seller_profiles set onboarding_status = p_decision,
    review_notes = nullif(trim(coalesce(p_reason, '')), ''), reviewed_by = auth.uid(),
    reviewed_at = now(), updated_at = now() where id = p_seller_id;
  insert into audit.seller_status_events (seller_id, actor_user_id, event_type, previous_value, new_value, reason)
  values (p_seller_id, auth.uid(),
    case p_decision when 'approved' then 'approved' when 'rejected' then 'rejected' else 'needs_changes' end,
    jsonb_build_object('onboarding_status', v_old_status),
    jsonb_build_object('onboarding_status', p_decision),
    nullif(trim(coalesce(p_reason, '')), ''));
end;
$$;
revoke all on function public.review_seller_application(uuid, text, text) from public, anon;
grant execute on function public.review_seller_application(uuid, text, text) to authenticated;
