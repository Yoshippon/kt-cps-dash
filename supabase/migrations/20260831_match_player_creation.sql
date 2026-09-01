-- Allow claimed players to log a match against a player not yet in the roster.
-- Existing player writes remain admin-only.

drop policy if exists "Claimed players create opponents" on public.players;

create policy "Claimed players create opponents" on public.players
  for insert with check (public.current_player_id() is not null);
