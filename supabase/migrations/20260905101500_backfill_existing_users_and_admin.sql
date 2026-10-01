-- Auth users created before the initial schema deployment do not pass through
-- the profile trigger. Backfill their profiles, then grant the named owner the
-- application admin role.
insert into public.profiles (id, email, full_name)
select id, email, raw_user_meta_data ->> 'full_name'
from auth.users
where email is not null
on conflict (id) do update
set email = excluded.email;

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where lower(email) = lower('tthirmal@gmail.com')
on conflict (user_id, role) do nothing;
