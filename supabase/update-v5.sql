-- =====================================================================
--  Update v5: Eigenverzehr
--  Einmal ausführen (Supabase > SQL Editor > Run). Bestehende Daten bleiben erhalten.
-- =====================================================================

-- Eigenverzehr: Bestellungen für Personal/Helfer – zählen in der Inventur, nicht im Umsatz
alter table public.bestellungen add column if not exists eigenverzehr boolean not null default false;
