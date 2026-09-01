-- Match image storage and metadata.
-- Run once in Supabase SQL Editor after supabase/schema.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.match_images (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  storage_path text not null unique,
  caption text null,
  sort_order integer not null default 0 check (sort_order >= 0),
  uploaded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists match_images_match_id_idx on public.match_images (match_id, sort_order, created_at);

alter table public.match_images enable row level security;

drop policy if exists "Read all match images" on public.match_images;
create policy "Read all match images" on public.match_images for select using (true);

drop policy if exists "Add own or admin match images" on public.match_images;
create policy "Add own or admin match images" on public.match_images
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.matches as match
      where match.id = public.match_images.match_id
        and (
          public.is_admin()
          or match.player_one_id = public.current_player_id()
          or match.player_two_id = public.current_player_id()
        )
    )
  );

drop policy if exists "Delete own or admin match images" on public.match_images;
create policy "Delete own or admin match images" on public.match_images
  for delete using (
    exists (
      select 1 from public.matches as match
      where match.id = public.match_images.match_id
        and (
          public.is_admin()
          or match.player_one_id = public.current_player_id()
          or match.player_two_id = public.current_player_id()
        )
    )
  );

drop policy if exists "Upload own or admin match media" on storage.objects;
create policy "Upload own or admin match media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'matches'
    and exists (
      select 1 from public.matches
      where id = ((storage.foldername(name))[2])::uuid
        and (
          public.is_admin()
          or player_one_id = public.current_player_id()
          or player_two_id = public.current_player_id()
        )
    )
  );

drop policy if exists "Delete own or admin match media" on storage.objects;
create policy "Delete own or admin match media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'matches'
    and exists (
      select 1 from public.matches
      where id = ((storage.foldername(name))[2])::uuid
        and (
          public.is_admin()
          or player_one_id = public.current_player_id()
          or player_two_id = public.current_player_id()
        )
    )
  );
