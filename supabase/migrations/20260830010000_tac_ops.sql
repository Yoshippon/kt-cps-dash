-- Tactical operation catalog.
-- Run once in Supabase SQL Editor after supabase/schema.sql.

create table if not exists public.tac_op_archetypes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tac_ops (
  id uuid primary key default gen_random_uuid(),
  number integer not null,
  name text not null,
  archetype_id uuid null references public.tac_op_archetypes(id) on delete restrict,
  approved_ops_pack_id uuid null references public.approved_ops_packs(id) on delete restrict,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tac_ops
  add column if not exists number integer null;

alter table public.tac_ops
  add column if not exists archetype_id uuid null references public.tac_op_archetypes(id) on delete restrict;

alter table public.tac_ops
  add column if not exists approved_ops_pack_id uuid null references public.approved_ops_packs(id) on delete restrict;

create unique index if not exists tac_ops_name_idx on public.tac_ops (name);
create index if not exists tac_ops_number_idx on public.tac_ops (number);
create index if not exists tac_ops_archetype_idx on public.tac_ops (archetype_id);
create index if not exists tac_ops_pack_idx on public.tac_ops (approved_ops_pack_id);

alter table public.tac_op_archetypes enable row level security;
alter table public.tac_ops enable row level security;

drop policy if exists "Read all tac op archetypes" on public.tac_op_archetypes;
create policy "Read all tac op archetypes" on public.tac_op_archetypes
  for select using (true);

drop policy if exists "Admins manage tac op archetypes" on public.tac_op_archetypes;
create policy "Admins manage tac op archetypes" on public.tac_op_archetypes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Read all tac ops" on public.tac_ops;
create policy "Read all tac ops" on public.tac_ops
  for select using (true);

drop policy if exists "Admins manage tac ops" on public.tac_ops;
create policy "Admins manage tac ops" on public.tac_ops
  for all using (public.is_admin()) with check (public.is_admin());
