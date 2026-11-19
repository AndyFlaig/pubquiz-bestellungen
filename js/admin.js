/* Admin-Seite: Artikel, Preise, Tische, Kellner, Reviere und Veranstaltung pflegen */
(function () {
  "use strict";
  const { CFG, DB, DEMO, $, esc, euro, toast, uhrzeit } = App;
  const verbindung = App.verbindungsAnzeige($("#verbindung"));
  const ZIELE = [["theke", "Theke (Getränk)"], ["kueche", "Küche (Speise)"], ["kasse", "Nur Strichliste"]];

  const kopie = (x) => JSON.parse(JSON.stringify(x));
  const ausCfg = () => kopie({
    VERANSTALTUNG: CFG.VERANSTALTUNG, KELLNER: CFG.KELLNER, TISCHE: CFG.TISCHE, ARTIKEL: CFG.ARTIKEL, REVIERE: CFG.REVIERE || {},
  });

  // Arbeitskopie. Kellner intern mit Revier-Text, damit Umbenennen einfach bleibt.
  // Zitate liegen getrennt (Einstellung "zitate"), stehen aber zum Bearbeiten mit in d.
  let d, original;
  let zitateGeladen = [];
  const mitZitaten = (x) => Object.assign(x, { ZITATE: kopie(zitateGeladen) });
  const ohneZitate = (x) => { const k = Object.assign({}, x); delete k.ZITATE; return JSON.stringify(k); };
  function arbeitskopie(w) {
    return {
      VERANSTALTUNG: w.VERANSTALTUNG || "",
      ARTIKEL: w.ARTIKEL.map((a) => Object.assign({}, a, { preisText: String(a.preis).replace(".", ",") })),
      TISCHE: w.TISCHE.map((t) => ({ nr: t.nr, team: t.team, eigen: !!t.eigen })),
      KELLNER: w.KELLNER.map((k) => ({ name: k, revier: revierText((w.REVIERE || {})[k] || []) })),
    };
  }

  // ---------- Reviere: [1,2,3,5] <-> "1-3, 5" ----------
  function revierText(nrs) {
    const n = [...new Set(nrs.map(Number))].filter((x) => x > 0).sort((a, b) => a - b);
    const teile = [];
    for (let i = 0; i < n.length; i++) {
      let j = i;
      while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
      teile.push(j > i + 1 ? n[i] + "-" + n[j] : j === i + 1 ? n[i] + ", " + n[j] : String(n[i]));
      i = j;
    }
    return teile.join(", ");
  }
  function revierLesen(text) {
    const out = [];
    for (const teil of String(text || "").split(/[,;\s]+/).filter(Boolean)) {
      const m = teil.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) throw new Error("„" + teil + "“ ist keine Tischnummer");
      const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
      for (let x = Math.min(a, b); x <= Math.max(a, b); x++) out.push(x);
    }
    return [...new Set(out)];
  }
  const preisLesen = (t) => {
    const v = Number(String(t).replace(/€/g, "").replace(/\s/g, "").replace(",", "."));
    return String(t).trim() !== "" && isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : NaN;
  };

  // ---------- Darstellen ----------
  function renderArtikel() {
    const kats = [...new Set(d.ARTIKEL.map((a) => a.kategorie).filter(Boolean))];
    $("#artikel-liste").innerHTML =
      '<datalist id="kategorien">' + kats.map((k) => '<option value="' + esc(k) + '">').join("") + "</datalist>" +
      d.ARTIKEL.map((a, i) => {
        const neueKat = i === 0 || d.ARTIKEL[i - 1].kategorie !== a.kategorie;
        return (neueKat ? '<h3 class="admin-kat">' + esc(a.kategorie || "(ohne Kategorie)") + "</h3>" : "") +
          '<div class="admin-zeile artikel-zeile" data-i="' + i + '">' +
            '<label class="breit">Name<input data-feld="name" value="' + esc(a.name) + '" maxlength="60"></label>' +
            '<label>Menge<input data-feld="menge" value="' + esc(a.menge || "") + '" maxlength="15" placeholder="z. B. 0,5 l"></label>' +
            '<label>Preis €<input data-feld="preisText" value="' + esc(a.preisText) + '" inputmode="decimal" maxlength="8"></label>' +
            '<label class="breit">Kategorie<input data-feld="kategorie" value="' + esc(a.kategorie) + '" list="kategorien" maxlength="40"></label>' +
            '<label>Ziel<select data-feld="ziel">' + ZIELE.map(([v, t]) =>
              '<option value="' + v + '"' + (a.ziel === v ? " selected" : "") + ">" + t + "</option>").join("") + "</select></label>" +
            '<div class="zeilen-knoepfe">' +
              '<button data-aktion="hoch" aria-label="nach oben"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
              '<button data-aktion="runter" aria-label="nach unten"' + (i === d.ARTIKEL.length - 1 ? " disabled" : "") + ">↓</button>" +
              '<button data-aktion="loeschen" class="loeschen" aria-label="löschen">🗑</button>' +
            "</div>" +
          "</div>";
      }).join("");
  }
  function renderTische() {
    $("#tische-liste").innerHTML = d.TISCHE.map((t, i) =>
      '<div class="admin-zeile tisch-zeile" data-i="' + i + '">' +
        '<label class="schmal">Nr.<input data-feld="nr" value="' + esc(t.nr) + '" inputmode="numeric" maxlength="3"></label>' +
        '<label class="breit">' + (t.eigen ? "Bereich / Person" : "Teamname") + '<input data-feld="team" value="' + esc(t.team) + '" maxlength="60"></label>' +
        '<label class="haken"><input type="checkbox" data-feld="eigen"' + (t.eigen ? " checked" : "") + "> 👤 Eigenverzehr</label>" +
        '<div class="zeilen-knoepfe"><button data-aktion="loeschen" class="loeschen" aria-label="löschen">🗑</button></div>' +
      "</div>").join("");
  }
  function renderKellner() {
    $("#kellner-liste").innerHTML = d.KELLNER.map((k, i) =>
      '<div class="admin-zeile kellner-zeile" data-i="' + i + '">' +
        '<label class="breit">Name<input data-feld="name" value="' + esc(k.name) + '" maxlength="30"></label>' +
        '<label class="breit">Revier (Tische)<input data-feld="revier" value="' + esc(k.revier) + '" placeholder="z. B. 1-5, 9" inputmode="text"></label>' +
        '<div class="zeilen-knoepfe"><button data-aktion="loeschen" class="loeschen" aria-label="löschen">🗑</button></div>' +
      "</div>").join("");
  }
  function renderZitate() {
    $("#zitate-liste").innerHTML = d.ZITATE.length ? d.ZITATE.map((z, i) =>
      '<div class="admin-zeile zitat-zeile" data-i="' + i + '">' +
        '<label class="ganz">Zitat<textarea data-feld="text" rows="2" maxlength="300" placeholder="„…“">' + esc(z.text) + "</textarea></label>" +
        '<label class="breit">Name<input data-feld="von" value="' + esc(z.von) + '" maxlength="60" placeholder="z. B. Albert Einstein"></label>' +
        '<div class="zeilen-knoepfe">' +
          '<button data-aktion="hoch" aria-label="nach oben"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
          '<button data-aktion="runter" aria-label="nach unten"' + (i === d.ZITATE.length - 1 ? " disabled" : "") + ">↓</button>" +
          '<button data-aktion="loeschen" class="loeschen" aria-label="löschen">🗑</button></div>' +
      "</div>").join("") : '<p class="klein-hinweis">Noch keine Zitate.</p>';
  }
  function renderAlles() {
    renderArtikel(); renderTische(); renderKellner(); renderZitate();
    $("#veranstaltung").value = d.VERANSTALTUNG;
    geaendert();
  }

  // ---------- Änderungen erkennen ----------
  function geaendert() {
    const dirty = JSON.stringify(d) !== JSON.stringify(original);
    $("#speichern").disabled = !dirty;
    $("#verwerfen").disabled = !dirty;
    $("#status").textContent = dirty ? "● Ungespeicherte Änderungen" : "Keine Änderungen";
    $("#status").classList.toggle("dirty", dirty);
  }
  window.addEventListener("beforeunload", (e) => {
    if (JSON.stringify(d) !== JSON.stringify(original)) { e.preventDefault(); e.returnValue = ""; }
  });

  const LISTEN = { "artikel-liste": "ARTIKEL", "tische-liste": "TISCHE", "kellner-liste": "KELLNER", "zitate-liste": "ZITATE" };
  const RENDER = { ARTIKEL: renderArtikel, TISCHE: renderTische, KELLNER: renderKellner, ZITATE: renderZitate };

  document.querySelector(".admin-inhalt").addEventListener("input", (e) => {
    const el = e.target;
    if (el.id === "veranstaltung") { d.VERANSTALTUNG = el.value; geaendert(); return; }
    const zeile = el.closest("[data-i]"), liste = el.closest(".admin-liste");
    if (!zeile || !liste || !el.dataset.feld) return;
    const obj = d[LISTEN[liste.id]][Number(zeile.dataset.i)];
    obj[el.dataset.feld] = el.type === "checkbox" ? el.checked : el.dataset.feld === "nr" ? el.value.trim() : el.value;
    if (el.dataset.feld === "eigen") { renderTische(); }
    el.classList.remove("ungueltig");
    geaendert();
  });
  // Kategorie geändert -> neu zeichnen (Gruppierung), aber erst beim Verlassen des Feldes
  document.querySelector(".admin-inhalt").addEventListener("change", (e) => {
    if (e.target.dataset && e.target.dataset.feld === "kategorie") renderArtikel();
    if (e.target.dataset && e.target.dataset.feld === "ziel") geaendert();
  });

  document.querySelector(".admin-inhalt").addEventListener("click", (e) => {
    const b = e.target.closest("[data-aktion]");
    if (b) {
      const liste = b.closest(".admin-liste"), name = LISTEN[liste.id];
      const i = Number(b.closest("[data-i]").dataset.i), arr = d[name];
      if (b.dataset.aktion === "loeschen") {
        const was = name === "ARTIKEL" ? arr[i].name : name === "TISCHE" ? "Tisch " + arr[i].nr
          : name === "ZITATE" ? (arr[i].text || "Zitat").slice(0, 40) : arr[i].name;
        if (!confirm("„" + was + "“ löschen?")) return;
        arr.splice(i, 1);
      } else {
        const j = b.dataset.aktion === "hoch" ? i - 1 : i + 1;
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        // Beim Verschieben über eine Kategoriegrenze die Kategorie des Nachbarn übernehmen
        if (name === "ARTIKEL" && arr[i].kategorie !== arr[j].kategorie) arr[j].kategorie = arr[i].kategorie;
      }
      RENDER[name](); geaendert();
      return;
    }
    const neu = e.target.closest("[data-neu]");
    if (neu) {
      const art = neu.dataset.neu;
      if (art === "artikel") {
        const letzte = d.ARTIKEL[d.ARTIKEL.length - 1];
        d.ARTIKEL.push({ id: "a" + Date.now().toString(36), kategorie: letzte ? letzte.kategorie : "Neu", name: "", menge: "",
          preis: 0, preisText: "", ziel: letzte ? letzte.ziel : "theke" });
        renderArtikel();
      } else if (art === "tisch") {
        const nr = d.TISCHE.reduce((m, t) => Math.max(m, Number(t.nr) || 0), 0) + 1;
        d.TISCHE.push({ nr: String(nr), team: "" }); renderTische();
      } else if (art === "zitat") {
        d.ZITATE.push({ text: "", von: "" }); renderZitate();
      } else {
        d.KELLNER.push({ name: "", revier: "" }); renderKellner();
      }
      geaendert();
      const seite = { tisch: "tische", zitat: "zitate" }[art] || art;
      const felder = document.querySelectorAll("#seite-" + seite + " .admin-zeile");
      const letzteZeile = felder[felder.length - 1];
      if (letzteZeile) { letzteZeile.scrollIntoView({ behavior: "smooth", block: "center" }); const f = letzteZeile.querySelector('textarea[data-feld="text"],input[data-feld="name"],input[data-feld="team"]'); f && f.focus(); }
    }
  });

  // ---------- Prüfen und speichern ----------
  function pruefen() {
    const fehler = [];
    const markiere = (liste, i, feld) => {
      const el = document.querySelector("#" + liste + ' [data-i="' + i + '"] [data-feld="' + feld + '"]');
      el && el.classList.add("ungueltig");
    };
    if (!d.ARTIKEL.length) fehler.push("Mindestens ein Artikel ist nötig.");
    const ids = new Set();
    const artikel = d.ARTIKEL.map((a, i) => {
      const preis = preisLesen(a.preisText);
      if (!a.name.trim()) { fehler.push("Artikel " + (i + 1) + ": Name fehlt."); markiere("artikel-liste", i, "name"); }
      if (!a.kategorie.trim()) { fehler.push("„" + (a.name || "Artikel " + (i + 1)) + "“: Kategorie fehlt."); markiere("artikel-liste", i, "kategorie"); }
      if (isNaN(preis)) { fehler.push("„" + (a.name || "Artikel " + (i + 1)) + "“: Preis ungültig."); markiere("artikel-liste", i, "preisText"); }
      if (ids.has(a.id)) a.id = "a" + Date.now().toString(36) + i; // Sicherheitsnetz
      ids.add(a.id);
      return { id: a.id, kategorie: a.kategorie.trim(), name: a.name.trim(), menge: (a.menge || "").trim(), preis, ziel: a.ziel };
    });
    // gleiche Artikel (Name + Menge) doppelt?
    const doppelt = new Set();
    artikel.forEach((a) => { const k = (a.name + "|" + a.menge).toLowerCase(); if (doppelt.has(k)) fehler.push("„" + a.name + " " + a.menge + "“ gibt es doppelt."); doppelt.add(k); });

    if (!d.TISCHE.length) fehler.push("Mindestens ein Tisch ist nötig.");
    const nrs = new Set();
    const tische = d.TISCHE.map((t, i) => {
      const nr = Number(t.nr);
      if (!Number.isInteger(nr) || nr < 1) { fehler.push("Tisch " + (i + 1) + ": Nummer ungültig."); markiere("tische-liste", i, "nr"); }
      else if (nrs.has(nr)) { fehler.push("Tischnummer " + nr + " gibt es doppelt."); markiere("tische-liste", i, "nr"); }
      if (!t.team.trim()) { fehler.push("Tisch " + t.nr + ": Teamname fehlt."); markiere("tische-liste", i, "team"); }
      nrs.add(nr);
      return t.eigen ? { nr, team: t.team.trim(), eigen: true } : { nr, team: t.team.trim() };
    }).sort((a, b) => a.nr - b.nr);

    if (!d.KELLNER.length) fehler.push("Mindestens ein Kellner ist nötig.");
    const namen = new Set(), reviere = {};
    const kellner = d.KELLNER.map((k, i) => {
      const name = k.name.trim();
      if (!name) { fehler.push("Kellner " + (i + 1) + ": Name fehlt."); markiere("kellner-liste", i, "name"); }
      else if (namen.has(name.toLowerCase())) { fehler.push("Kellner „" + name + "“ gibt es doppelt."); markiere("kellner-liste", i, "name"); }
      namen.add(name.toLowerCase());
      try {
        const r = revierLesen(k.revier);
        const unbekannt = r.filter((x) => !nrs.has(x));
        if (unbekannt.length) { fehler.push("Revier von " + (name || "Kellner " + (i + 1)) + ": Tisch " + unbekannt.join(", ") + " gibt es nicht."); markiere("kellner-liste", i, "revier"); }
        if (r.length) reviere[name] = r;
      } catch (err) { fehler.push("Revier von " + (name || "Kellner " + (i + 1)) + ": " + err.message + "."); markiere("kellner-liste", i, "revier"); }
      return name;
    });
    d.ZITATE.forEach((z, i) => {
      if (!z.text.trim() && z.von.trim()) { fehler.push("Zitat " + (i + 1) + ": Text fehlt."); markiere("zitate-liste", i, "text"); }
    });
    return { fehler, wert: { VERANSTALTUNG: d.VERANSTALTUNG.trim(), KELLNER: kellner, TISCHE: tische, ARTIKEL: artikel, REVIERE: reviere } };
  }

  function fehlerZeigen(liste) {
    const box = $("#fehler");
    box.hidden = !liste.length;
    box.innerHTML = liste.length ? "<b>Bitte korrigieren:</b><ul>" + liste.slice(0, 12).map((f) => "<li>" + esc(f) + "</li>").join("") +
      (liste.length > 12 ? "<li>… und " + (liste.length - 12) + " weitere</li>" : "") + "</ul>" : "";
    if (liste.length) box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function speichern(wert, meldung, zitate) {
    const knopf = $("#speichern");
    knopf.disabled = true; knopf.textContent = "Speichere…";
    try {
      let zeit = null;
      if (wert !== undefined) zeit = await DB.speichereStammdaten(wert);
      if (zitate !== undefined) { await DB.speichereEinstellung("zitate", zitate); zitateGeladen = kopie(zitate); }
      verbindung.erfolg();
      if (wert !== undefined) await App.stammdatenLaden();
      const offeneZitate = d.ZITATE;
      original = mitZitaten(arbeitskopie(ausCfg()));
      d = kopie(original);
      if (zitate === undefined && offeneZitate) d.ZITATE = offeneZitate; // ungespeicherte Zitate nicht verwerfen
      renderAlles(); quelleZeigen(zeit);
      toast(meldung || (wert !== undefined ? "✓ Gespeichert – gilt nach Neuladen auf allen Geräten" : "✓ Zitate gespeichert – erscheinen gleich auf dem Beamer"),
        { art: "ok", dauer: 5000 });
    } catch (e) {
      toast("NICHT gespeichert: " + (e.message || "keine Verbindung") +
        (/einstellungen/.test(e.message || "") ? " (update-v4.sql in Supabase ausführen)" : ""), { art: "fehler", dauer: 9000 });
      geaendert();
    } finally { knopf.textContent = "Speichern"; }
  }

  $("#speichern").onclick = () => {
    document.querySelectorAll(".ungueltig").forEach((el) => el.classList.remove("ungueltig"));
    const { fehler, wert } = pruefen();
    fehlerZeigen(fehler);
    if (fehler.length) return;
    // Hinweis bei entfernten Kellnern / Artikeln
    const stammGeaendert = ohneZitate(d) !== ohneZitate(original);
    const zitateGeaendert = JSON.stringify(d.ZITATE) !== JSON.stringify(original.ZITATE);
    const weg = CFG.KELLNER.filter((k) => !wert.KELLNER.includes(k));
    if (stammGeaendert && weg.length && !confirm("Kellner entfernt oder umbenannt: " + weg.join(", ") +
      "\n\nDiese müssen am Handy ihren Namen neu wählen. Bisherige Bestellungen und Zahlungen bleiben erhalten. Speichern?")) return;
    const zitate = d.ZITATE.map((z) => ({ text: z.text.trim(), von: z.von.trim() })).filter((z) => z.text);
    speichern(stammGeaendert ? wert : undefined, null, zitateGeaendert ? zitate : undefined);
  };
  $("#verwerfen").onclick = () => {
    if (!confirm("Alle ungespeicherten Änderungen verwerfen?")) return;
    d = kopie(original); fehlerZeigen([]); renderAlles();
  };

  // ---------- Werkzeuge ----------
  $("#json-export").onclick = () => {
    const { wert } = pruefen();
    const blob = new Blob([JSON.stringify(wert, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "pubquiz-stammdaten.json";
    document.body.appendChild(a); a.click(); a.remove();
  };
  $("#json-import").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const w = JSON.parse(await f.text());
      if (!App.stammdatenGueltig(w)) throw new Error("Datei enthält keine gültigen Stammdaten");
      d = Object.assign(arbeitskopie(w), { ZITATE: d.ZITATE }); renderAlles();
      toast("Eingelesen – bitte prüfen und speichern", { art: "ok" });
    } catch (err) { toast("Einlesen fehlgeschlagen: " + err.message, { art: "fehler", dauer: 6000 }); }
  };
  $("#zuruecksetzen").onclick = () => {
    if (!confirm("Alle Admin-Änderungen verwerfen und wieder die Werte aus config.js verwenden?")) return;
    speichern(null, "✓ Zurückgesetzt – es gilt wieder config.js");
  };

  $("#durchsage").onclick = () => App.durchsageDialog("Orga");

  // ---------- Reiter ----------
  document.querySelectorAll(".admin-reiter button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".admin-reiter button").forEach((x) => x.classList.toggle("aktiv", x === b));
      ["artikel", "tische", "kellner", "zitate", "allgemein"].forEach((s) => { $("#seite-" + s).hidden = b.dataset.seite !== s; });
      window.scrollTo(0, 0);
    };
  });

  function quelleZeigen(zeit) {
    const v = zeit || App.stammVersion;
    $("#quelle").textContent = "Aktuell gilt: " + App.stammQuelle +
      (App.stammQuelle === "Datenbank" && v ? " (gespeichert " + new Date(v).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) + ")" : "") +
      " · " + CFG.ARTIKEL.length + " Artikel, " + CFG.TISCHE.length + " Tische, " + CFG.KELLNER.length + " Kellner";
  }

  (async function start() {
    await App.pinPruefen("admin");
    if (DEMO) $("#demo-hinweis").hidden = false;
    if (!(CFG.PIN && CFG.PIN.admin)) $("#pin-warnung").hidden = false;
    try { zitateGeladen = (await DB.ladeEinstellung("zitate")) || []; } catch (e) { zitateGeladen = []; }
    if (!Array.isArray(zitateGeladen)) zitateGeladen = [];
    original = mitZitaten(arbeitskopie(ausCfg())); d = kopie(original);
    renderAlles(); quelleZeigen();
    verbindung.live(true);
    if (App.stammQuelle === "Kopie auf dem Gerät") {
      toast("Datenbank nicht erreichbar oder noch nicht eingerichtet (update-v4.sql) – Speichern wird nicht klappen.", { art: "fehler", dauer: 8000 });
    }
  })();
})();
