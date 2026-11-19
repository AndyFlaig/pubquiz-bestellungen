/* Kasse (Reiter in der Kellner-Ansicht): Tisch abrechnen – pro Artikel oder alles, nur Bargeld */
(function () {
  "use strict";
  const { CFG, DB, $, esc, euro, uhrzeit, zusammenfassen, cent, toast } = App;

  const kellner = () => App.store.get("kellner_name", "");
  const key = (p) => p.id || p.name + "|" + (p.menge || "");
  const posText = (p) => p.name + (p.menge ? " " + p.menge : "");

  let tisch = null;            // gewählter Tisch
  let rows = [], zahlungen = [];
  let fehlerKasse = false;     // Tabelle "zahlungen" fehlt oder ist veraltet
  let aktiv = false;           // Reiter sichtbar?
  let laedt = false, sperre = false;
  let auswahl = new Map();     // key -> Anzahl, die jetzt bezahlt wird
  let snackWahl = new Map();   // Artikel-id -> Anzahl, die jetzt auf die Rechnung kommt
  // Artikel, die nur erfasst werden (z. B. Snacks auf dem Tisch) – können direkt in der Kasse dazukommen
  const kassenArtikel = () => CFG.ARTIKEL.filter((a) => a.ziel === "kasse");

  const bestelltCent = (nr) => zusammenfassen(rows.filter((r) => r.tisch === nr)).reduce((s, p) => s + p.cent, 0);
  const bezahltCent = (nr) => zahlungen.filter((z) => z.tisch === nr).reduce((s, z) => s + cent(z.betrag), 0);

  // Pro Artikel: bestellt, bezahlt, offen
  function artikelStand(nr) {
    const best = zusammenfassen(rows.filter((r) => r.tisch === nr));
    const bez = new Map(zusammenfassen(zahlungen.filter((z) => z.tisch === nr && Array.isArray(z.positionen))).map((p) => [key(p), p.anzahl]));
    const liste = best.map((p) => ({ p, key: key(p), bestellt: p.anzahl, bezahlt: bez.get(key(p)) || 0 }));
    // bezahlt, aber (nach Storno) nicht mehr bestellt
    bez.forEach((n, k) => { if (!liste.some((x) => x.key === k)) {
      const z = zusammenfassen(zahlungen.filter((zz) => zz.tisch === nr && Array.isArray(zz.positionen))).find((q) => key(q) === k);
      liste.push({ p: z, key: k, bestellt: 0, bezahlt: n });
    } });
    liste.forEach((x) => { x.offen = x.bestellt - x.bezahlt; });
    return liste;
  }

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

  function auswahlCent(stand) {
    return stand.reduce((s, x) => s + (auswahl.get(x.key) || 0) * cent(x.p.preis), 0);
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

    $("#kasse-raster").innerHTML = CFG.TISCHE.map((t) => {
      const best = bestelltCent(t.nr), rest = best - bezahltCent(t.nr);
      const st = !best && !rest ? "" : rest === 0 ? "bezahlt" : rest > 0 ? "schuldet" : "zuviel";
      const info = !best && !rest ? "–" : rest === 0 ? "✓ bezahlt" : rest > 0 ? euro(rest / 100) : "+" + euro(-rest / 100);
      return '<button class="tisch-knopf ' + st + (tisch === t.nr ? " aktiv" : "") + '" data-kasse-nr="' + t.nr + '">' +
        "<b>" + t.nr + "</b><span>" + esc(t.team) + "</span><em>" + info + "</em></button>";
    }).join("");

    if (tisch == null) { $("#kasse-inhalt").innerHTML = '<p class="klein-hinweis">Tisch antippen zum Abrechnen.</p>'; return; }

    const t = CFG.TISCHE.find((x) => x.nr === tisch);
    const stand = artikelStand(tisch);
    const best = bestelltCent(tisch), bez = bezahltCent(tisch), rest = best - bez;
    const offeneTeile = rows.filter((r) => r.tisch === tisch && r.status === "offen").length;
    const zl = zahlungen.filter((z) => z.tisch === tisch).slice().reverse();
    // Auswahl auf das Mögliche begrenzen
    stand.forEach((x) => { const a = auswahl.get(x.key) || 0; if (a > Math.max(0, x.offen)) auswahl.set(x.key, Math.max(0, x.offen)); });
    const ausw = auswahlCent(stand);

    $("#kasse-inhalt").innerHTML =
      '<article class="karte kasse-karte">' +
        '<header><div class="tisch">Tisch ' + t.nr + '</div><div class="team">' + esc(t.team) + "</div></header>" +
        snackBox() +
        (stand.length ? '<p class="klein-hinweis">Was zahlt der Gast? Artikel mit <b>+</b> auswählen.</p>' +
          '<div class="kasse-artikel">' + stand.map((x) => {
            const a = auswahl.get(x.key) || 0;
            const fertig = x.offen <= 0;
            return '<div class="kasse-zeile' + (fertig ? " fertig" : "") + (a ? " gewaehlt" : "") + '">' +
              '<div class="kasse-name"><span>' + esc(posText(x.p)) + "</span><small>" + euro(Number(x.p.preis)) + " · " +
                (x.offen > 0 ? "<b>" + x.offen + " offen</b>" + (x.bezahlt ? " · " + x.bezahlt + " bezahlt" : "")
                  : x.offen === 0 ? "✓ alle " + x.bezahlt + " bezahlt" : "<b class='rot'>" + (-x.offen) + " zu viel bezahlt</b>") +
              "</small></div>" +
              (x.offen > 0 ? '<div class="stepper">' +
                '<button class="minus" data-k-minus="' + esc(x.key) + '" aria-label="weniger">−</button>' +
                '<span class="anzahl">' + (a || "") + "</span>" +
                '<button class="plus" data-k-plus="' + esc(x.key) + '" aria-label="mehr">+</button></div>' : "") +
              "</div>";
          }).join("") + "</div>"
          : '<p class="klein-hinweis">Noch nichts bestellt.</p>') +
        (offeneTeile ? '<p class="klein-hinweis">⏳ ' + offeneTeile + " Teil(e) noch nicht geliefert – sind mitgerechnet.</p>" : "") +
        '<table class="tabelle kasse-summen">' +
          "<tr><td>Bestellt</td><td class='zahl'>" + euro(best / 100) + "</td></tr>" +
          "<tr><td>Bezahlt</td><td class='zahl'>" + euro(bez / 100) + "</td></tr>" +
          "<tr class='summe-zeile'><td>" + (rest >= 0 ? "Offen" : "Zu viel bezahlt") + "</td><td class='zahl gross-zahl'>" + euro(Math.abs(rest) / 100) + "</td></tr>" +
        "</table>" +
        (rest > 0
          ? (ausw ? '<div class="auswahl-box"><div class="auswahl-summe">Auswahl: <b>' + euro(ausw / 100) + "</b></div>" +
                '<button class="gross primaer" id="auswahl-bezahlt">Auswahl kassieren – ' + euro(ausw / 100) + "</button>" +
                '<button class="link" id="auswahl-leeren">Auswahl leeren</button></div>'
              : "") +
            '<button class="gross' + (ausw ? "" : " primaer") + '" id="alles-bezahlt">✓ Alles bezahlt – ' + euro(rest / 100) + "</button>" +
            '<div class="teilbetrag"><label>Gegeben (für Rückgeld)<input id="gegeben" type="text" inputmode="decimal" placeholder="z. B. 50"></label>' +
              '<p id="rueckgeld" class="rueckgeld"></p></div>'
          : best > 0 && rest === 0 ? '<p class="zahl-status ok gross-status">✓ Tisch ist komplett bezahlt</p>'
          : rest < 0 ? '<p class="zahl-status zuviel">Zu viel kassiert (z. B. nach Storno) – Zahlung unten stornieren und neu kassieren.</p>' : "") +
        (zl.length ? "<h4>Zahlungen</h4><ul class='zahlungen'>" + zl.map((z) =>
          "<li><div><span>" + uhrzeit(z.erstellt_am) + " · " + esc(z.kellner) + "</span>" +
          (Array.isArray(z.positionen) && z.positionen.length
            ? "<small>" + esc(z.positionen.map((p) => p.anzahl + "× " + posText(p)).join(", ")) + "</small>" : "") + "</div>" +
          "<b>" + euro(Number(z.betrag)) + "</b>" +
          (z.kellner === kellner() ? '<button class="link warnung" data-storno-zahlung="' + z.id + '">stornieren</button>' : "") +
          "</li>").join("") + "</ul>" : "") +
      "</article>";
    rueckgeldRechnen();
  }

  // Box "Snacks vom Tisch": Anzahl wählen und auf die Rechnung setzen
  function snackBox() {
    const liste = kassenArtikel();
    if (!liste.length) return "";
    const summe = liste.reduce((s, a) => s + (snackWahl.get(a.id) || 0) * cent(a.preis), 0);
    return '<div class="snack-box"><h4>🥨 Vom Tisch genommen? Auf die Rechnung setzen</h4>' +
      liste.map((a) => {
        const n = snackWahl.get(a.id) || 0;
        return '<div class="kasse-zeile' + (n ? " gewaehlt" : "") + '"><div class="kasse-name"><span>' + esc(a.name + (a.menge ? " " + a.menge : "")) +
          "</span><small>" + euro(a.preis) + "</small></div>" +
          '<div class="stepper"><button class="minus" data-s-minus="' + esc(a.id) + '" aria-label="weniger">−</button>' +
          '<span class="anzahl">' + (n || "") + "</span>" +
          '<button class="plus" data-s-plus="' + esc(a.id) + '" aria-label="mehr">+</button></div></div>';
      }).join("") +
      (summe ? '<button class="gross" id="snacks-erfassen">+ ' + euro(summe / 100) + " auf die Rechnung</button>" : "") +
      "</div>";
  }

  async function snacksErfassen() {
    if (sperre) return;
    const t = CFG.TISCHE.find((x) => x.nr === tisch);
    const pos = kassenArtikel().filter((a) => (snackWahl.get(a.id) || 0) > 0)
      .map((a) => ({ id: a.id, name: a.name, menge: a.menge, preis: Number(a.preis), anzahl: snackWahl.get(a.id) }));
    if (!pos.length || !t) return;
    sperre = true;
    try {
      const neu = await DB.insert([{ gruppe: App.uuid(), ziel: "kasse", tisch: t.nr, team: t.team, kellner: kellner(),
        positionen: pos, kommentar: null, status: "erledigt" }]);
      snackWahl = new Map();
      const id = neu && neu[0] && neu[0].id;
      toast("✓ " + pos.map((p) => p.anzahl + "× " + p.name).join(", ") + " auf Tisch " + t.nr, {
        art: "ok", dauer: 10000, knopf: id ? "Rückgängig" : null,
        aktion: async () => {
          try { await DB.setStatus(id, "erledigt", "storniert"); toast("Rückgängig gemacht", { art: "ok" }); }
          catch (err) { toast("Rückgängig fehlgeschlagen – keine Verbindung", { art: "fehler" }); }
          laden();
        },
      });
    } catch (e) {
      toast("Snacks NICHT erfasst – keine Verbindung? Bitte nochmal.", { art: "fehler", dauer: 6000 });
    } finally { sperre = false; }
    await laden();
  }

  function betragLesen(text) {
    const v = Number(String(text || "").replace(/€/g, "").replace(/\s/g, "").replace(",", "."));
    return isFinite(v) && v > 0 ? cent(v) : 0;
  }

  function rueckgeldRechnen() {
    const el = $("#rueckgeld");
    if (!el) return;
    const ausw = auswahlCent(artikelStand(tisch));
    const zuZahlen = ausw || (bestelltCent(tisch) - bezahltCent(tisch));
    const gegeben = betragLesen($("#gegeben").value);
    el.textContent = gegeben
      ? (gegeben >= zuZahlen ? "Rückgeld: " + euro((gegeben - zuZahlen) / 100) : "Fehlen noch: " + euro((zuZahlen - gegeben) / 100)) +
        (ausw ? " (für die Auswahl)" : "")
      : "";
  }

  async function kassieren(positionen, betragCent) {
    if (sperre || betragCent <= 0) return;
    if (!kellner()) { toast("Bitte zuerst Kellnernamen wählen", { art: "fehler" }); return; }
    const text = positionen.map((p) => p.anzahl + "× " + posText(p)).join("\n");
    if (!confirm("Tisch " + tisch + ": " + euro(betragCent / 100) + " bar kassiert?\n\n" + text)) return;
    sperre = true;
    try {
      await DB.insertZahlung({ tisch, kellner: kellner(), betrag: betragCent / 100, positionen });
      toast("✓ " + euro(betragCent / 100) + " für Tisch " + tisch + " verbucht", { art: "ok" });
      auswahl = new Map();
    } catch (e) {
      toast("NICHT verbucht – keine Verbindung (oder Kasse in Supabase nicht aktualisiert). Bitte nochmal.", { art: "fehler", dauer: 7000 });
    } finally { sperre = false; }
    await laden();
  }

  const alsPosition = (x, anzahl) => ({ id: x.p.id, name: x.p.name, menge: x.p.menge, preis: Number(x.p.preis), anzahl });

  $("#seite-kasse").addEventListener("click", async (e) => {
    const tb = e.target.closest("[data-kasse-nr]");
    if (tb) {
      const neu = Number(tb.dataset.kasseNr);
      if (neu !== tisch) { auswahl = new Map(); snackWahl = new Map(); }
      tisch = neu; render();
      $("#kasse-inhalt").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const plus = e.target.closest("[data-k-plus]"), minus = e.target.closest("[data-k-minus]");
    if (plus || minus) {
      const k = (plus || minus).dataset[plus ? "kPlus" : "kMinus"];
      const x = artikelStand(tisch).find((y) => y.key === k);
      if (!x) return;
      const a = auswahl.get(k) || 0;
      auswahl.set(k, Math.max(0, Math.min(x.offen, a + (plus ? 1 : -1))));
      render();
      return;
    }
    const sp = e.target.closest("[data-s-plus]"), sm = e.target.closest("[data-s-minus]");
    if (sp || sm) {
      const id = (sp || sm).dataset[sp ? "sPlus" : "sMinus"];
      snackWahl.set(id, Math.max(0, Math.min(99, (snackWahl.get(id) || 0) + (sp ? 1 : -1))));
      render();
      return;
    }
    if (e.target.closest("#snacks-erfassen")) return snacksErfassen();
    if (e.target.closest("#auswahl-leeren")) { auswahl = new Map(); render(); return; }
    if (e.target.closest("#auswahl-bezahlt")) {
      const stand = artikelStand(tisch);
      const pos = stand.filter((x) => (auswahl.get(x.key) || 0) > 0).map((x) => alsPosition(x, auswahl.get(x.key)));
      return kassieren(pos, auswahlCent(stand));
    }
    if (e.target.closest("#alles-bezahlt")) {
      const stand = artikelStand(tisch);
      const pos = stand.filter((x) => x.offen > 0).map((x) => alsPosition(x, x.offen));
      return kassieren(pos, bestelltCent(tisch) - bezahltCent(tisch));
    }
    const sz = e.target.closest("[data-storno-zahlung]");
    if (sz) {
      const z = zahlungen.find((y) => y.id === Number(sz.dataset.stornoZahlung));
      if (!z || !confirm("Zahlung über " + euro(Number(z.betrag)) + " stornieren?")) return;
      try {
        const ok = await DB.stornoZahlung(z.id);
        toast(ok ? "Zahlung storniert" : "Schon storniert", { art: ok ? "ok" : "fehler" });
      } catch (err) { toast("Fehler – keine Verbindung", { art: "fehler" }); }
      laden();
    }
  });
  $("#seite-kasse").addEventListener("input", (e) => { if (e.target.id === "gegeben") rueckgeldRechnen(); });

  // Reiter-Wechsel aus kellner.js
  window.addEventListener("reiter", (e) => { aktiv = e.detail === "kasse"; if (aktiv) laden(); });
  // Aktualisieren, solange die Kasse offen ist – aber nicht, während jemand auswählt oder tippt
  const darfNeuLaden = () => aktiv && ![...auswahl.values()].some((n) => n > 0) && ![...snackWahl.values()].some((n) => n > 0)
    && !($("#gegeben") && $("#gegeben").value);
  setInterval(() => { if (darfNeuLaden()) laden(); }, 15000);
  DB.onChange(() => { if (darfNeuLaden()) laden(); });
})();
