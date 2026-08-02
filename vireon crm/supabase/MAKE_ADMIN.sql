-- VIREON LEAD HUB — SET THE ONE PERSONAL ADMINISTRATOR
-- Replace the email below, then run this entire file once.
-- The matching account becomes Administrator; every other account becomes Team Member.

do $$
declare
  target_email text := lower('hackerjhones11@gmail.com');
  target_id uuid;
begin
  select id into target_id
  from public.profiles
  where lower(email) = target_email
  limit 1;

  if target_id is null then
    raise exception 'No Vireon profile exists for %. Create that user in Supabase Authentication first, then run this file again.', target_email;
  end if;

  update public.profiles
  set role='member', updated_at=now()
  where id <> target_id;

  update public.profiles
  set role='admin', is_active=true, updated_at=now()
  where id = target_id;
end $$;

select full_name,email,role,is_active from public.profiles order by created_at;
