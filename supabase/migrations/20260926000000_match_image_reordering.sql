-- Allow match participants and administrators to set image display order.

drop policy if exists "Reorder own or admin match images" on public.match_images;
create policy "Reorder own or admin match images" on public.match_images
  for update to authenticated
  using (
    exists (
      select 1 from public.matches as match
      where match.id = public.match_images.match_id
        and (
          public.is_admin()
          or match.player_one_id = public.current_player_id()
          or match.player_two_id = public.current_player_id()
        )
    )
  )
  with check (
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
