# Pub-Quiz Bestell-App

Einfache Handy-Web-App für das Pub-Quiz „In 50 Fragen um die Welt“ (Sportheim Schiltach, 20.11.2026).
Kellner nehmen Bestellungen am Handy auf, Speisen erscheinen live in der **Küche**, Getränke an der **Theke**.
Kassiert wird nicht über die App (Strichliste auf Papier).

- **Startseite:** `index.html` – Links zu den drei Ansichten
- **Kellner:** `kellner.html`
- **Küche:** `kueche.html`
- **Theke:** `theke.html`
- **Auswertung:** `auswertung.html` – Umsatz pro Tisch, verkaufte Artikel, Bestellungen und Kassenstand pro Kellner
- **Kasse:** Reiter in der Kellner-Ansicht – Tisch ganz oder mit Teilbetrag abrechnen (nur bar)

👉 **Einrichtung Schritt für Schritt:** [ANLEITUNG.md](ANLEITUNG.md)
👉 **Test vor Freitag:** [TESTPLAN.md](TESTPLAN.md)
👉 **Idee für später:** [STRICHLISTE.md](STRICHLISTE.md) – Konzept digitale Strichliste

## Was wo ändern?

| Was | Datei |
|---|---|
| Supabase-Zugang, Kellnernamen, PINs, Tische, Preisliste | `config.js` |
| Datenbank-Tabelle anlegen | `supabase/setup.sql` |
| Aussehen | `style.css` |

## Technik (kurz)

- Reine statische Website (HTML/CSS/JavaScript), kein Build-Schritt. Läuft auf Vercel, Netlify, Render, GitHub Pages …
- Daten in Supabase (Tabelle `bestellungen`), Live-Aktualisierung über Supabase Realtime.
  Zusätzlich fragen Küche/Theke alle 5 Sekunden nach – falls die Live-Verbindung abreißt, kommt trotzdem alles an.
- Eine Bestellung wird beim Absenden in bis zu zwei Teile zerlegt (Küche / Theke), verbunden über `gruppe`.
- Status: `offen` → `erledigt` (Küche/Theke) oder `storniert` (Kellner, nur solange offen).
- Ton per Web-Audio (keine Sounddatei), Bildschirm wach halten per Wake-Lock-API.
- Ohne Supabase-Daten in `config.js` läuft die App im **Demo-Modus** (Daten nur im Browser dieses Geräts) – praktisch zum Ausprobieren.
- Die Supabase-Bibliothek liegt fest im Ordner `vendor/` (kein externes CDN nötig).
