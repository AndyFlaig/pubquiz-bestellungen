-- =====================================================================
--  Update: Ausverkauft-Schalter + Abrechnung pro Artikel
--  Einmal ausführen (Supabase > SQL Editor > Run). Bestehende Daten bleiben erhalten.
--  Voraussetzung: update-kasse.sql wurde schon ausgeführt.
-- =====================================================================

-- Kasse: welche Artikel mit einer Zahlung bezahlt wurden (Abrechnung pro Artikel)
alter table public.zahlungen add column if not exists positionen jsonb;

-- Ausverkauft-Schalter (Küche/Theke schalten, Kellner sehen es)
create table if not exists public.ausverkauft (
  artikel_id    text        primary key,
  ausverkauft   boolean     not null default false,
  geaendert_am  timestamptz not null default now()
);

alter table public.ausverkauft enable row level security;

drop policy if exists "ausverkauft lesen"   on public.ausverkauft;
drop policy if exists "ausverkauft anlegen" on public.ausverkauft;
drop policy if exists "ausverkauft aendern" on public.ausverkauft;

create policy "ausverkauft lesen"   on public.ausverkauft for select to anon, authenticated using (true);
create policy "ausverkauft anlegen" on public.ausverkauft for insert to anon, authenticated with check (true);
create policy "ausverkauft aendern" on public.ausverkauft for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.ausverkauft to anon, authenticated;
