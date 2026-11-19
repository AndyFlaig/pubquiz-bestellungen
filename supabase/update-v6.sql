-- =====================================================================
--  Update v6: Durchsagen an alle Geräte
--  Einmal ausführen (Supabase > SQL Editor > Run). Bestehende Daten bleiben erhalten.
-- =====================================================================

-- Durchsagen an alle Geräte
create table if not exists public.durchsagen (
  id           bigint generated always as identity primary key,
  text         text        not null check (char_length(text) between 1 and 200),
  von          text,
  erstellt_am  timestamptz not null default now()
);

alter table public.durchsagen enable row level security;

drop policy if exists "durchsagen lesen"   on public.durchsagen;
drop policy if exists "durchsagen anlegen" on public.durchsagen;

create policy "durchsagen lesen"   on public.durchsagen for select to anon, authenticated using (true);
create policy "durchsagen anlegen" on public.durchsagen for insert to anon, authenticated with check (true);

grant select, insert on public.durchsagen to anon, authenticated;
