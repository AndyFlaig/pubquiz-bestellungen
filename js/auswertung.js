/* Auswertung: Umsatz pro Tisch, verkaufte Artikel, Bestellungen pro Kellner, Zahlungen */
(function () {
  "use strict";
  const { CFG, DB, DEMO, $, esc, euro, uhrzeit, zusammenfassen, cent, toast } = App;
  const verbindung = App.verbindungsAnzeige($("#verbindung"));

  const posText = (p) => p.name + (p.menge ? " " + p.menge : "");
  const summeCent = (pos) => pos.reduce((s, p) => s + p.cent, 0);
  const summe = (pos) => summeCent(pos) / 100;

  // Startgeld: Soll = Betrag × Gästetische; kassiert = Startgeld-Positionen in den Zahlungen
  const START_ID = "startgeld";
  const startSollTisch = () => cent(CFG.STARTGELD || 0);
  const gaesteTische = () => CFG.TISCHE.filter((t) => !t.eigen);
  const startKassiert = (zs, nr) => (zs || []).filter((z) => nr === undefined || z.tisch === nr)
    .reduce((s, z) => s + (z.positionen || []).filter((p) => p.id === START_ID).reduce((t, p) => t + cent(p.preis) * (p.anzahl || 1), 0), 0);

  // zahlungen = null, wenn die Kasse in Supabase noch nicht eingerichtet ist
  function render(alleRows, zahlungen) {
    const eigenRows = alleRows.filter(App.istEigen);
    const rows = alleRows.filter((r) => !App.istEigen(r)); // ab hier nur Verkauf (Umsatz)
    const alle = zusammenfassen(rows);
    const eigenPos = zusammenfassen(eigenRows);
    const gruppen = new Set(rows.filter((r) => r.ziel !== "kasse").map((r) => r.gruppe)).size;
    const offen = rows.filter((r) => r.status === "offen").length;
    const getraenke = summe(zusammenfassen(rows.filter((r) => r.ziel === "theke")));
    const speisen = summe(zusammenfassen(rows.filter((r) => r.ziel === "kueche")));
    const snacks = summe(zusammenfassen(rows.filter((r) => r.ziel === "kasse")));
    const bezahltCent = zahlungen ? zahlungen.reduce((s, z) => s + cent(z.betrag), 0) : 0;
    const trinkgeldCent = zahlungen ? zahlungen.reduce((s, z) => s + cent(z.trinkgeld || 0), 0) : 0;
    const startSoll = startSollTisch() * gaesteTische().length;
    const startBez = startKassiert(zahlungen);

    $("#kacheln").innerHTML =
      kachel("Umsatz gesamt", euro((summeCent(alle) + startSoll + trinkgeldCent) / 100) +
        (startSoll || trinkgeldCent ? " <small class='tg-klein'>inkl. " + [startSoll ? "Startgeld" : "", trinkgeldCent ? "Trinkgeld" : ""].filter(Boolean).join(" + ") + "</small>" : "")) +
      kachel("Getränke", euro(getraenke)) +
      kachel("Speisen", euro(speisen)) +
      kachel("Snacks", euro(snacks)) +
      (startSoll ? kachel("🎟 Startgeld", euro(startSoll / 100) + " <small>(kassiert " + euro(startBez / 100) + ")</small>") : "") +
      (zahlungen ? kachel("Trinkgeld", euro(trinkgeldCent / 100)) +
        kachel("Kassiert (bar)", euro((bezahltCent + trinkgeldCent) / 100)) +
        kachel("Noch offen", euro((summeCent(alle) + startSoll - bezahltCent) / 100)) : "") +
      kachel("Bestellungen", gruppen + (offen ? " <small>(noch offen: " + offen + ")</small>" : "")) +
      (eigenRows.length ? kachel("Eigenverzehr (Warenwert)", euro(summe(eigenPos)) + " <small class='eigen-klein'>nicht im Umsatz</small>") : "");

    // Pro Tisch
    $("#tische").innerHTML = CFG.TISCHE.filter((t) => !t.eigen).map((t) => {
      const tr = rows.filter((r) => r.tisch === t.nr);
      const pos = zusammenfassen(tr);
      const off = tr.filter((r) => r.status === "offen").length;
      const start = startSollTisch();
      let zahlZeile = "";
      if (zahlungen && (pos.length || start)) {
        const bez = zahlungen.filter((z) => z.tisch === t.nr).reduce((s, z) => s + cent(z.betrag), 0);
        const rest = summeCent(pos) + start - bez;
        zahlZeile = '<p class="zahl-status ' + (rest === 0 ? "ok" : rest > 0 ? "offen" : "zuviel") + '">' +
          (rest === 0 ? "✓ bezahlt" : rest > 0 ? "offen: " + euro(rest / 100) + (bez ? " (bezahlt " + euro(bez / 100) + ")" : "")
            : "zu viel bezahlt: " + euro(-rest / 100)) + "</p>";
      }
      return '<article class="karte klein' + (pos.length ? "" : " leer-karte") + '">' +
        '<header><div class="tisch">Tisch ' + t.nr + '</div><div class="team">' + esc(t.team) + "</div>" +
        '<span class="tisch-summe">' + euro((summeCent(pos) + start) / 100) + "</span></header>" +
        (pos.length || start
          ? '<table class="tabelle">' +
              (start ? "<tr><td class='zahl'>🎟</td><td>Startgeld</td><td class='zahl'>" + euro(start / 100) + "</td></tr>" : "") +
              pos.map((p) =>
              "<tr><td class='zahl'>" + p.anzahl + "×</td><td>" + esc(posText(p)) + "</td><td class='zahl'>" + euro(p.summe) + "</td></tr>").join("") + "</table>"
          : '<p class="klein-hinweis">Noch nichts bestellt</p>') +
        zahlZeile +
        (off ? '<p class="klein-hinweis">⏳ noch offen: ' + off + "</p>" : "") +
        "</article>";
    }).join("") + eigenKarten(eigenRows);

    // Artikel
    const inv = inventur(rows, eigenRows);
    $("#artikel-tabelle").innerHTML =
      "<tr><th>Artikel</th><th class='zahl'>Ver&shy;kauft</th><th class='zahl' title='Eigenverzehr'>Eigen</th><th class='zahl' title='Gesamt für die Inventur'>Inven&shy;tur</th><th class='zahl'>Umsatz</th></tr>" +
      inv.map((x) => "<tr><td>" + esc(posText(x)) + "</td><td class='zahl'>" + x.verkauft + "</td><td class='zahl'>" + (x.eigen || "") +
        "</td><td class='zahl'><b>" + (x.verkauft + x.eigen) + "</b></td><td class='zahl'>" + euro(x.umsatzCent / 100) + "</td></tr>").join("") +
      "<tr class='summe-zeile'><td>Summe</td><td class='zahl'>" + inv.reduce((s, x) => s + x.verkauft, 0) + "</td><td class='zahl'>" +
        inv.reduce((s, x) => s + x.eigen, 0) + "</td><td class='zahl'>" + inv.reduce((s, x) => s + x.verkauft + x.eigen, 0) +
        "</td><td class='zahl'>" + euro(summe(alle)) + "</td></tr>";

    // Kellner
    $("#kellner-tabelle").innerHTML =
      "<tr><th>Kellner</th><th class='zahl'>Bestellungen</th><th class='zahl'>Umsatz</th>" +
      (zahlungen ? "<th class='zahl'>Trinkgeld</th><th class='zahl'>Kassiert (bar)</th>" : "") + "</tr>" +
      alleKellner(rows, zahlungen).map((k) => {
        const kr = rows.filter((r) => r.kellner === k);
        return "<tr><td>" + esc(k) + "</td><td class='zahl'>" + new Set(kr.filter((r) => r.ziel !== "kasse").map((r) => r.gruppe)).size +
          "</td><td class='zahl'>" + euro(summe(zusammenfassen(kr))) + "</td>" +
          (zahlungen ? "<td class='zahl'>" + euro(zahlungen.filter((z) => z.kellner === k).reduce((s, z) => s + cent(z.trinkgeld || 0), 0) / 100) + "</td>" +
            "<td class='zahl'><b>" + euro(zahlungen.filter((z) => z.kellner === k).reduce((s, z) => s + cent(z.betrag) + cent(z.trinkgeld || 0), 0) / 100) + "</b></td>" : "") +
          "</tr>";
      }).join("");

    document.title = "Auswertung (" + uhrzeit(new Date().toISOString()) + ") – Pub-Quiz";
  }

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

  // Karten für Eigenverzehr (pro Bereich/Person, so wie im Admin angelegt)
  function eigenKarten(eigenRows) {
    if (!eigenRows.length) return "";
    const gruppen = new Map();
    eigenRows.forEach((r) => { const k = r.tisch + "|" + r.team; (gruppen.get(k) || gruppen.set(k, []).get(k)).push(r); });
    return '<h3 class="eigen-ueberschrift">👤 Eigenverzehr – zählt nicht zum Umsatz</h3>' +
      [...gruppen.values()].map((rs) => {
        const pos = zusammenfassen(rs);
        return '<article class="karte klein eigen-karte"><header><div class="tisch">👤</div><div class="team">' + esc(rs[0].team) + "</div>" +
          '<span class="tisch-summe eigen-wert">' + euro(summe(pos)) + "</span></header>" +
          '<table class="tabelle">' + pos.map((p) => "<tr><td class='zahl'>" + p.anzahl + "×</td><td>" + esc(posText(p)) +
            "</td><td class='zahl'>" + euro(p.summe) + "</td></tr>").join("") + "</table>" +
          '<p class="klein-hinweis">Warenwert – wird nicht kassiert</p></article>';
      }).join("");
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
  $("#durchsage").onclick = () => App.durchsageDialog("Orga");

  // Pause mit Countdown (wird auf dem Beamer angezeigt) – Logik in common.js
  App.pauseKnopf($("#pause-knopf"));

  // ------------------------------------------------------------------
  // Excel-Export
  // ------------------------------------------------------------------
  async function exportieren() {
    const knopf = $("#excel");
    knopf.disabled = true; knopf.textContent = "…";
    try {
      await App.excelExport();
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
