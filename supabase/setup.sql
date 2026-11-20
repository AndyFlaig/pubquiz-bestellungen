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
  with check (status = 'offen' or (ziel = 'kasse' and status = 'erledigt'));   -- 'kasse' = Snacks, direkt erledigt
create policy "bestellungen status"  on public.bestellungen for update to anon, authenticated using (true) with check (true);

-- Snacks (ziel = 'kasse') erlauben – auch bei schon bestehender Tabelle
alter table public.bestellungen drop constraint if exists bestellungen_ziel_check;
alter table public.bestellungen add constraint bestellungen_ziel_check check (ziel in ('kueche', 'theke', 'kasse'));

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

-- Eigenverzehr: Bestellungen für Personal/Helfer – zählen in der Inventur, nicht im Umsatz
alter table public.bestellungen add column if not exists eigenverzehr boolean not null default false;

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

-- Trinkgeld bei der Zahlung (zählt zum Gesamtumsatz und zum Kassenstand, nicht zum Warenbetrag)
alter table public.zahlungen add column if not exists trinkgeld numeric(8,2) not null default 0 check (trinkgeld >= 0);

-- Abend zurücksetzen (Knopf im Admin) – geschützt durch einen geheimen Reset-Code.
-- Der Code liegt in einer Tabelle, die über die App NICHT lesbar ist.
create table if not exists public.admin_geheim (
  id          int  primary key default 1 check (id = 1),
  reset_code  text not null
);
alter table public.admin_geheim enable row level security;   -- keine Regeln = kein Zugriff über die App
revoke all on public.admin_geheim from anon, authenticated;

create or replace function public.abend_zuruecksetzen(code text) returns json
language plpgsql security definer set search_path = public as $$
declare
  richtig boolean;
begin
  select reset_code = code into richtig from public.admin_geheim where id = 1;
  if not coalesce(richtig, false) then
    perform pg_sleep(2);                       -- Raten bremsen
    raise exception 'Falscher Reset-Code';
  end if;
  truncate table public.bestellungen, public.zahlungen restart identity;
  -- Supabase verbietet DELETE/UPDATE ohne WHERE (Sicherheitssperre) – daher die ausdrücklichen Bedingungen
  delete from public.durchsagen where id is not null;          -- Nummerierung bleibt (wichtig für die Geräte)
  update public.ausverkauft set ausverkauft = false, geaendert_am = now() where ausverkauft;
  delete from public.einstellungen where schluessel in ('pause', 'personen');
  return json_build_object('ok', true, 'zeit', now());
end $$;

revoke all on function public.abend_zuruecksetzen(text) from public;
grant execute on function public.abend_zuruecksetzen(text) to anon, authenticated;
-- Reset-Code: nur beim ersten Mal anlegen – danach mit update-v8.sql ändern
insert into public.admin_geheim (id, reset_code) values (1, 'BITTE-AENDERN-' || substr(md5(random()::text), 1, 8))
  on conflict (id) do nothing;

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
--  Kontrolle: zeigt unten eine Tabelle. Erwartet werden 15 Zeilen, darunter
--  "bestellungen anlegen" mit ... ziel = 'kasse' ... und
--  "bestellungen_ziel_check" mit ... 'kueche', 'theke', 'kasse' ...
-- ---------------------------------------------------------------------
select c.relname as tabelle, p.polname as regel_oder_pruefung,
       coalesce(pg_get_expr(p.polwithcheck, p.polrelid), pg_get_expr(p.polqual, p.polrelid), '') as bedingung
from pg_policy p join pg_class c on c.oid = p.polrelid
where c.relname in ('bestellungen', 'zahlungen', 'ausverkauft', 'einstellungen', 'durchsagen')
union all
select 'bestellungen', conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid = 'public.bestellungen'::regclass and conname = 'bestellungen_ziel_check'
order by 1, 2;

-- ---------------------------------------------------------------------
--  Nach dem Testen: alle Test-Bestellungen löschen
--  (nur die folgende Zeile markieren und ausführen!)
-- ---------------------------------------------------------------------
-- truncate table public.bestellungen, public.zahlungen restart identity;
