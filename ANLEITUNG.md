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
> [`supabase/update-snacks.sql`](supabase/update-snacks.sql) (Snacks), [`supabase/update-kasse.sql`](supabase/update-kasse.sql) (Kasse)
> und danach [`supabase/update-v3.sql`](supabase/update-v3.sql) (Ausverkauft, Abrechnung pro Artikel)
> sowie [`supabase/update-v4.sql`](supabase/update-v4.sql) (Admin-Seite).

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
| Admin (Orga) | `https://pubquiz-bestellungen.vercel.app/admin.html` |
| Beamer / Fernseher | `https://pubquiz-bestellungen.vercel.app/beamer.html` |

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

**Suche und Favoriten:** Über der Artikelliste gibt es ein Suchfeld (z. B. „wurst“, „0,33“). Ganz oben stehen unter
„⭐ Häufig bestellt“ die acht Artikel, die dieser Kellner auf diesem Handy am häufigsten bestellt hat.

**Notiz pro Artikel:** Sobald ein Artikel ausgewählt ist, erscheint darunter „✎ Notiz“, z. B. „1× ohne Zwiebeln“.
Die Notiz steht bei Küche/Theke gelb direkt unter dem Artikel. Der Kommentar unten gilt weiter für die ganze Bestellung.

**Revier:** Ist für den Kellner im Admin ein Revier eingetragen, stehen „seine“ Tische oben; die übrigen unter
„▼ Andere Tische“.

**Snacks:** stehen in der Kellner-Ansicht ganz unten („Snacks – stehen auf dem Tisch“, 1,00 €). Sie werden **nicht** an Küche
oder Theke geschickt, sondern nur erfasst und in der Auswertung pro Tisch mitgezählt. Einzeln oder zusammen mit einer
Bestellung absenden. Ein falsch erfasster Snack kann nicht storniert werden – einfach auf der Papierliste korrigieren.

**Kasse (Reiter „💶 Kasse“ in der Kellner-Ansicht):** Jeder Kellner kassiert selbst, nur bar.
Die Tischübersicht zeigt pro Tisch den offenen Betrag (orange) bzw. „✓ bezahlt“ (grün). Tisch antippen →
alle Artikel mit „x offen / y bezahlt“, darunter Bestellt / Bezahlt / **Offen**.
- **Ein Gast zahlt einzeln:** seine Artikel mit **+** auswählen → „Auswahl kassieren – 13,00 €“. Der Rest bleibt offen.
- **Snacks vom Tisch:** Oben im Tisch gibt es die Box „🥨 Vom Tisch genommen?“. Anzahl mit **+** wählen →
  „+ 3,00 € auf die Rechnung“. Die Snacks stehen dann als offene Artikel in der Abrechnung
  (10 Sekunden lang „Rückgängig“ möglich). Snacks, die schon über „Bestellen“ erfasst wurden, stehen ebenfalls dort.
- **„✓ Alles bezahlt“** verbucht alle noch offenen Artikel.
- **Gegeben:** zeigt das Rückgeld (für die Auswahl, sonst für den ganzen offenen Betrag).
- **Trinkgeld:** Betrag eintippen oder **„Stimmt so“** (Rest vom gegebenen Geld wird Trinkgeld) bzw.
  **„Aufrunden auf 5 €“**. Das Rückgeld wird mit Trinkgeld berechnet. Trinkgeld zählt zum **Kassenstand** des Kellners
  und zum **Umsatz gesamt**, aber nicht zum Warenbetrag (der Tisch ist bezahlt, wenn die Waren bezahlt sind).
  Voraussetzung: einmal [`supabase/update-v7.sql`](supabase/update-v7.sql) ausführen.
- Eigene Zahlungen können storniert werden (z. B. vertippt).
- Oben steht der eigene **Kassenstand** = so viel Bargeld sollte im Portemonnaie sein.
- Noch nicht gelieferte Bestellungen sind schon mitgerechnet. Wird danach noch etwas bestellt, ist der Tisch wieder „offen“.

**Ausverkauft:** In Küche und Theke oben auf **🚫 Ausverkauft** tippen → Artikel antippen schaltet zwischen
„verfügbar“ und „AUSVERKAUFT“ um. Bei den Kellnern ist der Artikel dann durchgestrichen und nicht mehr bestellbar
(spätestens nach 10 Sekunden). Liegt er schon in einer angefangenen Bestellung, muss er vor dem Senden entfernt werden.

**Excel-Export:** In der Auswertung oben **⬇ Excel** → Datei `pubquiz_DATUM_UHRZEIT.xlsx` mit den Blättern
Pro Tisch, Artikel, Kellner, Bestellpositionen (inkl. stornierter) und Zahlungen. Am iPhone landet sie unter „Dateien → Downloads“.

**Auswertung:** zeigt pro Tisch alles Bestellte mit Summe (Abgleich mit der Strichliste), die verkauften Artikel
und die Bestellungen pro Kellner. Aktualisiert sich automatisch. Optional mit eigenem PIN (`PIN.auswertung` in `config.js`).

## Admin-Seite: Artikel, Preise, Tische und Kellner pflegen

`admin.html` (auch über die Startseite unten „⚙️ Admin“). **Vorher einen Admin-PIN in `config.js` setzen** (`PIN.admin`).

- **Artikel:** Name, Menge, Preis, Kategorie und Ziel (Theke / Küche / Nur Strichliste) ändern, Reihenfolge mit ↑ ↓,
  neue Artikel anlegen, Artikel löschen.
