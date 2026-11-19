-- =====================================================================
--  Erweiterung für Snacks (einmal ausführen, wenn die Tabelle schon existiert)
--  Supabase > SQL Editor > einfügen > Run. Bestehende Daten bleiben erhalten.
-- =====================================================================

alter table public.bestellungen drop constraint if exists bestellungen_ziel_check;
alter table public.bestellungen add constraint bestellungen_ziel_check
  check (ziel in ('kueche', 'theke', 'kasse'));

drop policy if exists "bestellungen anlegen" on public.bestellungen;
create policy "bestellungen anlegen" on public.bestellungen for insert to anon, authenticated
  with check (status = 'offen' or (ziel = 'kasse' and status = 'erledigt'));
