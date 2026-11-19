-- =====================================================================
--  Update v7: Trinkgeld
--  Einmal ausführen (Supabase > SQL Editor > Run). Bestehende Daten bleiben erhalten.
-- =====================================================================

-- Trinkgeld bei der Zahlung (zählt zum Gesamtumsatz und zum Kassenstand, nicht zum Warenbetrag)
alter table public.zahlungen add column if not exists trinkgeld numeric(8,2) not null default 0 check (trinkgeld >= 0);
