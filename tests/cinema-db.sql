create function pg_temp.assert_true(result boolean, label text) returns void language plpgsql as $$
begin
  if result is distinct from true then
    raise exception 'Assertion failed: %', label;
  end if;
end;
$$;

create function pg_temp.expect_error(statement text, error_code text, expected_message text default null)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = error_code and (expected_message is null or sqlerrm = expected_message) then
      return;
    end if;
    raise;
  end;
  raise exception 'Expected % from %', error_code, statement;
end;
$$;

do $$
begin
  perform pg_temp.assert_true(
    (select count(*) = 3 and bool_and(
      p.prosecdef and p.proconfig = array['search_path=""']
      and not owner_role.rolsuper and not owner_role.rolbypassrls
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not exists (select 1 from aclexplode(p.proacl) where grantee = 0)
    ) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      join pg_roles owner_role on owner_role.oid = p.proowner
      where n.nspname = 'public' and p.prosecdef),
    'Only three authenticated definer RPCs, each with fixed search path and no anonymous/public execution');
  perform pg_temp.assert_true(
    (select count(*) = 4 and bool_and(
      c.relkind = 'r' and c.relrowsecurity
      and not has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
      and not has_table_privilege('service_role', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
      and has_table_privilege('authenticated', c.oid, 'SELECT')
      and not has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
      and not exists (select 1 from aclexplode(c.relacl) where grantee = 0)
    ) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname like 'cinema_%' and c.relkind in ('r', 'v', 'm')),
    'All four cinema relations use RLS, have no anonymous/public access, and grant authenticated SELECT only');
end;
$$;

insert into public.watchlist_items (owner_id, tmdb_movie_id, title, saved_at) values
  (:'alex', 10, 'Movie A', '2026-01-01'),
  (:'alex', 20, 'Movie B', '2026-01-02'),
  (:'alex', 30, 'Movie C', '2026-01-03'),
  (:'alex', 40, 'Movie D', '2026-01-04'),
  (:'alex', 50, 'Movie E', '2026-01-05'),
  (:'partner', 99, 'Partner’s saved movie', '2026-01-01');

set role anon;
select pg_temp.expect_error('select * from public.cinema_profiles', '42501');
select pg_temp.expect_error('select * from public.cinema_sessions', '42501');
select pg_temp.expect_error('select * from public.cinema_candidates', '42501');
select pg_temp.expect_error('select * from public.cinema_ballots', '42501');
select pg_temp.expect_error('select public.create_cinema_session(''partner'', array[10,20])', '42501');
select pg_temp.expect_error('select public.read_cinema_session(null)', '42501');
select pg_temp.expect_error('select public.submit_cinema_vote(null, array[]::integer[])', '42501');

set role authenticated;
select pg_temp.expect_error('select public.create_cinema_session(''partner'', array[10,20])', '42501', 'session_unavailable');
select set_config('request.jwt.claim.sub', :'alex', false) as actor \gset
select pg_temp.assert_true((select array_agg(username) = array['alex'] from public.cinema_profiles), 'Own profile only');
select pg_temp.expect_error('select public.create_cinema_session(''alex'', array[10,20])', '22023', 'self_invite');
select pg_temp.expect_error('select public.create_cinema_session(''part'', array[10,20])', '22023', 'unknown_username');
select pg_temp.expect_error('select public.create_cinema_session(''partner'', array[10])', '22023', 'invalid_shortlist');
select pg_temp.expect_error('select public.create_cinema_session(''partner'', array[10,10])', '22023', 'invalid_shortlist');
select pg_temp.expect_error('select public.create_cinema_session(''partner'', array[10,20,30,40,50,60])', '22023', 'invalid_shortlist');
select pg_temp.expect_error('select public.create_cinema_session(''partner'', array[10,99])', '22023', 'shortlist_not_saved');
select pg_temp.expect_error('select public.create_cinema_session(''partner'', array[10,null])', '22023', 'invalid_shortlist');
select pg_temp.expect_error('select public.create_cinema_session(''partner'', array[10,20], ''aaaaaaaa-1111-4111-8111-111111111111'')', '42883');
select pg_temp.assert_true((select count(*) = 0 from public.cinema_sessions), 'Failed creations left no sessions');
select pg_temp.assert_true((select count(*) = 0 from public.cinema_candidates), 'Failed creations left no candidates');

select public.create_cinema_session(E'  PaRTnEr\t', array[10,20,30,40,50]) as session_id \gset
select pg_temp.assert_true((select array_agg(tmdb_movie_id order by position) = array[50,40,30,20,10]
  from public.cinema_candidates where session_id = :'session_id'), 'Watchlist display order at creation');
select pg_temp.assert_true(public.read_cinema_session(:'session_id') @> '{"isHost":true,"ownSubmitted":false,"partnerSubmitted":false}',
  'Member reads waiting status before either ballot');
select pg_temp.expect_error('update public.cinema_sessions set invitee_id = host_id', '42501');
select pg_temp.expect_error('delete from public.cinema_candidates', '42501');
select pg_temp.expect_error('update public.cinema_profiles set username = ''new''', '42501');
select pg_temp.expect_error('insert into public.cinema_ballots (session_id, voter_id, movie_ids) values (null, null, null)', '42501');
select pg_temp.expect_error('update public.cinema_ballots set movie_ids = ''{}''', '42501');
select pg_temp.expect_error('delete from public.cinema_ballots', '42501');
select pg_temp.expect_error(format('select public.submit_cinema_vote(%L, array[10,10])', :'session_id'), '22023', 'invalid_ballot');
select pg_temp.expect_error(format('select public.submit_cinema_vote(%L, array[99])', :'session_id'), '22023', 'invalid_ballot');
select pg_temp.expect_error(format('select public.submit_cinema_vote(%L, array[10,null])', :'session_id'), '22023', 'invalid_ballot');
select pg_temp.expect_error(format('select public.submit_cinema_vote(%L, null)', :'session_id'), '22023', 'invalid_ballot');
select pg_temp.expect_error(format('select public.submit_cinema_vote(%L, array[10], %L)', :'session_id', :'partner'), '42883');
select pg_temp.assert_true((select count(*) = 0 from public.cinema_ballots), 'Invalid votes left no rows');

delete from public.watchlist_items where owner_id = :'alex' and tmdb_movie_id = 10;
select public.submit_cinema_vote(:'session_id', array[10,20,30]);
select submitted_at as submitted_at from public.cinema_ballots \gset
select public.submit_cinema_vote(:'session_id', array[30,10,20]);
select pg_temp.assert_true((select submitted_at = :'submitted_at' from public.cinema_ballots), 'Identical retry preserves timestamp');
select pg_temp.expect_error(format('select public.submit_cinema_vote(%L, array[20])', :'session_id'), '22023', 'vote_already_submitted');

select set_config('request.jwt.claim.sub', :'partner', false) as actor \gset
select pg_temp.assert_true((select array_agg(username) = array['partner'] from public.cinema_profiles), 'Invitee profile isolation');
select pg_temp.assert_true((select count(*) = 1 from public.cinema_sessions), 'Invitee can read assigned session');
select pg_temp.assert_true((select count(*) = 5 from public.cinema_candidates), 'Invitee reads frozen candidates after removal');
select pg_temp.assert_true((select count(*) = 0 from public.cinema_ballots), 'Invitee cannot read first ballot');
select pg_temp.assert_true(public.read_cinema_session(:'session_id') @> '{"isHost":false,"ownSubmitted":false,"partnerSubmitted":true}'
  and jsonb_array_length(public.read_cinema_session(:'session_id')->'movies') = 5, 'A single vote returns only coarse status and shortlist');
select public.submit_cinema_vote(:'session_id', array[10,30,40]);
select pg_temp.assert_true((select array_agg(movie_ids) = array[array[10,30,40]] from public.cinema_ballots), 'Invitee reads only own ballot after completion');
select pg_temp.assert_true((select array_agg((movie->>'tmdb_movie_id')::int) = array[30,10]
  from jsonb_array_elements(public.read_cinema_session(:'session_id')->'movies') as movie), 'Exact intersection in shortlist order');
select pg_temp.assert_true((select array_agg(key order by key) = array['isHost','movies','ownSubmitted','partnerSubmitted']
  from jsonb_object_keys(public.read_cinema_session(:'session_id')) as key), 'RPC response contains only approved fields');

select set_config('request.jwt.claim.sub', :'nonmember', false) as actor \gset
select pg_temp.assert_true((select count(*) = 0 from public.cinema_sessions), 'Nonmember cannot read a session');
select pg_temp.assert_true((select count(*) = 0 from public.cinema_candidates), 'Nonmember cannot read candidates');
select pg_temp.assert_true((select count(*) = 0 from public.cinema_ballots), 'Nonmember cannot read ballots');
select pg_temp.assert_true(public.read_cinema_session(:'session_id') is null, 'Nonmember cannot read statuses or results');
select pg_temp.expect_error(format('select public.submit_cinema_vote(%L, array[10])', :'session_id'), '42501', 'session_unavailable');

select set_config('request.jwt.claim.sub', :'alex', false) as actor \gset
select pg_temp.assert_true((select array_agg(movie_ids) = array[array[10,20,30]] from public.cinema_ballots), 'Host reads only own unchanged ballot');
select pg_temp.assert_true((select array_agg((movie->>'tmdb_movie_id')::int) = array[30,10]
  from jsonb_array_elements(public.read_cinema_session(:'session_id')->'movies') as movie), 'Host sees the same completed result');
select public.create_cinema_session('partner', array[20,30]) as empty_id \gset
select public.submit_cinema_vote(:'empty_id', array[]::integer[]);
select pg_temp.assert_true(public.read_cinema_session(:'empty_id') @> '{"ownSubmitted":true,"partnerSubmitted":false}', 'Empty ballot counts as submitted');
select public.create_cinema_session('partner', array[20,30]) as disjoint_id \gset
select public.submit_cinema_vote(:'disjoint_id', array[20]);
select public.create_cinema_session('partner', array[20,30]) as identical_id \gset
select public.submit_cinema_vote(:'identical_id', array[20,30]);

select set_config('request.jwt.claim.sub', :'partner', false) as actor \gset
select public.submit_cinema_vote(:'empty_id', array[20]);
select public.submit_cinema_vote(:'disjoint_id', array[30]);
select public.submit_cinema_vote(:'identical_id', array[30,20]);
select pg_temp.assert_true(public.read_cinema_session(:'empty_id') @> '{"ownSubmitted":true,"partnerSubmitted":true,"movies":[]}'
  and public.read_cinema_session(:'empty_id')->'movies' = '[]', 'Empty vote completes without matches');
select pg_temp.assert_true(public.read_cinema_session(:'disjoint_id')->'movies' = '[]', 'Disjoint votes produce no matches');
select pg_temp.assert_true(jsonb_array_length(public.read_cinema_session(:'identical_id')->'movies') = 2, 'Identical votes preserve all matches');
