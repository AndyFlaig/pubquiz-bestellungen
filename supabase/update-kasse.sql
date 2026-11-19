-- =====================================================================
--  Kasse einrichten (einmal ausführen, Supabase > SQL Editor > Run)
--  Bestehende Bestellungen bleiben erhalten.
-- =====================================================================

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
