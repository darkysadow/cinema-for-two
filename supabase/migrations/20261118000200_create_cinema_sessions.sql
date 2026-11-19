begin;

create table public.cinema_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (
    username <> '' and username = lower(username)
    and username !~ '^[[:space:]]|[[:space:]]$'
  )
);

create table public.cinema_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id),
  invitee_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  check (host_id <> invitee_id)
);

create table public.cinema_candidates (
  session_id uuid not null references public.cinema_sessions (id),
  tmdb_movie_id integer not null check (tmdb_movie_id > 0),
  position integer not null check (position between 1 and 5),
  title text not null,
  poster_path text,
  release_year integer,
  primary key (session_id, tmdb_movie_id),
  unique (session_id, position)
);

create table public.cinema_ballots (
  session_id uuid not null references public.cinema_sessions (id),
  voter_id uuid not null references auth.users (id),
  movie_ids integer[] not null,
  submitted_at timestamptz not null default now(),
  primary key (session_id, voter_id),
  check (cardinality(movie_ids) <= 5)
);

alter table public.cinema_profiles enable row level security;
alter table public.cinema_sessions enable row level security;
alter table public.cinema_candidates enable row level security;
alter table public.cinema_ballots enable row level security;

revoke all on public.cinema_profiles, public.cinema_sessions, public.cinema_candidates, public.cinema_ballots
  from public, anon, authenticated, service_role;
grant select on public.cinema_profiles, public.cinema_sessions, public.cinema_candidates, public.cinema_ballots
  to authenticated;

create policy "Read own cinema profile"
  on public.cinema_profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Read assigned cinema sessions"
  on public.cinema_sessions for select to authenticated
  using ((select auth.uid()) in (host_id, invitee_id));

-- The session subqueries are themselves filtered by cinema_sessions RLS.
create policy "Read assigned cinema candidates"
  on public.cinema_candidates for select to authenticated
  using (exists (
    select 1 from public.cinema_sessions as s where s.id = cinema_candidates.session_id
  ));

create policy "Read own assigned cinema ballot"
  on public.cinema_ballots for select to authenticated
  using (voter_id = (select auth.uid()) and exists (
    select 1 from public.cinema_sessions as s where s.id = cinema_ballots.session_id
  ));

create function public.create_cinema_session(invitee_username text, candidate_ids integer[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invited uuid;
  created_session uuid;
  copied_count integer;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'session_unavailable';
  end if;

  if candidate_ids is null or cardinality(candidate_ids) not between 2 and 5
    or array_ndims(candidate_ids) is distinct from 1
    or exists (select 1 from unnest(candidate_ids) as selected(id) where id is null or id <= 0)
    or (select count(distinct id) from unnest(candidate_ids) as selected(id)) <> cardinality(candidate_ids)
  then
    raise exception using errcode = '22023', message = 'invalid_shortlist';
  end if;

  select p.user_id into invited
  from public.cinema_profiles as p
  where p.username = lower(regexp_replace(invitee_username, '^[[:space:]]+|[[:space:]]+$', '', 'g'));

  if invited is null then
    raise exception using errcode = '22023', message = 'unknown_username';
  elsif invited = actor then
    raise exception using errcode = '22023', message = 'self_invite';
  end if;

  insert into public.cinema_sessions (host_id, invitee_id)
    values (actor, invited) returning id into created_session;

  -- Ownership, order, and all snapshots come from this one statement.
  insert into public.cinema_candidates (session_id, tmdb_movie_id, position, title, poster_path, release_year)
    select created_session, w.tmdb_movie_id,
      row_number() over (order by w.saved_at desc, w.tmdb_movie_id desc),
      w.title, w.poster_path, w.release_year
    from public.watchlist_items as w
    where w.owner_id = actor and w.tmdb_movie_id = any(candidate_ids);
  get diagnostics copied_count = row_count;

  if copied_count <> cardinality(candidate_ids) then
    raise exception using errcode = '22023', message = 'shortlist_not_saved';
  end if;
  return created_session;
end;
$$;

create function public.submit_cinema_vote(target_session uuid, selected_ids integer[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized_ids integer[];
  stored_ids integer[];
begin
  if actor is null or not exists (
    select 1 from public.cinema_sessions as s where s.id = target_session and actor in (s.host_id, s.invitee_id)
  ) then
    raise exception using errcode = '42501', message = 'session_unavailable';
  end if;

  if selected_ids is null or cardinality(selected_ids) > 5
    or (cardinality(selected_ids) > 0 and array_ndims(selected_ids) is distinct from 1)
    or (select count(distinct id) from unnest(selected_ids) as selected(id)) <> cardinality(selected_ids)
    or exists (
      select 1 from unnest(selected_ids) as selected(id)
      where not exists (
        select 1 from public.cinema_candidates as c where c.session_id = target_session and c.tmdb_movie_id = selected.id
      )
    )
  then
    raise exception using errcode = '22023', message = 'invalid_ballot';
  end if;
  normalized_ids := array(select id from unnest(selected_ids) as selected(id) order by id);

  insert into public.cinema_ballots (session_id, voter_id, movie_ids)
    values (target_session, actor, normalized_ids)
    on conflict (session_id, voter_id) do nothing;

  if not found then
    -- A separate statement sees the winner after an overlapping insert at Read Committed.
    select b.movie_ids into stored_ids from public.cinema_ballots as b
      where b.session_id = target_session and b.voter_id = actor;
    if stored_ids is distinct from normalized_ids then
      raise exception using errcode = '22023', message = 'vote_already_submitted';
    end if;
  end if;
end;
$$;

create function public.read_cinema_session(target_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  -- One snapshot for authorization, both submissions, and the intersection.
  with actor as (
    select auth.uid() as user_id
  ), visible_session as (
    select s.id, s.host_id, s.invitee_id, actor.user_id
    from public.cinema_sessions as s cross join actor
    where s.id = target_session and actor.user_id in (s.host_id, s.invitee_id)
  )
  select jsonb_build_object(
    'isHost', s.user_id = s.host_id,
    'ownSubmitted', own.voter_id is not null,
    'partnerSubmitted', partner.voter_id is not null,
    'movies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tmdb_movie_id', c.tmdb_movie_id, 'title', c.title,
        'poster_path', c.poster_path, 'release_year', c.release_year
      ) order by c.position), '[]'::jsonb)
      from public.cinema_candidates as c
      where c.session_id = s.id and (
        own.voter_id is null or partner.voter_id is null
        or (c.tmdb_movie_id = any(own.movie_ids) and c.tmdb_movie_id = any(partner.movie_ids))
      )
    )
  ) from visible_session as s
  left join public.cinema_ballots as own on own.session_id = s.id and own.voter_id = s.user_id
  left join public.cinema_ballots as partner on partner.session_id = s.id
    and partner.voter_id = case when s.user_id = s.host_id then s.invitee_id else s.host_id end;
$$;

revoke all on function public.create_cinema_session(text, integer[]),
  public.submit_cinema_vote(uuid, integer[]), public.read_cinema_session(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_cinema_session(text, integer[]),
  public.submit_cinema_vote(uuid, integer[]), public.read_cinema_session(uuid) to authenticated;

commit;
