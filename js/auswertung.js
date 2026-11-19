/* Auswertung: Umsatz pro Tisch, verkaufte Artikel, Bestellungen pro Kellner, Zahlungen */
(function () {
  "use strict";
  const { CFG, DB, DEMO, $, esc, euro, uhrzeit, zusammenfassen, cent } = App;
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
      CFG.KELLNER.map((k) => {
        const kr = rows.filter((r) => r.kellner === k);
        return "<tr><td>" + esc(k) + "</td><td class='zahl'>" + new Set(kr.filter((r) => r.ziel !== "kasse").map((r) => r.gruppe)).size +
          "</td><td class='zahl'>" + euro(summe(zusammenfassen(kr))) + "</td>" +
          (zahlungen ? "<td class='zahl'><b>" + euro(zahlungen.filter((z) => z.kellner === k).reduce((s, z) => s + cent(z.betrag), 0) / 100) + "</b></td>" : "") +
          "</tr>";
      }).join("");

    document.title = "Auswertung (" + uhrzeit(new Date().toISOString()) + ") – Pub-Quiz";
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
