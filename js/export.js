/* Excel-Export aller Daten (genutzt von Auswertung und Admin) */
(function () {
  "use strict";
  const { CFG, DB, zusammenfassen, cent } = App;

  const posText = (p) => p.name + (p.menge ? " " + p.menge : "");
  const summeCent = (pos) => pos.reduce((s, p) => s + p.cent, 0);
  const summe = (pos) => summeCent(pos) / 100;

  // Startgeld: Soll = Betrag × Gästetische; kassiert = Startgeld-Positionen in den Zahlungen
  const START_ID = "startgeld";
  const startSollTisch = () => cent(CFG.STARTGELD || 0);
  const gaesteTische = () => CFG.TISCHE.filter((t) => !t.eigen);
  const startKassiert = (zs, nr) => (zs || []).filter((z) => nr === undefined || z.tisch === nr)
    .reduce((s, z) => s + (z.positionen || []).filter((p) => p.id === START_ID).reduce((t, p) => t + cent(p.preis) * (p.anzahl || 1), 0), 0);

  // Inventur: pro Artikel verkauft + Eigenverzehr
  function inventur(verkauf, eigen) {
    const m = new Map();
    const key = (p) => p.id || p.name + "|" + (p.menge || "");
    zusammenfassen(verkauf).forEach((p) => m.set(key(p), Object.assign({}, p, { verkauft: p.anzahl, eigen: 0, umsatzCent: p.cent, eigenCent: 0 })));
    zusammenfassen(eigen).forEach((p) => {
      const x = m.get(key(p)) || Object.assign({}, p, { verkauft: 0, eigen: 0, umsatzCent: 0, eigenCent: 0 });
      x.eigen += p.anzahl; x.eigenCent += p.cent; m.set(key(p), x);
    });
    return zusammenfassen([{ positionen: [...m.values()].map((x) => ({ id: x.id, name: x.name, menge: x.menge, preis: x.preis, anzahl: 1 })) }])
      .map((p) => m.get(key(p)));
  }

  // Kellner aus der Liste + alle, die in den Daten vorkommen (z. B. nach Umbenennung im Admin)
  function alleKellner(rows, zahlungen) {
    const n = [...CFG.KELLNER];
    rows.forEach((r) => { if (!n.includes(r.kellner)) n.push(r.kellner); });
    (zahlungen || []).forEach((z) => { if (!n.includes(z.kellner)) n.push(z.kellner); });
    return n;
  }

  const ZIEL_NAME = { kueche: "Küche", theke: "Theke", kasse: "Nur Strichliste" };
  const zeit = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
      d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };
  const eur = (c) => Math.round(c) / 100;

  // Erstellt die Excel-Datei und lädt sie herunter. Wirft bei Fehlern (z. B. keine Verbindung).
  App.excelExport = async function (praefix) {
    const roh = await DB.listAlleRoh();
    let zRoh = null;
    try { zRoh = await DB.listZahlungenRoh(); } catch (e) { /* Kasse nicht eingerichtet */ }
    const gueltig = roh.filter((r) => r.status !== "storniert");
    const rows = gueltig.filter((r) => !App.istEigen(r));   // Verkauf
    const eigenRows = gueltig.filter(App.istEigen);         // Eigenverzehr
    const zahl = zRoh ? zRoh.filter((z) => z.status === "gueltig") : [];
    const blaetter = [];

    const warenCent = summeCent(zusammenfassen(rows));
    const tgCent = zahl.reduce((s, z) => s + cent(z.trinkgeld || 0), 0);
    const bezCent = zahl.reduce((s, z) => s + cent(z.betrag), 0);
    const stSoll = startSollTisch() * gaesteTische().length, stBez = startKassiert(zahl);
    let ausg = [];
    try { const w = await DB.ladeEinstellung("ausgaben"); ausg = Array.isArray(w) ? w : []; } catch (e) { /* keine Ausgaben */ }
    const ausgCent = ausg.reduce((s, a) => s + cent(a.betrag), 0);
    blaetter.push({
      name: "Übersicht",
      spalten: [{ titel: "Kennzahl", breite: 40 }, { titel: "Betrag", typ: "euro", breite: 14 }],
      zeilen: [
        ["Warenumsatz (Gäste)", eur(warenCent)],
        ["Startgeld (" + gaesteTische().length + " Tische × " + (CFG.STARTGELD || 0) + " €)", eur(stSoll)],
        ["  davon kassiert", eur(stBez)],
        ["Trinkgeld", eur(tgCent)],
        ["Umsatz gesamt (Waren + Startgeld + Trinkgeld)", eur(warenCent + stSoll + tgCent)],
        ["Kassiert bar (inkl. Startgeld + Trinkgeld)", eur(bezCent + tgCent)],
        ["Noch offen (Waren + Startgeld)", eur(warenCent + stSoll - bezCent)],
        ["Eigenverzehr – Warenwert (nicht im Umsatz)", eur(summeCent(zusammenfassen(eigenRows)))],
        ["", ""],
        ["Ausgaben gesamt", eur(-ausgCent)],
        ["ERGEBNIS (Umsatz gesamt − Ausgaben)", eur(warenCent + stSoll + tgCent - ausgCent)],
        ["Ergebnis nach Kassenstand (kassiert − Ausgaben)", eur(bezCent + tgCent - ausgCent)],
      ],
    });
    if (ausg.length) {
      blaetter.push({
        name: "Ausgaben",
        spalten: [{ titel: "Datum", breite: 20 }, { titel: "Wofür", breite: 32 }, { titel: "Kategorie", breite: 22 },
          { titel: "Betrag", typ: "euro", breite: 12 }, { titel: "Bezahlt von", breite: 18 }, { titel: "Notiz / Beleg", breite: 30 }],
        zeilen: ausg.slice().sort((a, b) => (a.erstellt_am || "").localeCompare(b.erstellt_am || ""))
          .map((a) => [zeit(a.erstellt_am), a.bezeichnung, (a.kategorie || "").replace(/^\S+\s/, ""), Number(a.betrag) || 0, a.von || "", a.notiz || ""])
          .concat([["", "Summe", "", eur(ausgCent), "", ""]]),
      });
    }

    blaetter.push({
      name: "Pro Tisch",
      spalten: [{ titel: "Tisch", typ: "zahl", breite: 7 }, { titel: "Team", breite: 32 }, { titel: "Bestellt", typ: "euro", breite: 12 },
        { titel: "Startgeld", typ: "euro", breite: 11 }, { titel: "Bezahlt", typ: "euro", breite: 12 }, { titel: "Offen", typ: "euro", breite: 12 },
        { titel: "Trinkgeld", typ: "euro", breite: 11 }, { titel: "Artikel", breite: 80 }],
      zeilen: CFG.TISCHE.filter((t) => !t.eigen).map((t) => {
        const pos = zusammenfassen(rows.filter((r) => r.tisch === t.nr));
        const best = summeCent(pos);
        const bez = zahl.filter((z) => z.tisch === t.nr).reduce((s, z) => s + cent(z.betrag), 0);
        const tgT = zahl.filter((z) => z.tisch === t.nr).reduce((s, z) => s + cent(z.trinkgeld || 0), 0);
        const st = startSollTisch();
        return [t.nr, t.team, eur(best), eur(st), eur(bez), eur(best + st - bez), eur(tgT), pos.map((p) => p.anzahl + "× " + posText(p)).join(", ")];
      }),
    });

    blaetter.push({
      name: "Artikel (Inventur)",
      spalten: [{ titel: "Artikel", breite: 28 }, { titel: "Menge", breite: 9 }, { titel: "Verkauft", typ: "zahl", breite: 10 },
        { titel: "Eigenverzehr", typ: "zahl", breite: 13 }, { titel: "Gesamt (Inventur)", typ: "zahl", breite: 17 },
        { titel: "Einzelpreis", typ: "euro", breite: 12 }, { titel: "Umsatz", typ: "euro", breite: 12 },
        { titel: "Warenwert Eigenverzehr", typ: "euro", breite: 22 }],
      zeilen: inventur(rows, eigenRows).map((x) => [x.name, x.menge || "", x.verkauft, x.eigen, x.verkauft + x.eigen,
        x.preis, eur(x.umsatzCent), eur(x.eigenCent)]),
    });

    if (eigenRows.length) {
      const ez = [];
      eigenRows.forEach((r) => r.positionen.forEach((p) => ez.push([zeit(r.erstellt_am), r.team, r.kellner,
        p.anzahl, p.name, p.menge || "", Number(p.preis) || 0, eur(p.anzahl * cent(p.preis)), p.notiz || ""])));
      blaetter.push({
        name: "Eigenverzehr",
        spalten: [{ titel: "Zeit", breite: 20 }, { titel: "Für (Bereich/Person)", breite: 24 }, { titel: "Erfasst von", breite: 13 },
          { titel: "Anzahl", typ: "zahl", breite: 8 }, { titel: "Artikel", breite: 26 }, { titel: "Menge", breite: 8 },
          { titel: "Einzelpreis", typ: "euro", breite: 12 }, { titel: "Warenwert", typ: "euro", breite: 12 }, { titel: "Notiz", breite: 20 }],
        zeilen: ez,
      });
    }

    blaetter.push({
      name: "Kellner",
      spalten: [{ titel: "Kellner", breite: 16 }, { titel: "Bestellungen", typ: "zahl", breite: 13 },
        { titel: "Umsatz", typ: "euro", breite: 12 }, { titel: "Trinkgeld", typ: "euro", breite: 11 },
        { titel: "Kassiert (bar, inkl. Trinkgeld)", typ: "euro", breite: 28 }],
      zeilen: alleKellner(rows, zahl).map((k) => {
        const kr = rows.filter((r) => r.kellner === k);
        return [k, new Set(kr.filter((r) => r.ziel !== "kasse").map((r) => r.gruppe)).size, summe(zusammenfassen(kr)),
          eur(zahl.filter((z) => z.kellner === k).reduce((s, z) => s + cent(z.trinkgeld || 0), 0)),
          eur(zahl.filter((z) => z.kellner === k).reduce((s, z) => s + cent(z.betrag) + cent(z.trinkgeld || 0), 0))];
      }),
    });

    const posZeilen = [];
    roh.forEach((r) => r.positionen.forEach((p) => posZeilen.push([
      r.id, zeit(r.erstellt_am), r.tisch, r.team, r.kellner, ZIEL_NAME[r.ziel] || r.ziel, r.status, App.istEigen(r) ? "ja" : "",
      p.anzahl, p.name, p.menge || "", Number(p.preis) || 0, eur(p.anzahl * cent(p.preis)), p.notiz || "", r.kommentar || "", zeit(r.geaendert_am),
    ])));
    blaetter.push({
      name: "Bestellpositionen",
      spalten: [{ titel: "Nr", typ: "zahl", breite: 6 }, { titel: "Zeit", breite: 20 }, { titel: "Tisch", typ: "zahl", breite: 7 },
        { titel: "Team", breite: 26 }, { titel: "Kellner", breite: 12 }, { titel: "Ziel", breite: 15 }, { titel: "Status", breite: 11 },
        { titel: "Eigenverzehr", breite: 13 },
        { titel: "Anzahl", typ: "zahl", breite: 8 }, { titel: "Artikel", breite: 26 }, { titel: "Menge", breite: 8 },
        { titel: "Einzelpreis", typ: "euro", breite: 12 }, { titel: "Summe", typ: "euro", breite: 11 },
        { titel: "Notiz (Artikel)", breite: 24 }, { titel: "Kommentar", breite: 30 }, { titel: "Geändert", breite: 20 }],
      zeilen: posZeilen,
    });

    if (zRoh) {
      blaetter.push({
        name: "Zahlungen",
        spalten: [{ titel: "Nr", typ: "zahl", breite: 6 }, { titel: "Zeit", breite: 20 }, { titel: "Tisch", typ: "zahl", breite: 7 },
          { titel: "Kellner", breite: 12 }, { titel: "Betrag (Waren)", typ: "euro", breite: 14 }, { titel: "Trinkgeld", typ: "euro", breite: 11 },
          { titel: "Gesamt", typ: "euro", breite: 11 }, { titel: "Status", breite: 11 },
          { titel: "Artikel", breite: 60 }],
        zeilen: zRoh.map((z) => [z.id, zeit(z.erstellt_am), z.tisch, z.kellner, Number(z.betrag), Number(z.trinkgeld) || 0,
          eur(cent(z.betrag) + cent(z.trinkgeld || 0)), z.status,
          Array.isArray(z.positionen) ? z.positionen.map((p) => p.anzahl + "× " + posText(p)).join(", ") : ""]),
      });
    }

    const d = new Date();
    const stempel = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") +
      "_" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0");
    App.excelHerunterladen((praefix || "pubquiz") + "_" + stempel + ".xlsx", blaetter);
    return { bestellungen: roh.length, zahlungen: zRoh ? zRoh.length : 0 };
  };
})();