- **Tische:** Nummer und Teamname.
- **Kellner:** Namen und Revier (z. B. `1-5, 9`).
- **Allgemein:** Veranstaltungsname, Sicherung als JSON herunterladen/einspielen, „Auf Standard aus config.js zurücksetzen“.
- **Speichern** prüft alles (Preise, doppelte Tischnummern, Reviere …) und zeigt Fehler rot an.
- Gespeicherte Änderungen gelten auf allen Geräten nach dem **Neuladen**. Offene Seiten zeigen innerhalb einer Minute
  den Hinweis „Preisliste/Tische wurden geändert – Neu laden“.
- Bereits abgeschickte Bestellungen behalten ihren alten Preis.
- Ist die Datenbank nicht erreichbar, nutzt jedes Gerät die zuletzt geladene Liste, sonst `config.js`.

## Eigenverzehr (Personal/Helfer)

Im **Admin → Tische** Einträge anlegen und **„👤 Eigenverzehr“** ankreuzen, z. B. `101 – Theke`, `102 – Küche`,
`103 – Kellner` oder pro Person (`110 – Maurice` …). Die Nummer ist frei wählbar, muss aber eindeutig sein.

- Kellner sehen diese Einträge in einem eigenen Bereich „👤 Eigenverzehr“ unter den Tischen und bestellen ganz normal.
- Küche/Theke sehen die Bestellung mit lila Band **„EIGENVERZEHR“**.
- In der **Kasse** tauchen sie nicht auf – es wird nichts kassiert, der Kassenstand bleibt unberührt.
- In der **Auswertung** zählt Eigenverzehr **nicht zum Umsatz**. Unter „Artikel“ stehen die Spalten
  Verkauft / Eigenverzehr / **Gesamt (Inventur)**, dazu die Kachel „Eigenverzehr (Warenwert)“.
- Im **Excel-Export**: Blatt „Artikel (Inventur)“ mit denselben Spalten und ein eigenes Blatt „Eigenverzehr“.

Voraussetzung: einmal [`supabase/update-v5.sql`](supabase/update-v5.sql) ausführen.

## Beamer: Pausen-Show mit Zwischenständen

`beamer.html` am Laptop/Fernseher öffnen, unten links **⛶ Vollbild**. Die Folien wechseln **alle 10 Sekunden in
Dauerschleife** (Fortschrittsbalken und Punkte unten). Folien ohne Daten werden übersprungen.

| Folie | Was gezählt wird |
|---|---|
| 🍺 Bier-Barometer + Top-Zapfer | Liter aller Artikel mit Pils/Weizen/Bier im Namen |
| 🍹 Spritz-O-Meter + Spritz-Society | Liter Aperol und aller Weine/Weinschorlen |
| 🏆 Durstigstes Team | Anzahl Getränke |
| 🍽 Hungrigster Tisch | Anzahl Speisen |
| 💧 Die Wassertrinker des Abends | Sprudel sauer/süß |
| ⚡ Koffein-Kommando | Cola, Cola Zero, Spezi |
| 🥨 Snack-Monster | Snacks |
| 🥊 Wurstsalat-Duell | Straßburger gegen Schwäbischen |
| ⚔️ Bier-Duell | Liter Pils gegen Weizen |
| 🏃 Kellner-Rennen | Bestellungen pro Kellner |
| 📊 Der Abend in Zahlen | Summen, alkoholfrei-Quote, Early Bird, Ø Wartezeit Theke/Küche |

- Ranglisten zählen nur Gäste (kein Eigenverzehr); die Liter-Anzeigen zählen alles, was gezapft wurde.
- Konfetti, wenn Bier oder Spritz ein Ziel erreichen (10/25/50-Liter-Schritte). Test: `beamer.html#feiern`.
- Bedienung: Klick oder → = nächste Folie, ← = zurück, **P** = Pause.
- Optionen: `beamer.html?sekunden=15` (andere Dauer), `beamer.html?folie=spritz` (nur eine Folie).

**⏸ Pausen-Countdown:** Auf **„⏸ Pause“** tippen – entweder **direkt auf der Beamer-Seite** (unten links, neben
„Vollbild“; im Vollbild erscheinen die Knöpfe, sobald man die Maus bewegt) oder in der **Auswertung** (Leiste unter der Kopfzeile) → 5 / 10 / 15 / 20 Minuten oder eigene Dauer.
Der Beamer springt sofort auf einen großen Countdown mit Ring und zeigt ihn dann **im Wechsel mit den Statistiken**;
oben neben der Uhr läuft die Restzeit mit. In der letzten Minute wird er orange („letzte Bestellungen!“),
danach erscheint 90 Sekunden lang **„Weiter geht's!“**. Im selben Fenster: „+ 5 Minuten verlängern“ und
„Pause jetzt beenden“. Der Knopf in der Auswertung zeigt die Restzeit an.
- Es werden keine Preise oder Umsätze angezeigt.

## Durchsage an alle Geräte

**📢** oben in Küche, Theke, Auswertung und Admin → Vorlage antippen (z. B. „🔔 Letzte Runde!“) oder eigenen Text →
**Senden**. Innerhalb von ca. 10 Sekunden erscheint die Durchsage groß auf allen Kellner-Handys, in Küche, Theke,
Auswertung und Admin – mit Ton und (Android) Vibration. „OK“ schließt sie. Voraussetzung: einmal
[`supabase/update-v6.sql`](supabase/update-v6.sql) ausführen.

## Dunkelmodus

Pro Gerät einstellbar: **🌓 Auto** (wie am Handy eingestellt), **☀️ Hell**, **🌙 Dunkel**.
- Startseite: Auswahl unter den Knöpfen.
- Küche/Theke: im Start-Fenster.
- Kellner: Symbol 🌓 / 🌙 / ☀️ oben neben „wechseln“ (tippen schaltet weiter).

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
