-- =====================================================================
--  Update v8: Knopf „Abend zurücksetzen“ im Admin
--  1. Unten bei MEIN-GEHEIMER-CODE einen eigenen Code eintragen (mind. 8 Zeichen,
--     nicht der Admin-PIN). Diesen Code braucht man später zum Zurücksetzen.
--  2. Alles einfügen und auf „Run“ klicken. Bestehende Daten bleiben erhalten.
--  Code später ändern: nur die letzte Zeile mit neuem Code erneut ausführen.
-- =====================================================================

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
  delete from public.durchsagen;               -- Nummerierung bleibt (wichtig für die Geräte)
  update public.ausverkauft set ausverkauft = false, geaendert_am = now();
  delete from public.einstellungen where schluessel in ('pause', 'personen');
  return json_build_object('ok', true, 'zeit', now());
end $$;

revoke all on function public.abend_zuruecksetzen(text) from public;
grant execute on function public.abend_zuruecksetzen(text) to anon, authenticated;

insert into public.admin_geheim (id, reset_code) values (1, 'MEIN-GEHEIMER-CODE')
  on conflict (id) do update set reset_code = excluded.reset_code;
