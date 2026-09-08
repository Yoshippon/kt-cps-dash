-- Catalog logos are stored in the public media bucket by kill team ID.

alter table public.kill_teams
  add column if not exists logo_path text null unique;

drop policy if exists "Admins upload catalog logo media" on storage.objects;
create policy "Admins upload catalog logo media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'team-logos'
    and public.is_admin()
  );

drop policy if exists "Admins read catalog logo media" on storage.objects;
create policy "Admins read catalog logo media" on storage.objects
  for select to authenticated using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'team-logos'
    and public.is_admin()
  );

drop policy if exists "Admins update catalog logo media" on storage.objects;
create policy "Admins update catalog logo media" on storage.objects
  for update to authenticated using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'team-logos'
    and public.is_admin()
  ) with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'team-logos'
    and public.is_admin()
  );
