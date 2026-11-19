-- Supabase SQL Editor version of provision-cinema-profiles.sql.
-- Replace only the two marked strings below with the existing Auth user UUIDs.
-- Keep the single quotes and ::uuid casts. Run the entire script together.

begin;

do $$
declare
  alex_id uuid := 'REPLACE_WITH_ALEX_AUTH_UUID'::uuid; -- Placeholder 1: alex
  partner_id uuid := 'REPLACE_WITH_PARTNER_AUTH_UUID'::uuid; -- Placeholder 2: partner
begin
  if alex_id = partner_id then
    raise exception 'Provide two distinct existing Auth user UUIDs';
  end if;

  insert into public.cinema_profiles (user_id, username)
    values (alex_id, 'alex'), (partner_id, 'partner')
    on conflict (user_id) do nothing;

  if not exists (select 1 from public.cinema_profiles where user_id = alex_id and username = 'alex')
    or not exists (select 1 from public.cinema_profiles where user_id = partner_id and username = 'partner')
  then
    raise exception 'A demo account already has a different profile';
  end if;
end;
$$;
commit;
