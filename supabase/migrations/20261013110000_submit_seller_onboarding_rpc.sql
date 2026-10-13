create or replace function public.guard_seller_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_current_super_admin()
     and coalesce(current_setting('app.seller_onboarding_submission', true), '') <> 'on'
  then
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

create or replace function public.submit_seller_onboarding(p_seller_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous text;
begin
  select sp.onboarding_status into v_previous
  from public.seller_profiles sp
  where sp.id = p_seller_id and sp.user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Seller profile not found';
  end if;

  if v_previous not in ('draft', 'needs_changes') then
    raise exception 'This seller profile cannot be submitted from its current status';
  end if;

  perform set_config('app.seller_onboarding_submission', 'on', true);

  update public.seller_profiles
  set onboarding_status = 'submitted', updated_at = now()
  where id = p_seller_id and user_id = auth.uid();

  insert into public.seller_status_events
    (seller_id, actor_user_id, event_type, previous_value, new_value)
  values
    (p_seller_id, auth.uid(), 'onboarding_submitted',
     jsonb_build_object('onboarding_status', v_previous),
     jsonb_build_object('onboarding_status', 'submitted'));
end;
$$;

revoke all on function public.submit_seller_onboarding(uuid) from public, anon;
grant execute on function public.submit_seller_onboarding(uuid) to authenticated;
