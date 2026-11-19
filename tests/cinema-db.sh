#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
pg_bin="$(pg_config --bindir)"
fixture_dir="$(mktemp -d)"
cleanup() {
  if [[ -f "$fixture_dir/data/postmaster.pid" ]]; then
    "$pg_bin/pg_ctl" -D "$fixture_dir/data" -m immediate -w stop >/dev/null
  fi
  rm -rf "$fixture_dir"
}
trap cleanup EXIT

"$pg_bin/initdb" -D "$fixture_dir/data" -A trust -U postgres --no-locale >/dev/null
if ! "$pg_bin/pg_ctl" -D "$fixture_dir/data" -l "$fixture_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$fixture_dir'" -w start >/dev/null; then
  cat "$fixture_dir/postgres.log" >&2
  exit 1
fi
db=("$pg_bin/psql" -X -q -v ON_ERROR_STOP=1 -h "$fixture_dir" -p 5432 -U postgres -d postgres)

alex=aaaaaaaa-1111-4111-8111-111111111111
partner=bbbbbbbb-2222-4222-8222-222222222222
nonmember=cccccccc-3333-4333-8333-333333333333

"${db[@]}" -v alex="$alex" -v partner="$partner" -v nonmember="$nonmember" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role cinema_migrator nologin nosuperuser nobypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, cinema_migrator;
grant create on schema public to cinema_migrator;
grant references on auth.users to cinema_migrator;
-- Simulate permissive API defaults so the migration must revoke them explicitly.
alter default privileges for role cinema_migrator in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role cinema_migrator in schema public
  grant execute on functions to anon, authenticated, service_role;
insert into auth.users values (:'alex'), (:'partner'), (:'nonmember');
SQL

{
  printf 'set role cinema_migrator;\n'
  cat supabase/migrations/20261118000100_create_watchlist.sql
  cat supabase/migrations/20261118000200_create_cinema_sessions.sql
} | "${db[@]}"

# Repeat to verify idempotent setup with the intended mapping.
for attempt in 1 2; do
  "${db[@]}" -f supabase/provision-cinema-profiles.sql -v alex_uuid="$alex" -v partner_uuid="$partner"
done
if "${db[@]}" -f supabase/provision-cinema-profiles.sql -v alex_uuid="$partner" -v partner_uuid="$alex" \
  >"$fixture_dir/provision-conflict.log" 2>&1; then
  echo "Provisioning unexpectedly changed the existing username mapping" >&2
  exit 1
fi

"${db[@]}" -v alex="$alex" -v partner="$partner" -v nonmember="$nonmember" -f tests/cinema-db.sql >/dev/null

run_as() {
  local user="$1"
  shift
  "${db[@]}" -At -c "set role authenticated; set request.jwt.claim.sub = '$user';" -c "$1"
}

race_id="$(run_as "$alex" "select public.create_cinema_session('partner', array[20,30,40])")"
selection="select public.submit_cinema_vote('$race_id', array[30,40]);"
other_selection="select public.submit_cinema_vote('$race_id', array[20,30]);"

# Confirm A's insert is uncommitted and invisible while B submits.
run_as "$alex" "begin; $selection select pg_sleep(4); commit;" >"$fixture_dir/first.log" &
first=$!
for attempt in {1..100}; do
  [[ "$("${db[@]}" -At -c "select count(*) from pg_stat_activity where wait_event = 'PgSleep'")" == 1 ]] && break
  sleep 0.05
done
[[ "$attempt" -lt 100 ]]

run_as "$alex" "select public.submit_cinema_vote('$race_id', array[40,30]);" >"$fixture_dir/retry.log" &
retry=$!
run_as "$partner" "$other_selection" >"$fixture_dir/second.log"
[[ "$(run_as "$partner" "select public.read_cinema_session('$race_id')->>'partnerSubmitted'")" == false ]]
wait "$first"
wait "$retry"
[[ "$(run_as "$alex" "select public.read_cinema_session('$race_id')->'movies'->0->>'tmdb_movie_id'")" == 30 ]]
[[ "$("${db[@]}" -At -c "select count(*) from public.cinema_ballots where session_id = '$race_id'")" == 2 ]]
echo "Cinema SQL permissions, rules, and concurrent submissions passed."
