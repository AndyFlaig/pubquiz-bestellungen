# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Handy-Web-App für Bestellungen beim Vereins-Pub-Quiz (Gutholz Schiltach): Kellner bestellen am Handy, Speisen gehen live an die Küche, Getränke an die Theke; dazu Kasse, Auswertung, Admin und Beamer-Show. Geplantes Produkt daraus: **Tischfunk** (Variante A = ohne Kassenfunktion). Der Nutzer ist kein Programmierer: Erklärungen, UI-Texte, Kommentare und Anleitungen auf **Deutsch** und Schritt für Schritt.

## Befehle

Kein Build, kein npm-Projekt, kein Linter – reine statische Dateien.

- **Automatischer Test (Demo-Modus):** `node tests/smoke.js [ordner-für-screenshots]` – startet einen eigenen Server auf Port 8799, biegt `config.js` auf Demo-Modus ohne PINs um und spielt Kellner → Küche/Theke → Fertig-Hinweis → Storno → Auswertung/Excel → Admin → Beamer durch. Playwright ist vorinstalliert. Neue Prüfungen als weiteren Block mit `pruefe(name, ok, info)` anhängen.
- **Manuell ansehen:** `python3 -m http.server 8766` im Repo-Ordner. Mit den echten Supabase-Daten in `config.js` ist die Datenbank aus dieser Umgebung nicht erreichbar → zum Testen Demo-Modus nutzen (wie `tests/smoke.js` es macht, oder `localStorage.demo_modus = "1"` = Übungsmodus mit Beispieldaten).
- **SQL prüfen:** lokal gegen PostgreSQL; live wird SQL vom Nutzer im Supabase SQL-Editor ausgeführt.
- Vollständige manuelle Checkliste mit echten Geräten: `TESTPLAN.md`.

## Architektur

- **Seiten**: je eine HTML-Datei pro Rolle (`kellner`, `kueche`, `theke`, `auswertung`, `admin`, `beamer`, `hilfe`, `index`). Jede lädt `config.js`, `vendor/supabase-js-2.117.3.js`, `js/common.js` und ruft dann `App.starte([seitenskripte], opts)` auf. `starte` lädt erst die Stammdaten, dann die Seitenskripte nacheinander. Optionen: `ohneBeobachter`, `ohneDurchsagen`, `autoNeuladen`.
- **`js/common.js` = `window.App`**: Backend-Abstraktion `App.DB` mit zwei austauschbaren Implementierungen – `supabaseBackend()` und `demoBackend()` (localStorage-Schlüssel `pubquiz_demo_db`, Live-Updates über `storage`-Events). **Jede neue Datenoperation muss in beiden Backends umgesetzt werden.** Demo gilt, wenn Supabase-URL/Key leer sind oder der Übungsmodus (`demo_modus=1`) an ist.
- **Stammdaten** (Artikel, Tische, Kellner, Reviere, Startgeld, Zitate): Priorität DB-Tabelle `einstellungen` (Schlüssel `stammdaten`, im Admin gepflegt) → Gerätekopie `stammdaten_cache` → `config.js`. `App.CFG` ist danach die gültige Sicht; `config.js` ist nur Rückfallebene plus Supabase-Zugang und PINs.
- **Bestellungen**: eine Kellner-Bestellung wird in Zeilen pro `ziel` (`kueche`, `theke`, `kasse` = nur Strichliste, z. B. Snacks) zerlegt, verbunden über `gruppe`. Status `offen` → `erledigt` | `storniert`. Küche/Theke: `js/station.js` (Realtime plus Polling alle 5 s als Rückfall).
- **Eigenverzehr**: `App.istEigen(r)` (Flag an der Bestellung ODER Tisch mit `eigen`). Solche Bestellungen zählen in der Inventur, dürfen aber in **keiner** Übersicht der normalen Tische auftauchen (Umsatz, Kasse, Excel, Beamer-Rankings, Kellner-Rennen). Bei jeder neuen Statistik prüfen.
- **Startgeld**: `App.startgeldCentFuer(nr)` / `App.startgeldTische()` – 0 für Eigenverzehr-Tische und Tische mit `ohneStart`.
- **Kasse** (`js/kasse.js`, Reiter in der Kellner-Ansicht) schreibt in `zahlungen`. Für Tischfunk Variante A soll das wegfallen bzw. nur noch Summen anzeigen.
- **Excel**: eigener .xlsx-Schreiber ohne Bibliothek (`js/xlsx.js`), Inhalte in `js/export.js`.
- **Aktualisierung auf Geräten**: `vercel.json` setzt `Cache-Control: no-cache`; `versionBeobachten` prüft alle 2 Minuten per HEAD/ETag, ob sich Skripte geändert haben (Beamer lädt automatisch neu, andere zeigen „Neu laden“).

## Datenbank (Supabase)

- `supabase/setup.sql` = vollständiges Schema für eine neue Installation. Jede Schema-Änderung zusätzlich als neues, idempotentes `supabase/update-*.sql` (`if not exists`, `drop policy if exists` …) mit deutscher Anleitung im Kopfkommentar, **und** in `setup.sql` nachziehen.
- Zugriff über RLS-Policies für `anon` und `authenticated`. Kein Supabase Auth; die PINs in `config.js` sind nur ein Schutz gegen Versehen.
- Supabase erzwingt `safeupdate`: `DELETE`/`UPDATE` brauchen immer eine `WHERE`-Klausel (z. B. `where id is not null`).
- Der Reset-Code für `abend_zuruecksetzen(code)` liegt nur in der DB-Tabelle `admin_geheim` (für die App unlesbar) – nie ins Repo schreiben. Den Service-Role-Key ebenso wenig.

## Konventionen

- Vanilla JS in einer IIFE pro Datei, deutsche Bezeichner (`laden`, `speichern`, `zeigen`). Geldbeträge intern in Cent (`App.cent`, `App.euro`). HTML immer mit `App.esc` escapen.
- Supabase-JS ist fest unter `vendor/` abgelegt – kein CDN.
- Nach Funktionsänderungen `hilfe.html` (In-App-Anleitung) und bei Bedarf `README.md`/`TESTPLAN.md` mitpflegen.
