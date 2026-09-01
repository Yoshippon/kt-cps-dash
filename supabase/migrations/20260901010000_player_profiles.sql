-- Profiles and personal team galleries for claimed players.

create table if not exists public.player_profiles (
  player_id uuid primary key references public.players(id) on delete cascade,
  avatar_path text null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_team_images (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  team_id uuid not null,
  storage_path text not null unique,
  caption text null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  foreign key (player_id, team_id)
    references public.player_team_ownership(player_id, team_id)
    on delete cascade
);

create index if not exists player_team_images_owner_idx
  on public.player_team_images(player_id, team_id, sort_order, created_at);

alter table public.player_profiles enable row level security;
alter table public.player_team_images enable row level security;

create policy "Read all player profiles" on public.player_profiles
  for select using (true);

create policy "Players manage own profile" on public.player_profiles
  for all using (player_id = public.current_player_id())
  with check (player_id = public.current_player_id());

create policy "Read all player team images" on public.player_team_images
  for select using (true);

create policy "Players manage own team images" on public.player_team_images
  for all using (player_id = public.current_player_id())
  with check (player_id = public.current_player_id());

create policy "Players manage own team ownership" on public.player_team_ownership
  for all using (player_id = public.current_player_id())
  with check (player_id = public.current_player_id());

create trigger set_player_profiles_updated_at
before update on public.player_profiles
for each row
execute function public.set_updated_at();

create policy "Upload own profile media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media'
    and (
      (
        (storage.foldername(name))[1] = 'profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'player-teams'
        and (storage.foldername(name))[2] = public.current_player_id()::text
        and exists (
          select 1
          from public.player_team_ownership
          where player_id = public.current_player_id()
            and team_id = ((storage.foldername(name))[3])::uuid
        )
      )
    )
  );

create policy "Delete own profile media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'media'
    and (
      (
        (storage.foldername(name))[1] = 'profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'player-teams'
        and (storage.foldername(name))[2] = public.current_player_id()::text
      )
    )
  );
