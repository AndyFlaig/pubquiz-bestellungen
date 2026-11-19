/* Auswertung: Umsatz pro Tisch, verkaufte Artikel, Bestellungen pro Kellner */
(function () {
  "use strict";
  const { CFG, DB, DEMO, $, esc, euro, uhrzeit } = App;
  const verbindung = App.verbindungsAnzeige($("#verbindung"));
  const reihenfolge = new Map(CFG.ARTIKEL.map((a, i) => [a.id, i]));

  const key = (p) => p.id || p.name + "|" + (p.menge || "");
  const posText = (p) => p.name + (p.menge ? " " + p.menge : "");
  const sortPos = (a, b) => (reihenfolge.get(a.id) ?? 999) - (reihenfolge.get(b.id) ?? 999);

  // Positionen mehrerer Bestellungen zusammenzählen
  function zusammenfassen(rows) {
    const m = new Map();
    rows.forEach((r) => r.positionen.forEach((p) => {
      const k = key(p);
      const e = m.get(k) || { id: p.id, name: p.name, menge: p.menge, preis: Number(p.preis) || 0, anzahl: 0, summe: 0 };
      e.anzahl += p.anzahl;
      e.summe += p.anzahl * (Number(p.preis) || 0);
      m.set(k, e);
    }));
    return [...m.values()].sort(sortPos);
  }
  const summe = (pos) => pos.reduce((s, p) => s + p.summe, 0);

  function render(rows) {
    const alle = zusammenfassen(rows);
    const gruppen = new Set(rows.map((r) => r.gruppe)).size;
    const offen = rows.filter((r) => r.status === "offen").length;
    const getraenke = summe(zusammenfassen(rows.filter((r) => r.ziel === "theke")));
    const speisen = summe(zusammenfassen(rows.filter((r) => r.ziel === "kueche")));

    $("#kacheln").innerHTML =
      kachel("Umsatz gesamt", euro(summe(alle))) +
      kachel("Getränke", euro(getraenke)) +
      kachel("Speisen", euro(speisen)) +
      kachel("Bestellungen", gruppen + (offen ? " <small>(noch offen: " + offen + ")</small>" : ""));

    // Pro Tisch
    $("#tische").innerHTML = CFG.TISCHE.map((t) => {
      const tr = rows.filter((r) => r.tisch === t.nr);
      const pos = zusammenfassen(tr);
      const off = tr.filter((r) => r.status === "offen").length;
      return '<article class="karte klein' + (pos.length ? "" : " leer-karte") + '">' +
        '<header><div class="tisch">Tisch ' + t.nr + '</div><div class="team">' + esc(t.team) + "</div>" +
        '<span class="tisch-summe">' + euro(summe(pos)) + "</span></header>" +
        (pos.length
          ? '<table class="tabelle">' + pos.map((p) =>
              "<tr><td class='zahl'>" + p.anzahl + "×</td><td>" + esc(posText(p)) + "</td><td class='zahl'>" + euro(p.summe) + "</td></tr>").join("") + "</table>"
          : '<p class="klein-hinweis">Noch nichts bestellt</p>') +
        (off ? '<p class="klein-hinweis">⏳ ' + "noch offen: " + off + "</p>" : "") +
        "</article>";
    }).join("");

    // Artikel
    $("#artikel-tabelle").innerHTML =
      "<tr><th class='zahl'>Anzahl</th><th>Artikel</th><th class='zahl'>Umsatz</th></tr>" +
      alle.map((p) => "<tr><td class='zahl'>" + p.anzahl + "</td><td>" + esc(posText(p)) + "</td><td class='zahl'>" + euro(p.summe) + "</td></tr>").join("") +
      "<tr class='summe-zeile'><td></td><td>Summe</td><td class='zahl'>" + euro(summe(alle)) + "</td></tr>";

    // Kellner
    $("#kellner-tabelle").innerHTML =
      "<tr><th>Kellner</th><th class='zahl'>Bestellungen</th><th class='zahl'>Umsatz</th></tr>" +
      CFG.KELLNER.map((k) => {
        const kr = rows.filter((r) => r.kellner === k);
        return "<tr><td>" + esc(k) + "</td><td class='zahl'>" + new Set(kr.map((r) => r.gruppe)).size +
          "</td><td class='zahl'>" + euro(summe(zusammenfassen(kr))) + "</td></tr>";
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
      verbindung.erfolg();
      render(rows);
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
    setInterval(laden, 30000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") laden(); });
  })();
})();
