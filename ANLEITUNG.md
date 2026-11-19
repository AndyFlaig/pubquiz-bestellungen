# Anleitung für Nicht-Programmierer

Dauer: ca. 30 Minuten. Du brauchst: einen Computer mit Browser und den GitHub-Zugang, unter dem das
Repository `pubquiz-bestellungen` liegt. Alles ist kostenlos.

---

## Schritt 1: Supabase (die Datenbank) einrichten

1. Gehe auf **https://supabase.com** → **Start your project** → mit GitHub anmelden.
2. **New project** anlegen:
   - Name: `pubquiz`
   - Database Password: irgendein sicheres Passwort (wird später nicht gebraucht, trotzdem notieren)
   - Region: **Central EU (Frankfurt)**
   - → **Create new project**. Warten, bis das Projekt fertig ist (1–2 Minuten).
3. Links im Menü **SQL Editor** öffnen → **New query**.
4. Den kompletten Inhalt der Datei [`supabase/setup.sql`](supabase/setup.sql) hineinkopieren → **Run** klicken.
   Unten sollte „Success. No rows returned“ stehen.
5. Zugangsdaten holen: Oben auf **Connect** klicken (oder links **Project Settings → API Keys / Data API**). Du brauchst zwei Werte:
   - **Project URL** – sieht aus wie `https://abcdefghijk.supabase.co`
   - **Publishable key** (beginnt mit `sb_publishable_…`) **oder** der ältere **anon public** Key (beginnt mit `eyJ…`).
     Einer von beiden genügt.
   - ⚠️ **Niemals** den „secret“- bzw. „service_role“-Key verwenden!

> **Bestehende Datenbank (vor dem 19.11. eingerichtet)?** Zusätzlich einmal im SQL Editor ausführen:
> [`supabase/update-snacks.sql`](supabase/update-snacks.sql) (Snacks) und [`supabase/update-kasse.sql`](supabase/update-kasse.sql) (Kasse).

## Schritt 2: Zugangsdaten und Namen in `config.js` eintragen

1. Auf **github.com** das Repository `pubquiz-bestellungen` öffnen → Datei **`config.js`** anklicken → Stift-Symbol (✏️ „Edit this file“).
2. Eintragen (Anführungszeichen stehen lassen!):
   ```js
   SUPABASE_URL: "https://abcdefghijk.supabase.co",
   SUPABASE_KEY: "sb_publishable_xxxxxxxxxxxx",
   ```
3. Die vier Kellnernamen eintragen:
   ```js
   KELLNER: ["Anna", "Ben", "Clara", "David"],
   ```
4. Optional PINs setzen (z. B. `kueche: "1234"`). Leer lassen = kein PIN.
5. Preise/Artikel/Tische sind schon eingetragen und können hier jederzeit geändert werden.
6. Oben rechts **Commit changes…** → **Commit changes**.

> Falls die App gerade auf einem anderen Branch liegt (z. B. `claude/…`): entweder zuerst den Pull Request in `main` übernehmen
> oder beim Online-Stellen (Schritt 3) diesen Branch auswählen. Einfachste Variante: Pull Request mergen, dann immer mit `main` arbeiten.

## Schritt 3: App online stellen (Vercel)

1. Gehe auf **https://vercel.com** → **Sign Up** → **Continue with GitHub** (Hobby-Tarif, kostenlos).
2. **Add New… → Project** → beim Repository `pubquiz-bestellungen` auf **Import** klicken
   (falls es nicht auftaucht: „Adjust GitHub App Permissions“ und das Repository freigeben).
3. Einstellungen:
   - Framework Preset: **Other**
   - Build Command / Output Directory: **leer lassen**
4. **Deploy**. Nach ca. 30 Sekunden bekommst du eine Adresse wie `https://pubquiz-bestellungen.vercel.app`.
5. Jede Änderung an `config.js` auf GitHub wird automatisch nach ca. 30 Sekunden online übernommen.
   (Auf den Handys danach die Seite neu laden.)

**Alternative ohne Vercel:** https://app.netlify.com/drop – den Projektordner einfach ins Browserfenster ziehen
(dann aber bei jeder Änderung neu hochziehen).

## Schritt 4: Die drei Links

Mit deiner Adresse (Beispiel):

| Wer | Link |
|---|---|
| Startseite | `https://pubquiz-bestellungen.vercel.app/` |
| 4 Kellner (Handys) | `https://pubquiz-bestellungen.vercel.app/kellner.html` |
| Küche (iPad/Handy) | `https://pubquiz-bestellungen.vercel.app/kueche.html` |
| Theke (iPad/Handy) | `https://pubquiz-bestellungen.vercel.app/theke.html` |
| Auswertung (Orga) | `https://pubquiz-bestellungen.vercel.app/auswertung.html` |

Tipp: Link per WhatsApp verschicken oder als QR-Code ausdrucken. Auf dem iPhone in Safari: Teilen → **Zum Home-Bildschirm**.

