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
  let gezeichneterTisch = null;
  let snackWahl = new Map();   // Artikel-id -> Anzahl, die jetzt auf die Rechnung kommt
  // Artikel, die nur erfasst werden (z. B. Snacks auf dem Tisch) – können direkt in der Kasse dazukommen
  const kassenArtikel = () => CFG.ARTIKEL.filter((a) => a.ziel === "kasse");

  // ---------- Startgeld pro Tisch, auf die Personen am Tisch verteilt ----------
  const START_ID = "startgeld";
  let personen = {};  // Tisch -> Anzahl Personen (geteilt über die Einstellung "personen")
  const personenVon = (nr) => Math.max(1, Number(personen[nr]) || 1);
  const startgeldCent = (nr) => {
    const t = CFG.TISCHE.find((x) => x.nr === nr);
    return t && !t.eigen ? cent(CFG.STARTGELD || 0) : 0;
  };
  // Zahlungen ohne Startgeld-Positionen (für die normale Artikelrechnung)
  const ohneStart = (zs) => zs.map((z) => Object.assign({}, z, { positionen: (z.positionen || []).filter((p) => p.id !== START_ID) }));
  function startStand(nr) {
    const gesamt = startgeldCent(nr);
    if (!gesamt) return null;
    let bezCent = 0, bezAnteile = 0;
    zahlungen.filter((z) => z.tisch === nr && Array.isArray(z.positionen)).forEach((z) => z.positionen.forEach((p) => {
      if (p.id === START_ID) { bezCent += cent(p.preis) * (p.anzahl || 1); bezAnteile += p.anteile || p.anzahl || 1; }
    }));
    const n = personenVon(nr);
    const restCent = Math.max(0, gesamt - bezCent);
    let restAnteile = restCent > 0 ? Math.max(1, n - bezAnteile) : 0;
    return { gesamt, bezCent, restCent, n, bezAnteile, restAnteile };
  }
  // Betrag für k Anteile vom offenen Rest – der letzte Anteil nimmt den Rundungsrest, Summe ist immer exakt
  const anteilCent = (s, k) => !k ? 0 : k >= s.restAnteile ? s.restCent : Math.round(s.restCent * k / s.restAnteile);

  const bestelltCent = (nr) => zusammenfassen(rows.filter((r) => r.tisch === nr)).reduce((s, p) => s + p.cent, 0) + startgeldCent(nr);
  const bezahltCent = (nr) => zahlungen.filter((z) => z.tisch === nr).reduce((s, z) => s + cent(z.betrag), 0);

  // Pro Artikel: bestellt, bezahlt, offen (Startgeld als erste Zeile)
  function artikelStand(nr) {
    const best = zusammenfassen(rows.filter((r) => r.tisch === nr));
    const bez = new Map(zusammenfassen(ohneStart(zahlungen.filter((z) => z.tisch === nr && Array.isArray(z.positionen)))).map((p) => [key(p), p.anzahl]));
    const liste = best.map((p) => ({ p, key: key(p), bestellt: p.anzahl, bezahlt: bez.get(key(p)) || 0 }));
    // bezahlt, aber (nach Storno) nicht mehr bestellt
    bez.forEach((n, k) => { if (!liste.some((x) => x.key === k)) {
      const z = zusammenfassen(zahlungen.filter((zz) => zz.tisch === nr && Array.isArray(zz.positionen))).find((q) => key(q) === k);
      liste.push({ p: z, key: k, bestellt: 0, bezahlt: n });
    } });
    liste.forEach((x) => { x.offen = x.bestellt - x.bezahlt; });
    const s = startStand(nr);
    if (s) {
      liste.unshift({ start: s, key: START_ID, bestellt: s.n, bezahlt: s.bezAnteile, offen: s.restAnteile,
        p: { id: START_ID, name: "🎟 Startgeld", menge: "", preis: s.gesamt / 100 } });
    }
    return liste;
  }

  async function laden() {
    if (laedt) return;
    laedt = true;
    try {
      rows = (await DB.listAll()).filter((r) => !App.istEigen(r)); // Eigenverzehr wird nicht kassiert
      try { personen = (await DB.ladeEinstellung("personen")) || {}; } catch (e) { /* bleibt */ }
      try { zahlungen = await DB.listZahlungen(); fehlerKasse = false; }
      catch (e) { fehlerKasse = true; zahlungen = []; }
      render();
    } catch (e) {
      $("#kasse-inhalt").innerHTML = '<p class="fehler">Keine Verbindung – bitte gleich nochmal versuchen.</p>';
    } finally { laedt = false; }
  }

  function auswahlCent(stand) {
    return stand.reduce((s, x) => s + (x.start ? anteilCent(x.start, auswahl.get(x.key) || 0) : (auswahl.get(x.key) || 0) * cent(x.p.preis)), 0);
  }

  function render() {
    // Kassenstand = Waren + Trinkgeld (beides liegt im Portemonnaie)
    const meins = zahlungen.filter((z) => z.kellner === kellner()).reduce((s, z) => s + cent(z.betrag) + cent(z.trinkgeld || 0), 0);
    $("#kassenstand").innerHTML = "Dein Kassenstand (" + esc(kellner()) + "): <b>" + euro(meins / 100) + "</b>";

    if (fehlerKasse) {
      $("#kasse-raster").innerHTML = "";
      $("#kasse-inhalt").innerHTML = '<p class="fehler">Die Kasse ist in Supabase noch nicht eingerichtet ' +
        "(supabase/update-kasse.sql ausführen). Bis dahin bitte die Papier-Strichliste verwenden.</p>";
      return;
    }

    $("#kasse-raster").innerHTML = CFG.TISCHE.filter((t) => !t.eigen).map((t) => {
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

    // Eingetippte Werte (Gegeben/Trinkgeld) beim Neuzeichnen behalten, solange derselbe Tisch offen ist
    const behalten = gezeichneterTisch === tisch
      ? { gegeben: $("#gegeben") ? $("#gegeben").value : "", trinkgeld: $("#trinkgeld") ? $("#trinkgeld").value : "" }
      : { gegeben: "", trinkgeld: "" };
    gezeichneterTisch = tisch;
    $("#kasse-inhalt").innerHTML =
      '<article class="karte kasse-karte">' +
        '<header><div class="tisch">Tisch ' + t.nr + '</div><div class="team">' + esc(t.team) + "</div></header>" +
        snackBox() +
        (stand.length ? '<p class="klein-hinweis">Was zahlt der Gast? Artikel mit <b>+</b> auswählen.</p>' +
          '<div class="kasse-artikel">' + stand.map((x) => {
            const a = auswahl.get(x.key) || 0;
            if (x.start) return startZeile(x, a);
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
          ? '<div class="teilbetrag"><label>Gegeben (für Rückgeld)<input id="gegeben" type="text" inputmode="decimal" placeholder="z. B. 50"></label></div>' +
            '<div class="teilbetrag trinkgeld-box"><label>💶 Trinkgeld (optional)<input id="trinkgeld" type="text" inputmode="decimal" placeholder="0,00"></label>' +
              '<div class="trinkgeld-knoepfe"><button type="button" data-tg="stimmt">„Stimmt so“</button>' +
              '<button type="button" data-tg="runden">Aufrunden auf 5 €</button>' +
              '<button type="button" data-tg="null">Kein Trinkgeld</button></div></div>' +
            '<p id="rueckgeld" class="rueckgeld"></p>' +
            (ausw ? '<div class="auswahl-box"><div class="auswahl-summe">Auswahl: <b>' + euro(ausw / 100) + "</b></div>" +
                '<button class="gross primaer" id="auswahl-bezahlt">Auswahl kassieren – ' + euro(ausw / 100) + "</button>" +
                '<button class="link" id="auswahl-leeren">Auswahl leeren</button></div>'
              : "") +
            '<button class="gross' + (ausw ? "" : " primaer") + '" id="alles-bezahlt">✓ Alles bezahlt – ' + euro(rest / 100) + "</button>"
          : best > 0 && rest === 0 ? '<p class="zahl-status ok gross-status">✓ Tisch ist komplett bezahlt</p>'
          : rest < 0 ? '<p class="zahl-status zuviel">Zu viel kassiert (z. B. nach Storno) – Zahlung unten stornieren und neu kassieren.</p>' : "") +
        (zl.length ? "<h4>Zahlungen</h4><ul class='zahlungen'>" + zl.map((z) =>
          "<li><div><span>" + uhrzeit(z.erstellt_am) + " · " + esc(z.kellner) + "</span>" +
          (Array.isArray(z.positionen) && z.positionen.length
            ? "<small>" + esc(z.positionen.map((p) => p.anzahl + "× " + posText(p)).join(", ")) + "</small>" : "") + "</div>" +
          "<b>" + euro(Number(z.betrag)) + (Number(z.trinkgeld) ? '<small class="tg-klein"> + ' + euro(Number(z.trinkgeld)) + " TG</small>" : "") + "</b>" +
          (z.kellner === kellner() ? '<button class="link warnung" data-storno-zahlung="' + z.id + '">stornieren</button>' : "") +
          "</li>").join("") + "</ul>" : "") +
      "</article>";
    if ($("#gegeben")) $("#gegeben").value = behalten.gegeben;
    if ($("#trinkgeld")) $("#trinkgeld").value = behalten.trinkgeld;
    rueckgeldRechnen();
  }

  // Startgeld-Zeile: Personen am Tisch einstellen, Anteile auswählen
  function startZeile(x, a) {
    const s = x.start;
    const proKopf = s.restAnteile ? anteilCent(s, 1) : 0;
    return '<div class="kasse-zeile start-zeile' + (s.restCent ? "" : " fertig") + (a ? " gewaehlt" : "") + '">' +
      '<div class="kasse-name"><span>🎟 Startgeld <small>' + euro(s.gesamt / 100) + "</small></span>" +
      "<small>" + (s.restCent
        ? "<b>" + euro(s.restCent / 100) + " offen</b> · " + s.restAnteile + (s.restAnteile === 1 ? " Anteil" : " Anteile") + " à ca. " + euro(proKopf / 100)
        : "✓ bezahlt") + "</small>" +
      '<div class="personen-wahl">👥 Personen am Tisch: <button data-pers="-" aria-label="weniger">−</button><b>' + s.n +
        '</b><button data-pers="+" aria-label="mehr">+</button></div></div>' +
      (s.restCent ? '<div class="anteil-wahl"><span>Anteile zahlen' + (a ? " (" + euro(anteilCent(s, a) / 100) + ")" : "") + ':</span><div class="stepper">' +
        '<button class="minus" data-k-minus="' + START_ID + '" aria-label="weniger">−</button>' +
        '<span class="anzahl">' + (a || "") + "</span>" +
        '<button class="plus" data-k-plus="' + START_ID + '" aria-label="mehr">+</button></div></div>' : "") +
      "</div>";
  }
  let personenTimer = null;
  function personenAendern(delta) {
    const n = Math.max(1, Math.min(30, personenVon(tisch) + delta));
    personen[tisch] = n;
    auswahl.delete(START_ID);
    render();
    clearTimeout(personenTimer);
    personenTimer = setTimeout(async () => {
      try {
        const aktuell = (await DB.ladeEinstellung("personen")) || {};
        aktuell[tisch] = n;
        await DB.speichereEinstellung("personen", aktuell);
        personen = aktuell;
      } catch (e) { toast("Personenzahl nicht gespeichert – keine Verbindung", { art: "fehler" }); }
    }, 600);
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

  // Verständlicher Fehlergrund (Supabase-Meldung mit Hinweis)
  function grund(e) {
    const m = (e && e.message) || "";
    if (/row-level security|violates check constraint|ziel_check/i.test(m))
      return "Datenbank lässt es nicht zu – bitte supabase/update-snacks.sql in Supabase ausführen. (" + m + ")";
    if (/trinkgeld/i.test(m))
      return "Datenbank kennt noch kein Trinkgeld – bitte supabase/update-v7.sql ausführen (oder ohne Trinkgeld kassieren). (" + m + ")";
    if (/column .*positionen|schema cache/i.test(m))
      return "Datenbank veraltet – bitte supabase/update-v3.sql ausführen. (" + m + ")";
    if (/fetch|network|Failed/i.test(m) || !m) return "keine Verbindung – bitte nochmal.";
    return m;
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
      toast("Snacks NICHT erfasst: " + grund(e), { art: "fehler", bleibt: true });
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
    const tg = betragLesen($("#trinkgeld") ? $("#trinkgeld").value : "");
    const gesamt = zuZahlen + tg;
    el.textContent = (tg ? "Zu zahlen: " + euro(zuZahlen / 100) + " + " + euro(tg / 100) + " Trinkgeld = " + euro(gesamt / 100) + ". " : "") +
      (gegeben
        ? (gegeben >= gesamt ? "Rückgeld: " + euro((gegeben - gesamt) / 100) : "Fehlen noch: " + euro((gesamt - gegeben) / 100)) +
          (ausw ? " (für die Auswahl)" : "")
        : "");
  }

  // Trinkgeld-Schnellknöpfe
  function trinkgeldSetzen(art) {
    const ausw = auswahlCent(artikelStand(tisch));
    const zuZahlen = ausw || (bestelltCent(tisch) - bezahltCent(tisch));
    const gegeben = betragLesen($("#gegeben").value);
    let tg = 0;
    if (art === "stimmt") {
      if (!gegeben) { toast("Erst „Gegeben“ eintragen", { art: "fehler" }); $("#gegeben").focus(); return; }
      tg = Math.max(0, gegeben - zuZahlen);
    } else if (art === "runden") {
      tg = Math.ceil(zuZahlen / 500) * 500 - zuZahlen;
      if (!tg) tg = 0;
    }
    $("#trinkgeld").value = tg ? (tg / 100).toFixed(2).replace(".", ",") : "";
    rueckgeldRechnen();
  }

  async function kassieren(positionen, betragCent) {
    if (sperre || betragCent <= 0) return;
    if (!kellner()) { toast("Bitte zuerst Kellnernamen wählen", { art: "fehler" }); return; }
    const tg = betragLesen($("#trinkgeld") ? $("#trinkgeld").value : "");
    if (tg > 10000 && !confirm("Trinkgeld " + euro(tg / 100) + " – wirklich so viel?")) return;
    const text = positionen.map((p) => p.anzahl + "× " + posText(p)).join("\n");
    if (!confirm("Tisch " + tisch + ": " + euro((betragCent + tg) / 100) + " bar kassiert?" +
      (tg ? "\n(" + euro(betragCent / 100) + " + " + euro(tg / 100) + " Trinkgeld)" : "") + "\n\n" + text)) return;
    sperre = true;
    try {
      const zahlung = { tisch, kellner: kellner(), betrag: betragCent / 100, positionen };
      if (tg) zahlung.trinkgeld = tg / 100; // nur mitschicken, wenn vorhanden
      await DB.insertZahlung(zahlung);
      toast("✓ " + euro(betragCent / 100) + (tg ? " + " + euro(tg / 100) + " Trinkgeld" : "") + " für Tisch " + tisch + " verbucht", { art: "ok" });
      auswahl = new Map();
      gezeichneterTisch = null; // Gegeben/Trinkgeld leeren
    } catch (e) {
      toast("NICHT verbucht: " + grund(e), { art: "fehler", bleibt: true });
    } finally { sperre = false; }
    await laden();
  }

  const alsPosition = (x, anzahl) => x.start
    ? { id: START_ID, name: "Startgeld", menge: anzahl + (anzahl === 1 ? " Anteil" : " Anteile"),
        preis: anteilCent(x.start, anzahl) / 100, anzahl: 1, anteile: anzahl }
    : { id: x.p.id, name: x.p.name, menge: x.p.menge, preis: Number(x.p.preis), anzahl };

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
    const pers = e.target.closest("[data-pers]");
    if (pers) { personenAendern(pers.dataset.pers === "+" ? 1 : -1); return; }
    const tgk = e.target.closest("[data-tg]");
    if (tgk) { trinkgeldSetzen(tgk.dataset.tg); return; }
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
  $("#seite-kasse").addEventListener("input", (e) => { if (e.target.id === "gegeben" || e.target.id === "trinkgeld") rueckgeldRechnen(); });

  // Reiter-Wechsel aus kellner.js
  window.addEventListener("reiter", (e) => { aktiv = e.detail === "kasse"; if (aktiv) laden(); });
  // Aktualisieren, solange die Kasse offen ist – aber nicht, während jemand auswählt oder tippt
  const darfNeuLaden = () => aktiv && ![...auswahl.values()].some((n) => n > 0) && ![...snackWahl.values()].some((n) => n > 0)
    && !($("#gegeben") && $("#gegeben").value) && !($("#trinkgeld") && $("#trinkgeld").value);
  setInterval(() => { if (darfNeuLaden()) laden(); }, 15000);
  DB.onChange(() => { if (darfNeuLaden()) laden(); });
})();
