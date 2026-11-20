# Testplan (vor Freitag, ca. 20 Minuten)

Benötigt: mindestens 4 Geräte – 2 Kellner-Handys (ideal: iPhone **und** Android), 1 Küche, 1 Theke (am besten die echten Geräte vom Abend).
Vorher: Anleitung Schritte 1–4 erledigt, oben rechts steht überall **Live** (grün).

| # | Test | Erwartung | ✔ |
|---|---|---|---|
| 1 | Küche und Theke öffnen, **Start** tippen | Ton ist zu hören, Liste leer, „Live“ grün | |
| 2 | Kellner-Handy 1: Namen wählen, Seite neu laden | Name bleibt gespeichert | |
| 3 | Kellner 1: Tisch 7, 2× Pils 0,5 l, 1× Wurstsalat, Kommentar „ohne Zwiebeln“, senden | Küche: nur Wurstsalat; Theke: nur 2× Pils; beide mit Tisch 7 – SATALANA, Kellnername, Uhrzeit, Kommentar gelb; Ton + Aufblinken | |
| 4 | Nur Getränke bestellen (Tisch 1) | Erscheint nur an der Theke, Küche bleibt still | |
| 5 | Nur Speise bestellen (Tisch 19) | Erscheint nur in der Küche | |
| 6 | Kellner 1 und Kellner 2 senden **gleichzeitig** | Beide Bestellungen kommen an, älteste oben | |
| 7 | Theke tippt **Erledigt** | Bestellung verschwindet; beim Kellner unter „Meine offenen“ ist der Theken-Teil weg | |
| 8 | Theke tippt **Erledigt** und dann **Rückgängig** | Bestellung ist wieder da | |
| 9 | Kellner storniert eine offene Küchen-Bestellung | Küche: roter STORNIERT-Hinweis + Ton, Bestellung weg | |
| 10 | Kellner versucht zu stornieren, nachdem Küche schon erledigt hat | Meldung „Geht nicht mehr – schon erledigt“ | |
| 11 | Kellner-Handy in Flugmodus, Bestellung senden | Rote Meldung „NICHT gesendet“, Bestellung bleibt erhalten; Flugmodus aus → nochmal senden → kommt an | |
| 12 | Küchen-Gerät 2 Minuten nicht berühren | Bildschirm bleibt an | |
| 13 | Küchen-Gerät: WLAN kurz aus und wieder an, währenddessen Bestellung senden | Oben „Keine Verbindung“ (rot); nach Wiederverbindung erscheint die Bestellung innerhalb weniger Sekunden | |
| 14 | Lasttest: alle Kellner senden je 5 Bestellungen schnell hintereinander | Alles kommt vollständig an, keine doppelt | |
| 15 | Am echten Ort (Sportheim) prüfen: WLAN/Mobilfunk an Theke und in der Küche | „Live“ grün | |
| 16 | Kommentar mit langem Text | Gut lesbar, bricht sauber um | |
| 17 | Küche tippt **Erledigt** bei einer Bestellung von Kellner 1 | Kellner-1-Handy: grüner Hinweis „Tisch …: Essen ist fertig!“ mit Ton (Android: Vibration) | |
| 18 | Theke tippt **Erledigt** | Kellner: Hinweis „Getränke stehen bereit“ | |
| 19 | Kellner storniert selbst | **Kein** „fertig“-Hinweis | |
| 20 | Kellner 2 wählt einen Tisch, an dem Kellner 1 schon bestellt hat | Knopf „↻ Wie zuletzt“ mit der letzten Bestellung; Tipp übernimmt die Artikel (noch nicht gesendet) | |
| 22 | 2× Snack + 1× Cola an Tisch 5 senden | Theke bekommt nur die Cola; Auswertung Tisch 5: 2× Snack + Cola, Kachel „Snacks“ 2,00 € | |
| 23 | Nur 1× Snack senden | Küche und Theke bleiben still, Kellner sieht „✓ Gesendet“ | |
| 24 | Kasse: Tisch mit Bestellung antippen | Artikel mit „x offen“ und „Offen“-Betrag stimmen mit der Bestellung überein | |
| 25 | 1 Pils auswählen → „Auswahl kassieren“, dann „Alles bezahlt“ | Pils zeigt „1 bezahlt“, Offen sinkt um 4 €; danach 0 € und Tisch grün „✓ bezahlt“; Kassenstand steigt | |
| 26 | Eine Zahlung stornieren | Betrag ist wieder offen, Kassenstand sinkt | |
| 27 | Auswertung → Kellner | Spalte „Kassiert (bar)“ stimmt mit den Kassenständen überein | |
| 28 | Küche: 🚫 Ausverkauft → Käsesalat antippen | Bei den Kellnern (max. 10 s) Käsesalat durchgestrichen, + gesperrt, Hinweis „Ausverkauft“ | |
| 29 | Käsesalat wieder auf „verfügbar“ | Kellner kann wieder bestellen | |
| 30 | Auswertung → ⬇ Excel (am PC und am iPhone) | Datei lässt sich in Excel/Numbers öffnen, 5 Blätter, Summen stimmen | |
| 31 | Admin: Preis ändern, speichern; Kellner-Seite neu laden | Neuer Preis wird angezeigt; offene Kellner-Seite zeigt nach ≤ 1 Min „Neu laden“ | |
| 32 | Admin: Revier „1-5“ für einen Kellner | Dieser Kellner sieht Tische 1–5 oben, Rest unter „Andere Tische“ | |
| 33 | Admin: ungültigen Preis („abc“) speichern | Rote Fehlermeldung, nichts gespeichert | |
| 34 | Kellner: Suche „wurst“ | Nur die Wurstsalate sichtbar | |
| 35 | Kellner: 2× Wurstsalat, Notiz „1× ohne Zwiebeln“, senden | Küche zeigt die Notiz gelb unter dem Wurstsalat | |
| 36 | Kellner: nach einigen Bestellungen | „⭐ Häufig bestellt“ zeigt die meistbestellten Artikel | |
| 37 | Kasse: Tisch ohne Bestellung → 3 Snacks „auf die Rechnung“ | Offen 3,00 €, Tisch in der Übersicht orange; „Rückgängig“ entfernt sie wieder | |
| 38 | Admin: „101 – Theke“ mit Häkchen Eigenverzehr anlegen | Kellner sieht „👤 Eigenverzehr – Theke“ unter den Tischen | |
| 39 | 2 Pils auf „Theke“ (Eigenverzehr) bestellen | Theke zeigt lila „EIGENVERZEHR“; Kasse zeigt den Eintrag nicht | |
| 40 | Auswertung → Artikel | Pils: Verkauft unverändert, Eigenverzehr 2, Gesamt +2; Umsatz unverändert | |
| 41 | `beamer.html` am Laptop | Folien wechseln alle 10 s; Liter Bier/Spritz und Top 3 stimmen mit den Testbestellungen; `#feiern` zeigt Konfetti | |
| 42 | Theke: 📢 → „Letzte Runde!“ senden | Nach ≤ 10 s auf allen Kellner-Handys, Küche, Auswertung groß mit Ton; nicht beim Absender | |
| 43 | Kellner: 🌓 antippen bis 🌙 | App wird dunkel, bleibt nach Neuladen dunkel | |
| 44 | Kasse: Tisch 12 €, Gegeben 20, „Stimmt so“, Alles bezahlt | Trinkgeld 8,00; Rückgeld 0,00; Kassenstand +20 €; Tisch „✓ bezahlt“ | |
| 45 | Auswertung | Kachel „Trinkgeld“ 8 €, Umsatz gesamt = Waren + Trinkgeld; Kellner-Tabelle mit Spalte Trinkgeld | |
| 46 | Auswertung: ⏸ → 10 Min | Beamer springt sofort auf den Countdown, danach alle 2 Min für 10 s zwischen den Statistiken; Restzeit oben neben der Uhr | |
| 47 | ⏸ → „Pause jetzt beenden“ | Beamer zeigt „Weiter geht's!“ bzw. wieder nur Statistiken | |
| 48 | Admin → Zitate: 2 Zitate mit Namen anlegen, speichern | Beamer zeigt nach ≤ 30 s nach je 2 Folien ein Zitat: 5 s Zitat, dann Name, insgesamt 8 s | |
| 49 | Kasse: Tisch mit 3 Pils, Personen = 6; Gast zahlt 1 Pils + 1 Anteil | Auswahl 7,33 €; Startgeld zeigt danach 16,67 € offen / 5 Anteile | |
| 50 | Rest per „Alles bezahlt“ | Tisch ✓ bezahlt; Startgeld-Anteile summieren sich genau auf 20,00 €; Auswertung: Kachel Startgeld | |
| 51 | Startseite → „Demo ausprobieren“ | Lila Band auf allen Seiten, Kasse/Auswertung/Beamer mit Beispieldaten; Bestellung kommt in der Küche im zweiten Tab an, aber nicht auf anderen Geräten | |
| 52 | „Demo beenden“ | Band weg, wieder echte Daten | |
| 21 | `auswertung.html` öffnen | Summen pro Tisch stimmen mit den Testbestellungen überein, stornierte fehlen | |

Danach: **Testdaten löschen** (Bestellungen **und** Zahlungen) (siehe Anleitung) und Kellnernamen/PINs final prüfen.
