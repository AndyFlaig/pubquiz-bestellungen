---
name: tischfunk-test
description: Testet die Bestell-App (Pub-Quiz / Tischfunk) automatisch im Demo-Modus – Kellner, Küche, Theke, Storno, Auswertung, Excel, Admin, Beamer – und berichtet auf Deutsch. Verwenden nach jeder Code-Änderung an HTML/JS/CSS, vor jedem Commit oder PR, oder wenn der Nutzer „testen“, „läuft noch alles?“ oder „Tischfunk-Test“ sagt.
---

# Tischfunk-Test

1. **Automatischer Durchlauf** im Repo-Ordner:
   ```
   node tests/smoke.js <scratchpad>/smoke
   ```
   Der Ordner für Screenshots muss existieren (`mkdir -p`). Das Skript startet seinen eigenen Server, schaltet Demo-Modus und PINs ab und endet mit `x/y bestanden` (Exit-Code 1 bei Fehlern).

2. **Bei ✘:** Ursache im Code suchen und beheben, dann erneut laufen lassen. Nie eine Prüfung abschwächen oder entfernen, damit sie grün wird. Wenn die Prüfung selbst veraltet ist (z. B. Selektor nach gewollter UI-Änderung), das ausdrücklich sagen und anpassen.

3. **Geänderte Bereiche gezielt nachprüfen:** Betrifft die Änderung etwas, das der Durchlauf nicht abdeckt (z. B. Kasse, Ausgaben, Durchsagen, Dunkelmodus, eine Beamer-Folie), eine passende Prüfung in `tests/smoke.js` ergänzen (`pruefe(name, ok, info)`), statt nur einmal von Hand zu testen. Die Screenshots im Ordner ansehen, wenn es um Aussehen geht.

4. **Datenbank-Änderungen** deckt der Demo-Test nicht ab: SQL lokal gegen PostgreSQL prüfen und dem Nutzer sagen, dass der Live-Test mit Supabase bei ihm liegt.

5. **Bericht an den Nutzer** (Deutsch, kurz):
   - Ergebnis `x/y bestanden`, bei Fehlern welche und was behoben wurde
   - was neu geprüft wurde
   - was nur mit echten Geräten bzw. Supabase prüfbar ist → passende Zeilen aus `TESTPLAN.md` nennen
