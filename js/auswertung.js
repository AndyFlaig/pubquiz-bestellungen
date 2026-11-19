/* Auswertung: Umsatz pro Tisch, verkaufte Artikel, Bestellungen pro Kellner, Zahlungen */
(function () {
  "use strict";
  const { CFG, DB, DEMO, $, esc, euro, uhrzeit, zusammenfassen, cent, toast } = App;
  const verbindung = App.verbindungsAnzeige($("#verbindung"));

  const posText = (p) => p.name + (p.menge ? " " + p.menge : "");
  const summeCent = (pos) => pos.reduce((s, p) => s + p.cent, 0);
  const summe = (pos) => summeCent(pos) / 100;

  // zahlungen = null, wenn die Kasse in Supabase noch nicht eingerichtet ist
  function render(rows, zahlungen) {
    const alle = zusammenfassen(rows);
    const gruppen = new Set(rows.filter((r) => r.ziel !== "kasse").map((r) => r.gruppe)).size;
    const offen = rows.filter((r) => r.status === "offen").length;
    const getraenke = summe(zusammenfassen(rows.filter((r) => r.ziel === "theke")));
    const speisen = summe(zusammenfassen(rows.filter((r) => r.ziel === "kueche")));
    const snacks = summe(zusammenfassen(rows.filter((r) => r.ziel === "kasse")));
    const bezahltCent = zahlungen ? zahlungen.reduce((s, z) => s + cent(z.betrag), 0) : 0;

    $("#kacheln").innerHTML =
      kachel("Umsatz gesamt", euro(summe(alle))) +
      kachel("Getränke", euro(getraenke)) +
      kachel("Speisen", euro(speisen)) +
      kachel("Snacks", euro(snacks)) +
      (zahlungen ? kachel("Kassiert", euro(bezahltCent / 100)) +
        kachel("Noch offen", euro((summeCent(alle) - bezahltCent) / 100)) : "") +
      kachel("Bestellungen", gruppen + (offen ? " <small>(noch offen: " + offen + ")</small>" : ""));

    // Pro Tisch
    $("#tische").innerHTML = CFG.TISCHE.map((t) => {
      const tr = rows.filter((r) => r.tisch === t.nr);
      const pos = zusammenfassen(tr);
      const off = tr.filter((r) => r.status === "offen").length;
      let zahlZeile = "";
      if (zahlungen && pos.length) {
        const bez = zahlungen.filter((z) => z.tisch === t.nr).reduce((s, z) => s + cent(z.betrag), 0);
        const rest = summeCent(pos) - bez;
        zahlZeile = '<p class="zahl-status ' + (rest === 0 ? "ok" : rest > 0 ? "offen" : "zuviel") + '">' +
          (rest === 0 ? "✓ bezahlt" : rest > 0 ? "offen: " + euro(rest / 100) + (bez ? " (bezahlt " + euro(bez / 100) + ")" : "")
            : "zu viel bezahlt: " + euro(-rest / 100)) + "</p>";
      }
      return '<article class="karte klein' + (pos.length ? "" : " leer-karte") + '">' +
        '<header><div class="tisch">Tisch ' + t.nr + '</div><div class="team">' + esc(t.team) + "</div>" +
        '<span class="tisch-summe">' + euro(summe(pos)) + "</span></header>" +
        (pos.length
          ? '<table class="tabelle">' + pos.map((p) =>
              "<tr><td class='zahl'>" + p.anzahl + "×</td><td>" + esc(posText(p)) + "</td><td class='zahl'>" + euro(p.summe) + "</td></tr>").join("") + "</table>"
          : '<p class="klein-hinweis">Noch nichts bestellt</p>') +
        zahlZeile +
        (off ? '<p class="klein-hinweis">⏳ noch offen: ' + off + "</p>" : "") +
        "</article>";
    }).join("");

    // Artikel
    $("#artikel-tabelle").innerHTML =
      "<tr><th class='zahl'>Anzahl</th><th>Artikel</th><th class='zahl'>Umsatz</th></tr>" +
      alle.map((p) => "<tr><td class='zahl'>" + p.anzahl + "</td><td>" + esc(posText(p)) + "</td><td class='zahl'>" + euro(p.summe) + "</td></tr>").join("") +
      "<tr class='summe-zeile'><td></td><td>Summe</td><td class='zahl'>" + euro(summe(alle)) + "</td></tr>";

    // Kellner
    $("#kellner-tabelle").innerHTML =
      "<tr><th>Kellner</th><th class='zahl'>Bestellungen</th><th class='zahl'>Umsatz</th>" +
      (zahlungen ? "<th class='zahl'>Kassiert (bar)</th>" : "") + "</tr>" +
      alleKellner(rows, zahlungen).map((k) => {
        const kr = rows.filter((r) => r.kellner === k);
        return "<tr><td>" + esc(k) + "</td><td class='zahl'>" + new Set(kr.filter((r) => r.ziel !== "kasse").map((r) => r.gruppe)).size +
          "</td><td class='zahl'>" + euro(summe(zusammenfassen(kr))) + "</td>" +
          (zahlungen ? "<td class='zahl'><b>" + euro(zahlungen.filter((z) => z.kellner === k).reduce((s, z) => s + cent(z.betrag), 0) / 100) + "</b></td>" : "") +
          "</tr>";
      }).join("");

    document.title = "Auswertung (" + uhrzeit(new Date().toISOString()) + ") – Pub-Quiz";
  }

  // Kellner aus der Liste + alle, die in den Daten vorkommen (z. B. nach Umbenennung im Admin)
  function alleKellner(rows, zahlungen) {
    const n = [...CFG.KELLNER];
    rows.forEach((r) => { if (!n.includes(r.kellner)) n.push(r.kellner); });
    (zahlungen || []).forEach((z) => { if (!n.includes(z.kellner)) n.push(z.kellner); });
    return n;
  }

  function kachel(titel, wert) {
    return '<div class="kachel"><div class="kachel-titel">' + esc(titel) + '</div><div class="kachel-wert">' + wert + "</div></div>";
  }

  let laedt = false;
  async function laden() {
    if (laedt) return;
    laedt = true;
    try {
      const rows = await DB.listAll();
      let zahlungen = null;
      try { zahlungen = await DB.listZahlungen(); } catch (e) { /* Kasse noch nicht eingerichtet */ }
      verbindung.erfolg();
      render(rows, zahlungen);
    } catch (e) { verbindung.fehler(); }
    finally { laedt = false; }
  }

  document.querySelectorAll(".auswertung-reiter button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".auswertung-reiter button").forEach((x) => x.classList.toggle("aktiv", x === b));
      ["tische", "artikel", "kellner"].forEach((s) => { $("#seite-" + s).hidden = b.dataset.seite !== s; });
    };
  });
  $("#aktualisieren").onclick = laden;

  // ------------------------------------------------------------------
  // Excel-Export
  // ------------------------------------------------------------------
  const ZIEL_NAME = { kueche: "Küche", theke: "Theke", kasse: "Nur Strichliste" };
  const zeit = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
      d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };
  const eur = (c) => Math.round(c) / 100;

  async function exportieren() {
    const knopf = $("#excel");
    knopf.disabled = true; knopf.textContent = "…";
    try {
      const roh = await DB.listAlleRoh();
      let zRoh = null;
      try { zRoh = await DB.listZahlungenRoh(); } catch (e) { /* Kasse nicht eingerichtet */ }
      const rows = roh.filter((r) => r.status !== "storniert");
      const zahl = zRoh ? zRoh.filter((z) => z.status === "gueltig") : [];
      const blaetter = [];

      blaetter.push({
        name: "Pro Tisch",
        spalten: [{ titel: "Tisch", typ: "zahl", breite: 7 }, { titel: "Team", breite: 32 }, { titel: "Bestellt", typ: "euro", breite: 12 },
          { titel: "Bezahlt", typ: "euro", breite: 12 }, { titel: "Offen", typ: "euro", breite: 12 }, { titel: "Artikel", breite: 80 }],
        zeilen: CFG.TISCHE.map((t) => {
          const pos = zusammenfassen(rows.filter((r) => r.tisch === t.nr));
          const best = summeCent(pos);
          const bez = zahl.filter((z) => z.tisch === t.nr).reduce((s, z) => s + cent(z.betrag), 0);
          return [t.nr, t.team, eur(best), eur(bez), eur(best - bez), pos.map((p) => p.anzahl + "× " + posText(p)).join(", ")];
        }),
      });

      blaetter.push({
        name: "Artikel",
        spalten: [{ titel: "Artikel", breite: 28 }, { titel: "Menge", breite: 9 }, { titel: "Anzahl", typ: "zahl", breite: 9 },
          { titel: "Einzelpreis", typ: "euro", breite: 12 }, { titel: "Umsatz", typ: "euro", breite: 12 }],
        zeilen: zusammenfassen(rows).map((p) => [p.name, p.menge || "", p.anzahl, p.preis, eur(p.cent)]),
      });

      blaetter.push({
        name: "Kellner",
        spalten: [{ titel: "Kellner", breite: 16 }, { titel: "Bestellungen", typ: "zahl", breite: 13 },
          { titel: "Umsatz", typ: "euro", breite: 12 }, { titel: "Kassiert (bar)", typ: "euro", breite: 14 }],
        zeilen: alleKellner(rows, zahl).map((k) => {
          const kr = rows.filter((r) => r.kellner === k);
          return [k, new Set(kr.filter((r) => r.ziel !== "kasse").map((r) => r.gruppe)).size, summe(zusammenfassen(kr)),
            eur(zahl.filter((z) => z.kellner === k).reduce((s, z) => s + cent(z.betrag), 0))];
        }),
      });

      const posZeilen = [];
      roh.forEach((r) => r.positionen.forEach((p) => posZeilen.push([
        r.id, zeit(r.erstellt_am), r.tisch, r.team, r.kellner, ZIEL_NAME[r.ziel] || r.ziel, r.status,
        p.anzahl, p.name, p.menge || "", Number(p.preis) || 0, eur(p.anzahl * cent(p.preis)), p.notiz || "", r.kommentar || "", zeit(r.geaendert_am),
      ])));
      blaetter.push({
        name: "Bestellpositionen",
        spalten: [{ titel: "Nr", typ: "zahl", breite: 6 }, { titel: "Zeit", breite: 20 }, { titel: "Tisch", typ: "zahl", breite: 7 },
          { titel: "Team", breite: 26 }, { titel: "Kellner", breite: 12 }, { titel: "Ziel", breite: 15 }, { titel: "Status", breite: 11 },
          { titel: "Anzahl", typ: "zahl", breite: 8 }, { titel: "Artikel", breite: 26 }, { titel: "Menge", breite: 8 },
          { titel: "Einzelpreis", typ: "euro", breite: 12 }, { titel: "Summe", typ: "euro", breite: 11 },
          { titel: "Notiz (Artikel)", breite: 24 }, { titel: "Kommentar", breite: 30 }, { titel: "Geändert", breite: 20 }],
        zeilen: posZeilen,
      });

      if (zRoh) {
        blaetter.push({
          name: "Zahlungen",
          spalten: [{ titel: "Nr", typ: "zahl", breite: 6 }, { titel: "Zeit", breite: 20 }, { titel: "Tisch", typ: "zahl", breite: 7 },
            { titel: "Kellner", breite: 12 }, { titel: "Betrag", typ: "euro", breite: 11 }, { titel: "Status", breite: 11 },
            { titel: "Artikel", breite: 60 }],
          zeilen: zRoh.map((z) => [z.id, zeit(z.erstellt_am), z.tisch, z.kellner, Number(z.betrag), z.status,
            Array.isArray(z.positionen) ? z.positionen.map((p) => p.anzahl + "× " + posText(p)).join(", ") : ""]),
        });
      }

      const d = new Date();
      const stempel = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") +
        "_" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0");
      App.excelHerunterladen("pubquiz_" + stempel + ".xlsx", blaetter);
      toast("Excel-Datei erstellt", { art: "ok" });
    } catch (e) {
      toast("Export fehlgeschlagen – keine Verbindung?", { art: "fehler" });
    } finally {
      knopf.disabled = false; knopf.textContent = "⬇ Excel";
    }
  }
  $("#excel").onclick = exportieren;

  (async function start() {
    await App.pinPruefen("auswertung");
    if (DEMO) $("#demo-hinweis").hidden = false;
    laden();
    let timer = null;
    DB.onChange(() => { clearTimeout(timer); timer = setTimeout(laden, 1000); }, (live) => verbindung.live(live));
    setInterval(laden, 20000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") laden(); });
  })();
})();