Oben rechts in jeder Ansicht steht der Verbindungsstatus: **Live** (grün) = alles gut, **Keine Verbindung** (rot, blinkt) = WLAN/Mobilfunk prüfen.
Steht dort **Demo**, sind die Supabase-Daten in `config.js` noch nicht eingetragen.

## Schritt 5: Geräte für Küche und Theke vorbereiten

- Seite öffnen → großen Knopf **Start (Ton testen)** tippen → es muss piepen.
- **iPhone/iPad:** Stummschalter **aus**, Lautstärke **hoch**. Zusätzlich sicherheitshalber
  *Einstellungen → Anzeige & Helligkeit → Automatische Sperre → Nie*.
- **Android:** Lautstärke hoch, ggf. Bildschirm-Timeout auf Maximum.
- Ladekabel einplanen – der Bildschirm bleibt dauerhaft an.
- Nicht die Seite wechseln/andere Apps öffnen. Falls doch: zurückkehren, notfalls Seite neu laden und wieder **Start** tippen.

## Bedienung in Kürze

**Kellner:** Name einmal wählen (bleibt gespeichert) → Tisch antippen → Artikel mit **+** / **−** → optional Kommentar →
**Absenden** → Kontrollansicht → **Senden**. Unter **Meine offenen** sieht man eigene noch nicht erledigte Bestellungen
und kann sie **stornieren**. Hat ein Tisch schon einmal bestellt, erscheint nach der Tischwahl **„↻ Wie zuletzt“** –
ein Tipp übernimmt die letzte Bestellung in die Auswahl (vor dem Senden noch anpassbar).
Meldet Küche oder Theke „Erledigt“, bekommt der Kellner einen grünen Hinweis **„Tisch 7: Essen ist fertig!“**
(mit Ton; Android vibriert zusätzlich). Hinweis antippen zum Schließen. Scheitert das Senden (kein Netz), bleibt die Bestellung erhalten – einfach nochmal senden.

**Küche / Theke:** Neue Bestellung = Ton + gelbes Aufblinken, älteste steht oben. Rahmen orange ab 8 Min, rot ab 15 Min.
**✓ Erledigt** blendet die Bestellung aus (10 Sekunden lang „Rückgängig“ möglich).
Storniert ein Kellner, erscheint ein großer roter Hinweis (antippen zum Schließen).

**Snacks:** stehen in der Kellner-Ansicht ganz unten („Snacks – stehen auf dem Tisch“, 1,00 €). Sie werden **nicht** an Küche
oder Theke geschickt, sondern nur erfasst und in der Auswertung pro Tisch mitgezählt. Einzeln oder zusammen mit einer
Bestellung absenden. Ein falsch erfasster Snack kann nicht storniert werden – einfach auf der Papierliste korrigieren.

**Kasse (Reiter „💶 Kasse“ in der Kellner-Ansicht):** Jeder Kellner kassiert selbst, nur bar.
Die Tischübersicht zeigt pro Tisch den offenen Betrag (orange) bzw. „✓ bezahlt“ (grün). Tisch antippen →
alle bestellten Artikel, Bestellt / Bezahlt / **Offen**.
- **„✓ Alles bezahlt“** verbucht den kompletten offenen Betrag.
- **Teilbetrag:** zahlt ein Gast einzeln, Betrag eintippen (z. B. `12,50`) → „Teilbetrag kassieren“. Der Rest bleibt offen.
- **Gegeben:** zeigt das Rückgeld.
- Eigene Zahlungen können storniert werden (z. B. vertippt).
- Oben steht der eigene **Kassenstand** = so viel Bargeld sollte im Portemonnaie sein.
- Noch nicht gelieferte Bestellungen sind schon mitgerechnet. Wird danach noch etwas bestellt, ist der Tisch wieder „offen“.

**Auswertung:** zeigt pro Tisch alles Bestellte mit Summe (Abgleich mit der Strichliste), die verkauften Artikel
und die Bestellungen pro Kellner. Aktualisiert sich automatisch. Optional mit eigenem PIN (`PIN.auswertung` in `config.js`).

## Nach dem Test: Testdaten löschen

Supabase → **SQL Editor** → `truncate table public.bestellungen, public.zahlungen restart identity;` → **Run**.
(Dann beginnt die Nummerierung wieder bei #1.)

## Wichtig

- Supabase pausiert kostenlose Projekte nach **7 Tagen ohne Nutzung**. Also möglichst kurz vor Freitag testen;
  falls pausiert: im Supabase-Dashboard auf **Restore/Resume** klicken.
- Der PIN ist nur ein Schutz gegen versehentliches Öffnen, keine echte Sicherheit. Links nicht öffentlich posten.

## Notfallplan

Parallel ein **Google-Formular** bereithalten (Felder: Kellner, Tisch, Bestellung, Kommentar), Antworten in einer Google-Tabelle,
die Küche und Theke offen haben. Link + QR-Code ausgedruckt mitnehmen. Und: Block und Stift liegen sowieso bereit.
