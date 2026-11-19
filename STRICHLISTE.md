# Konzept: Digitale Strichliste (für ein nächstes Mal)

Stand: Vorbereitung, **noch nicht umgesetzt**. Für den 20.11.2026 bleibt es bei der Strichliste auf Papier.
Die Auswertungsseite (`auswertung.html` → „Pro Tisch“) zeigt aber schon jetzt alles, was pro Tisch bestellt wurde,
mit Summe – damit lässt sich die Papierliste am Ende abgleichen.

## Ziel

Kellner kassieren direkt in der App: Sie sehen pro Tisch, was noch offen (unbezahlt) ist, wählen aus, was ein Gast bezahlt,
und bekommen den Betrag angezeigt. Am Ende ist klar, welcher Tisch noch etwas schuldet und wie viel Geld jeder Kellner eingenommen hat.

## Grundidee: Bezahlen getrennt vom Bestellen

Bestellungen bleiben wie sie sind. Zahlungen kommen in eine **eigene Tabelle `zahlungen`**.
„Noch zu zahlen“ für einen Tisch = alles Bestellte (nicht storniert) minus alles Bezahlte – pro Artikel gezählt.

Vorteile:
- Der funktionierende Bestellablauf (Kellner → Küche/Theke) wird nicht angefasst.
- Ein Team kann **getrennt zahlen** (jeder seine Getränke), **zusammen** (alles auf einmal) oder **zwischendurch**.
- Fehler sind korrigierbar: eine falsche Zahlung wird storniert, nicht gelöscht.

## Ablauf in der Kellner-Ansicht (neuer Reiter „Kasse“)

1. Tisch wählen → Liste aller **unbezahlten** Artikel des Tisches, z. B.
   `5× Pils 0,5 l · 2× Cola · 1× Wurstsalat` – egal, welcher Kellner bestellt hat.
2. Gast sagt, was er hatte → Kellner tippt die Artikel an (mit + / −), oder **„Alles“** für den ganzen Tisch.
3. Großer Betrag wird angezeigt, optional „Gegeben: 20 €“ → Rückgeld wird berechnet.
4. **„Bezahlt“** → Zahlung wird gespeichert, Artikel verschwinden aus der offenen Liste.

Zusätzlich in der Auswertung:
- pro Tisch: bestellt / bezahlt / **noch offen** (rot, wenn > 0)
- pro Kellner: eingenommenes Bargeld (zum Abgleich mit dem Kellnerportemonnaie)
- Liste aller Zahlungen mit Uhrzeit, Stornieren möglich (mit PIN)

## Datenbank (Entwurf – noch NICHT ausführen)

```sql
create table public.zahlungen (
  id           bigint generated always as identity primary key,
  tisch        int         not null,
  kellner      text        not null,
  positionen   jsonb       not null,   -- [{ "id": "pils05", "anzahl": 2, "preis": 4.00 }]
  betrag       numeric(8,2) not null,
  status       text        not null default 'gueltig' check (status in ('gueltig', 'storniert')),
  erstellt_am  timestamptz not null default now()
);
-- dazu RLS-Regeln und Realtime wie bei "bestellungen"
```

## Offene Fragen

1. **Wer kassiert?** Jeder Kellner selbst (Bargeld im eigenen Portemonnaie) oder zentral an der Theke?
2. **Snacks auf den Tischen (1,00 €):** sollen die mit erfasst werden? Dann als Artikel ohne Küche/Theke-Ziel
   („nur kassieren“) in die Preisliste aufnehmen.
3. **Kartenzahlung / PayPal?** Nur als Vermerk „bar / Karte“ an der Zahlung, oder gar nicht.
4. **Pfand, Gutscheine, Freigetränke** (z. B. für Helfer oder Gewinnerteam)? → evtl. Artikel mit Preis 0 bzw. „Rabatt“-Position.
5. **Beleg nötig?** Falls ja: Anzeige zum Abfotografieren reicht meist, echter Bon-Druck ist deutlich aufwendiger.

## Aufwand und Risiko

- Umsetzung ca. ein halber bis ganzer Tag inkl. Test.
- Empfehlung: einmal bei einer kleinen Veranstaltung **parallel** zur Papierliste mitlaufen lassen, bevor man sich darauf verlässt.
- Rechtlicher Hinweis: Für einen Vereinsabend mit Bargeld genügt das als interne Aufzeichnung. Eine offizielle Registrierkasse
  (TSE/Kassensicherungsverordnung) ersetzt es **nicht** – das ggf. mit dem Kassier des Vereins klären.
