\set ON_ERROR_STOP on

begin;
select set_config('cinema.alex_uuid', :'alex_uuid', true) as alex_id,
  set_config('cinema.partner_uuid', :'partner_uuid', true) as partner_id
\gset

do $$
declare
  alex_id uuid := current_setting('cinema.alex_uuid')::uuid;
  partner_id uuid := current_setting('cinema.partner_uuid')::uuid;
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
