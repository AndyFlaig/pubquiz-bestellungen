-- =====================================================================
--  Pub-Quiz Bestell-App – Datenbank einrichten
--  Komplett in Supabase > SQL Editor einfügen und auf "Run" klicken.
--  Darf mehrfach ausgeführt werden.
-- =====================================================================

create table if not exists public.bestellungen (
  id            bigint generated always as identity primary key,
  gruppe        uuid        not null,               -- verbindet Küchen- und Theken-Teil einer Bestellung
  ziel          text        not null check (ziel in ('kueche', 'theke', 'kasse')),  -- kasse = nur erfassen (Snacks)
  tisch         int         not null,
  team          text        not null,
  kellner       text        not null,
  positionen    jsonb       not null,               -- [{ "id", "name", "menge", "preis", "anzahl" }]
  kommentar     text,
  status        text        not null default 'offen'
                            check (status in ('offen', 'erledigt', 'storniert')),
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz
);

create index if not exists bestellungen_status_ziel_idx on public.bestellungen (status, ziel);

-- Zugriff ohne Benutzerkonten (nur über den öffentlichen "anon"-Schlüssel):
-- lesen, anlegen und Status ändern ist erlaubt, löschen nicht.
alter table public.bestellungen enable row level security;

drop policy if exists "bestellungen lesen"   on public.bestellungen;
drop policy if exists "bestellungen anlegen" on public.bestellungen;
drop policy if exists "bestellungen status"  on public.bestellungen;

create policy "bestellungen lesen"   on public.bestellungen for select to anon, authenticated using (true);
create policy "bestellungen anlegen" on public.bestellungen for insert to anon, authenticated
  with check (status = 'offen' or (ziel = 'kasse' and status = 'erledigt'));

-- Erweiterung für Snacks auch bei schon bestehender Tabelle
alter table public.bestellungen drop constraint if exists bestellungen_ziel_check;
alter table public.bestellungen add constraint bestellungen_ziel_check check (ziel in ('kueche', 'theke', 'kasse'));
create policy "bestellungen status"  on public.bestellungen for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.bestellungen to anon, authenticated;

-- Kasse: Zahlungen (nur Bargeld). Jeder Kellner kassiert selbst.
create table if not exists public.zahlungen (
  id            bigint generated always as identity primary key,
  tisch         int          not null,
  kellner       text         not null,
  betrag        numeric(8,2) not null check (betrag > 0),
  status        text         not null default 'gueltig' check (status in ('gueltig', 'storniert')),
  erstellt_am   timestamptz  not null default now(),
  geaendert_am  timestamptz
);

alter table public.zahlungen enable row level security;

drop policy if exists "zahlungen lesen"   on public.zahlungen;
drop policy if exists "zahlungen anlegen" on public.zahlungen;
drop policy if exists "zahlungen status"  on public.zahlungen;

create policy "zahlungen lesen"   on public.zahlungen for select to anon, authenticated using (true);
create policy "zahlungen anlegen" on public.zahlungen for insert to anon, authenticated with check (status = 'gueltig');
create policy "zahlungen status"  on public.zahlungen for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.zahlungen to anon, authenticated;

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

-- Live-Updates (Realtime) für die Tabelle einschalten
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bestellungen'
  ) then
    alter publication supabase_realtime add table public.bestellungen;
  end if;
end $$;

-- ---------------------------------------------------------------------
--  Nach dem Testen: alle Test-Bestellungen löschen
--  (nur die folgende Zeile markieren und ausführen!)
-- ---------------------------------------------------------------------
-- truncate table public.bestellungen, public.zahlungen restart identity;
