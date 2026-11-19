-- =====================================================================
--  Update v4: Admin-Seite (Stammdaten in der Datenbank)
--  Einmal ausführen (Supabase > SQL Editor > Run). Bestehende Daten bleiben erhalten.
-- =====================================================================

-- Stammdaten aus der Admin-Seite (Artikel, Tische, Kellner, Reviere, Veranstaltung)
create table if not exists public.einstellungen (
  schluessel    text        primary key,
  wert          jsonb,
  geaendert_am  timestamptz not null default now()
);

alter table public.einstellungen enable row level security;

drop policy if exists "einstellungen lesen"   on public.einstellungen;
drop policy if exists "einstellungen anlegen" on public.einstellungen;
drop policy if exists "einstellungen aendern" on public.einstellungen;

create policy "einstellungen lesen"   on public.einstellungen for select to anon, authenticated using (true);
create policy "einstellungen anlegen" on public.einstellungen for insert to anon, authenticated with check (true);
create policy "einstellungen aendern" on public.einstellungen for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.einstellungen to anon, authenticated;
