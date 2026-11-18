create table public.watchlist_items (
  owner_id uuid not null references auth.users (id) on delete cascade,
  tmdb_movie_id integer not null check (tmdb_movie_id > 0),
  saved_at timestamptz not null default now(),
  title text not null check (length(btrim(title)) > 0),
  poster_path text check (poster_path ~* '^/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$'),
  release_year integer check (release_year between 1 and 9999),
  primary key (owner_id, tmdb_movie_id)
);

alter table public.watchlist_items enable row level security;

revoke all privileges on table public.watchlist_items from public, anon, authenticated;
grant select, delete on table public.watchlist_items to authenticated;
grant insert (owner_id, tmdb_movie_id, title, poster_path, release_year)
  on table public.watchlist_items to authenticated;

create policy "Owners can read saved movies"
  on public.watchlist_items for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can save movies"
  on public.watchlist_items for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can remove saved movies"
  on public.watchlist_items for delete to authenticated
  using ((select auth.uid()) = owner_id);
