-- Optional seller profile photo, separate from business identity and verification.
alter table seller.seller_profiles
  add column if not exists profile_photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seller-profile-photos', 'seller-profile-photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Seller profile photos are public" on storage.objects;
create policy "Seller profile photos are public"
  on storage.objects for select
  using (bucket_id = 'seller-profile-photos');

drop policy if exists "Sellers upload their own profile photos" on storage.objects;
create policy "Sellers upload their own profile photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'seller-profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from seller.seller_profiles sp
      where sp.user_id = auth.uid()
        and sp.onboarding_status = 'approved'
        and sp.account_status = 'active'
    )
  );

drop policy if exists "Sellers update their own profile photos" on storage.objects;
create policy "Sellers update their own profile photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'seller-profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'seller-profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Sellers delete their own profile photos" on storage.objects;
create policy "Sellers delete their own profile photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'seller-profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

grant select on seller.seller_profiles to authenticated;
