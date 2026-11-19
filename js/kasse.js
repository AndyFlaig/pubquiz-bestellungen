/* Kasse (Reiter in der Kellner-Ansicht): Tisch abrechnen – ganz oder mit Teilbetrag, nur Bargeld */
(function () {
  "use strict";
  const { CFG, DB, $, esc, euro, uhrzeit, zusammenfassen, cent, toast } = App;

  const kellner = () => App.store.get("kellner_name", "");
  let tisch = null;           // gewählter Tisch in der Kasse
  let rows = [], zahlungen = [];
  let fehlerKasse = false;    // Tabelle "zahlungen" fehlt / keine Verbindung
  let aktiv = false;          // Reiter sichtbar?
  let laedt = false, sperre = false;

  const bestelltCent = (nr) => zusammenfassen(rows.filter((r) => r.tisch === nr)).reduce((s, p) => s + p.cent, 0);
  const bezahltCent = (nr) => zahlungen.filter((z) => z.tisch === nr).reduce((s, z) => s + cent(z.betrag), 0);

  async function laden() {
    if (laedt) return;
    laedt = true;
    try {
      rows = await DB.listAll();
      try { zahlungen = await DB.listZahlungen(); fehlerKasse = false; }
      catch (e) { fehlerKasse = true; zahlungen = []; }
      render();
    } catch (e) {
      $("#kasse-inhalt").innerHTML = '<p class="fehler">Keine Verbindung – bitte gleich nochmal versuchen.</p>';
    } finally { laedt = false; }
  }

  function render() {
    const meins = zahlungen.filter((z) => z.kellner === kellner()).reduce((s, z) => s + cent(z.betrag), 0);
    $("#kassenstand").innerHTML = "Dein Kassenstand (" + esc(kellner()) + "): <b>" + euro(meins / 100) + "</b>";

    if (fehlerKasse) {
      $("#kasse-raster").innerHTML = "";
      $("#kasse-inhalt").innerHTML = '<p class="fehler">Die Kasse ist in Supabase noch nicht eingerichtet ' +
        "(supabase/update-kasse.sql ausführen). Bis dahin bitte die Papier-Strichliste verwenden.</p>";
      return;
    }

    // Tischübersicht mit offenem Betrag
    $("#kasse-raster").innerHTML = CFG.TISCHE.map((t) => {
      const best = bestelltCent(t.nr), rest = best - bezahltCent(t.nr);
      const st = !best ? "" : rest === 0 ? "bezahlt" : rest > 0 ? "schuldet" : "zuviel";
      const info = !best ? "–" : rest === 0 ? "✓ bezahlt" : rest > 0 ? euro(rest / 100) : "+" + euro(-rest / 100);
      return '<button class="tisch-knopf ' + st + (tisch === t.nr ? " aktiv" : "") + '" data-kasse-nr="' + t.nr + '">' +
        "<b>" + t.nr + "</b><span>" + esc(t.team) + "</span><em>" + info + "</em></button>";
    }).join("");

    if (tisch == null) { $("#kasse-inhalt").innerHTML = '<p class="klein-hinweis">Tisch antippen zum Abrechnen.</p>'; return; }

    const t = CFG.TISCHE.find((x) => x.nr === tisch);
    const pos = zusammenfassen(rows.filter((r) => r.tisch === tisch));
    const best = bestelltCent(tisch), bez = bezahltCent(tisch), rest = best - bez;
    const offeneTeile = rows.filter((r) => r.tisch === tisch && r.status === "offen").length;
    const zl = zahlungen.filter((z) => z.tisch === tisch).slice().reverse();

    $("#kasse-inhalt").innerHTML =
      '<article class="karte kasse-karte">' +
        '<header><div class="tisch">Tisch ' + t.nr + '</div><div class="team">' + esc(t.team) + "</div></header>" +
        (pos.length
          ? '<table class="tabelle">' + pos.map((p) => "<tr><td class='zahl'>" + p.anzahl + "×</td><td>" + esc(p.name + (p.menge ? " " + p.menge : "")) +
              "</td><td class='zahl'>" + euro(p.summe) + "</td></tr>").join("") + "</table>"
          : '<p class="klein-hinweis">Noch nichts bestellt.</p>') +
        (offeneTeile ? '<p class="klein-hinweis">⏳ ' + offeneTeile + " Teil(e) noch nicht geliefert – sind mitgerechnet.</p>" : "") +
        '<table class="tabelle kasse-summen">' +
          "<tr><td>Bestellt</td><td class='zahl'>" + euro(best / 100) + "</td></tr>" +
          "<tr><td>Bezahlt</td><td class='zahl'>" + euro(bez / 100) + "</td></tr>" +
          "<tr class='summe-zeile'><td>" + (rest >= 0 ? "Offen" : "Zu viel bezahlt") + "</td><td class='zahl gross-zahl'>" + euro(Math.abs(rest) / 100) + "</td></tr>" +
        "</table>" +
        (rest > 0
          ? '<button class="gross primaer" id="alles-bezahlt">✓ Alles bezahlt – ' + euro(rest / 100) + "</button>" +
            '<div class="teilbetrag">' +
              '<label>Teilbetrag (ein Gast zahlt einzeln)<input id="teil-betrag" type="text" inputmode="decimal" placeholder="z. B. 12,50"></label>' +
              '<button class="gross" id="teil-bezahlt">Teilbetrag kassieren</button>' +
            "</div>" +
            '<div class="teilbetrag"><label>Gegeben (für Rückgeld)<input id="gegeben" type="text" inputmode="decimal" placeholder="z. B. 50"></label>' +
              '<p id="rueckgeld" class="rueckgeld"></p></div>'
          : best > 0 && rest === 0 ? '<p class="zahl-status ok gross-status">✓ Tisch ist komplett bezahlt</p>'
          : rest < 0 ? '<p class="zahl-status zuviel">Zu viel kassiert (z. B. nach Storno) – Zahlung unten stornieren und neu kassieren.</p>' : "") +
        (zl.length ? "<h4>Zahlungen</h4><ul class='zahlungen'>" + zl.map((z) =>
          "<li><span>" + uhrzeit(z.erstellt_am) + " · " + esc(z.kellner) + "</span><b>" + euro(Number(z.betrag)) + "</b>" +
          (z.kellner === kellner() ? '<button class="link warnung" data-storno-zahlung="' + z.id + '">stornieren</button>' : "") +
          "</li>").join("") + "</ul>" : "") +
      "</article>";
    rueckgeldRechnen();
  }

  function betragLesen(text) {
    const v = Number(String(text || "").replace(/€/g, "").replace(/\s/g, "").replace(",", "."));
    return isFinite(v) && v > 0 ? cent(v) : 0;
  }

  function rueckgeldRechnen() {
    const el = $("#rueckgeld");
    if (!el) return;
    const rest = bestelltCent(tisch) - bezahltCent(tisch);
    const teil = betragLesen($("#teil-betrag").value);
    const zuZahlen = teil || rest;
    const gegeben = betragLesen($("#gegeben").value);
    el.textContent = gegeben
      ? (gegeben >= zuZahlen ? "Rückgeld: " + euro((gegeben - zuZahlen) / 100) : "Fehlen noch: " + euro((zuZahlen - gegeben) / 100))
      : "";
  }

  async function kassieren(betragCent) {
    if (sperre || !betragCent) return;
    if (!kellner()) { toast("Bitte zuerst Kellnernamen wählen", { art: "fehler" }); return; }
    if (!confirm("Tisch " + tisch + ": " + euro(betragCent / 100) + " bar kassiert?")) return;
    sperre = true;
    try {
      await DB.insertZahlung({ tisch, kellner: kellner(), betrag: betragCent / 100 });
      toast("✓ " + euro(betragCent / 100) + " für Tisch " + tisch + " verbucht", { art: "ok" });
    } catch (e) {
      toast("NICHT verbucht – keine Verbindung. Bitte nochmal.", { art: "fehler", dauer: 6000 });
    } finally { sperre = false; }
    await laden();
  }

  $("#seite-kasse").addEventListener("click", async (e) => {
    const tb = e.target.closest("[data-kasse-nr]");
    if (tb) { tisch = Number(tb.dataset.kasseNr); render(); $("#kasse-inhalt").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (e.target.closest("#alles-bezahlt")) return kassieren(bestelltCent(tisch) - bezahltCent(tisch));
    if (e.target.closest("#teil-bezahlt")) {
      const b = betragLesen($("#teil-betrag").value);
      const rest = bestelltCent(tisch) - bezahltCent(tisch);
      if (!b) { toast("Bitte Betrag eingeben", { art: "fehler" }); return; }
      if (b > rest && !confirm("Das ist mehr als offen (" + euro(rest / 100) + "). Trotzdem verbuchen?")) return;
      return kassieren(b);
    }
    const sz = e.target.closest("[data-storno-zahlung]");
    if (sz) {
      const z = zahlungen.find((x) => x.id === Number(sz.dataset.stornoZahlung));
      if (!z || !confirm("Zahlung über " + euro(Number(z.betrag)) + " stornieren?")) return;
      try {
        const ok = await DB.stornoZahlung(z.id);
        toast(ok ? "Zahlung storniert" : "Schon storniert", { art: ok ? "ok" : "fehler" });
      } catch (err) { toast("Fehler – keine Verbindung", { art: "fehler" }); }
      laden();
    }
  });
  $("#seite-kasse").addEventListener("input", (e) => {
    if (e.target.id === "teil-betrag" || e.target.id === "gegeben") rueckgeldRechnen();
  });

  // Reiter-Wechsel aus kellner.js
  window.addEventListener("reiter", (e) => { aktiv = e.detail === "kasse"; if (aktiv) laden(); });
  // Aktualisieren, solange die Kasse offen ist – aber nicht, während jemand tippt
  const darfNeuLaden = () => aktiv && !["teil-betrag", "gegeben"].includes(document.activeElement && document.activeElement.id)
    && !($("#teil-betrag") && $("#teil-betrag").value) && !($("#gegeben") && $("#gegeben").value);
  setInterval(() => { if (darfNeuLaden()) laden(); }, 15000);
  DB.onChange(() => { if (darfNeuLaden()) laden(); });
})();
