/* Kellner-Ansicht */
(function () {
  "use strict";
  const { CFG, DB, DEMO, $, esc, euro, uhrzeit, minutenSeit, positionText, store, toast } = App;

  const ARTIKEL = new Map(CFG.ARTIKEL.map((a) => [a.id, a]));
  const ZIEL_NAME = { kueche: "Küche", theke: "Theke" };
  const verbindung = App.verbindungsAnzeige($("#verbindung"));

  let kellner = store.get("kellner_name", null);
  if (kellner && !CFG.KELLNER.includes(kellner)) kellner = null;

  // Entwurf (überlebt ein Neuladen der Seite)
  let entwurf = store.get("kellner_entwurf", { tisch: null, menge: {}, kommentar: "" });
  const speichern = () => store.set("kellner_entwurf", entwurf);

  // ------------------------------------------------------------------
  // Kellner wählen
  // ------------------------------------------------------------------
  function kellnerWaehlen() {
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = '<div class="dialog"><h2>Wer bist du?</h2>' +
      CFG.KELLNER.map((n) => '<button class="gross auswahl" data-name="' + esc(n) + '">' + esc(n) + "</button>").join("") +
      "</div>";
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      const b = e.target.closest("[data-name]");
      if (!b) return;
      kellner = b.dataset.name;
      store.set("kellner_name", kellner);
      ov.remove();
      $("#kellner-name").textContent = kellner;
      offeneLaden();
    });
  }

  // ------------------------------------------------------------------
  // Tische
  // ------------------------------------------------------------------
  function tischText(nr) {
    const t = CFG.TISCHE.find((x) => x.nr === nr);
    return t ? "Tisch " + t.nr + " – " + t.team : "";
  }

  function renderTische() {
    $("#tisch-raster").innerHTML = CFG.TISCHE.map((t) =>
      '<button class="tisch-knopf' + (entwurf.tisch === t.nr ? " aktiv" : "") + '" data-nr="' + t.nr + '">' +
      "<b>" + t.nr + "</b><span>" + esc(t.team) + "</span></button>").join("");
    const gewaehlt = entwurf.tisch != null;
    $("#tisch-gewaehlt").hidden = !gewaehlt;
    $("#tisch-raster").hidden = gewaehlt;
    $("#tisch-titel").hidden = gewaehlt;
    $("#tisch-gewaehlt-text").textContent = tischText(entwurf.tisch);
  }

  $("#tisch-raster").addEventListener("click", (e) => {
    const b = e.target.closest("[data-nr]");
    if (!b) return;
    entwurf.tisch = Number(b.dataset.nr);
    speichern(); renderTische(); renderSumme();
  });
  $("#tisch-aendern").onclick = () => {
    $("#tisch-raster").hidden = false; $("#tisch-titel").hidden = false; $("#tisch-gewaehlt").hidden = true;
  };

  // ------------------------------------------------------------------
  // Artikel
  // ------------------------------------------------------------------
  function renderArtikel() {
    const kategorien = [];
    CFG.ARTIKEL.forEach((a) => { if (!kategorien.includes(a.kategorie)) kategorien.push(a.kategorie); });
    $("#artikel").innerHTML = kategorien.map((k) =>
      '<section class="kategorie"><h3>' + esc(k) + "</h3>" +
      CFG.ARTIKEL.filter((a) => a.kategorie === k).map((a) =>
        '<div class="artikel" data-id="' + esc(a.id) + '">' +
          '<button class="artikel-name" data-plus="' + esc(a.id) + '">' +
            "<span>" + esc(a.name) + (a.menge ? " <small>" + esc(a.menge) + "</small>" : "") + "</span>" +
            '<small class="preis">' + euro(a.preis) + "</small></button>" +
          '<div class="stepper">' +
            '<button class="minus" data-minus="' + esc(a.id) + '" aria-label="weniger">−</button>' +
            '<span class="anzahl"></span>' +
            '<button class="plus" data-plus="' + esc(a.id) + '" aria-label="mehr">+</button>' +
          "</div></div>").join("") +
      "</section>").join("");
    renderMengen();
  }

  function renderMengen() {
    document.querySelectorAll(".artikel").forEach((el) => {
      const n = entwurf.menge[el.dataset.id] || 0;
      el.querySelector(".anzahl").textContent = n || "";
      el.classList.toggle("gewaehlt", n > 0);
    });
    renderSumme();
  }

  function positionen() {
    return Object.entries(entwurf.menge)
      .filter(([id, n]) => n > 0 && ARTIKEL.has(id))
      .map(([id, n]) => { const a = ARTIKEL.get(id); return { id, name: a.name, menge: a.menge, preis: a.preis, anzahl: n, ziel: a.ziel }; })
      .sort((x, y) => CFG.ARTIKEL.indexOf(ARTIKEL.get(x.id)) - CFG.ARTIKEL.indexOf(ARTIKEL.get(y.id)));
  }

  function renderSumme() {
    const pos = positionen();
    const stueck = pos.reduce((s, p) => s + p.anzahl, 0);
    const summe = pos.reduce((s, p) => s + p.anzahl * p.preis, 0);
    $("#summe").textContent = stueck ? stueck + " Artikel · " + euro(summe) : "Noch nichts ausgewählt";
    const knopf = $("#absenden");
    knopf.disabled = !stueck || entwurf.tisch == null;
    knopf.textContent = entwurf.tisch == null && stueck ? "Tisch wählen!" : "Absenden";
    $("#leeren").hidden = !stueck && !entwurf.kommentar;
  }

  $("#artikel").addEventListener("click", (e) => {
    const plus = e.target.closest("[data-plus]");
    const minus = e.target.closest("[data-minus]");
    if (plus) { const id = plus.dataset.plus; entwurf.menge[id] = (entwurf.menge[id] || 0) + 1; }
    else if (minus) { const id = minus.dataset.minus; entwurf.menge[id] = Math.max(0, (entwurf.menge[id] || 0) - 1); }
    else return;
    speichern(); renderMengen();
  });

  const kommentarFeld = $("#kommentar");
  kommentarFeld.value = entwurf.kommentar || "";
  kommentarFeld.addEventListener("input", () => { entwurf.kommentar = kommentarFeld.value; speichern(); renderSumme(); });

  function zuruecksetzen() {
    entwurf = { tisch: null, menge: {}, kommentar: "" };
    kommentarFeld.value = "";
    speichern(); renderTische(); renderMengen();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("#leeren").onclick = () => { if (confirm("Bestellung verwerfen?")) zuruecksetzen(); };

  // ------------------------------------------------------------------
  // Absenden mit Kontroll-Dialog
  // ------------------------------------------------------------------
  let sendet = false;
  $("#absenden").onclick = () => {
    const pos = positionen();
    if (!pos.length || entwurf.tisch == null) return;
    const teile = ["kueche", "theke"].map((z) => ({ ziel: z, pos: pos.filter((p) => p.ziel === z) })).filter((t) => t.pos.length);
    const kommentar = entwurf.kommentar.trim();

    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = '<div class="dialog"><h2>' + esc(tischText(entwurf.tisch)) + "</h2>" +
      teile.map((t) => '<h4 class="ziel-' + t.ziel + '">→ ' + ZIEL_NAME[t.ziel] + "</h4><ul>" +
        t.pos.map((p) => "<li>" + esc(positionText(p)) + "</li>").join("") + "</ul>").join("") +
      (kommentar ? '<div class="kommentar">' + esc(kommentar) + "</div>" : "") +
      '<p class="summe-dialog">Summe: ' + euro(pos.reduce((s, p) => s + p.anzahl * p.preis, 0)) + "</p>" +
      '<div class="knopf-reihe"><button class="gross" data-a="zurueck">Zurück</button>' +
      '<button class="gross primaer" data-a="senden">Senden</button></div></div>';
    document.body.appendChild(ov);

    ov.addEventListener("click", async (e) => {
      const a = e.target.closest("[data-a]");
      if (!a) return;
      if (a.dataset.a === "zurueck") { ov.remove(); return; }
      if (sendet) return;
      sendet = true; a.disabled = true; a.textContent = "Sende…";
      const t = CFG.TISCHE.find((x) => x.nr === entwurf.tisch);
      const gruppe = App.uuid();
      const rows = teile.map((teil) => ({
        gruppe, ziel: teil.ziel, tisch: t.nr, team: t.team, kellner,
        positionen: teil.pos.map(({ ziel, ...rest }) => rest),
        kommentar: kommentar || null,
      }));
      try {
        await DB.insert(rows);
        verbindung.erfolg();
        ov.remove();
        toast("✓ Gesendet: Tisch " + t.nr, { art: "ok" });
        zuruecksetzen();
        offeneLaden();
      } catch (err) {
        verbindung.fehler();
        a.disabled = false; a.textContent = "Nochmal senden";
        toast("NICHT gesendet – keine Verbindung. Bestellung bleibt erhalten, bitte nochmal senden.", { art: "fehler", dauer: 7000 });
      } finally { sendet = false; }
    });
  };

  // ------------------------------------------------------------------
  // Eigene offene Bestellungen
  // ------------------------------------------------------------------
  let offene = [];
  async function offeneLaden() {
    if (!kellner) return;
    try {
      offene = await DB.listOpen({ kellner });
      verbindung.erfolg();
      renderOffene();
    } catch (e) { verbindung.fehler(); }
  }

  function renderOffene() {
    $("#offen-zahl").textContent = offene.length ? "(" + offene.length + ")" : "";
    if (!offene.length) { $("#offen-liste").innerHTML = '<p class="leer">Keine offenen Bestellungen.</p>'; return; }
    const rows = offene.slice().sort((a, b) => b.id - a.id); // neueste oben
    $("#offen-liste").innerHTML = rows.map((r) => {
      const min = minutenSeit(r.erstellt_am);
      return '<article class="karte klein">' +
        '<header><div class="tisch">Tisch ' + esc(r.tisch) + '</div><div class="team">' + esc(r.team) + "</div>" +
        '<span class="ziel-etikett ziel-' + r.ziel + '">' + ZIEL_NAME[r.ziel] + "</span></header>" +
        '<div class="meta">#' + r.id + " · " + uhrzeit(r.erstellt_am) + " · vor " + min + " Min</div>" +
        '<ul class="positionen">' + r.positionen.map((p) => "<li>" + esc(positionText(p)) + "</li>").join("") + "</ul>" +
        (r.kommentar ? '<div class="kommentar">' + esc(r.kommentar) + "</div>" : "") +
        '<button class="storno-knopf" data-id="' + r.id + '">Stornieren</button></article>';
    }).join("");
  }

  $("#offen-liste").addEventListener("click", async (e) => {
    const b = e.target.closest(".storno-knopf");
    if (!b) return;
    const r = offene.find((x) => x.id === Number(b.dataset.id));
    if (!r || !confirm("Bestellung #" + r.id + " (Tisch " + r.tisch + ", " + ZIEL_NAME[r.ziel] + ") wirklich stornieren?")) return;
    b.disabled = true;
    try {
      const ok = await DB.setStatus(r.id, "offen", "storniert");
      toast(ok ? "Storniert." : "Geht nicht mehr – schon erledigt.", { art: ok ? "ok" : "fehler" });
    } catch (err) {
      toast("Fehler – keine Verbindung.", { art: "fehler" });
    }
    offeneLaden();
  });

  // ------------------------------------------------------------------
  // Reiter
  // ------------------------------------------------------------------
  document.querySelectorAll(".reiter button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".reiter button").forEach((x) => x.classList.toggle("aktiv", x === b));
      $("#seite-neu").hidden = b.dataset.seite !== "neu";
      $("#seite-offen").hidden = b.dataset.seite !== "offen";
      $(".fusszeile").hidden = b.dataset.seite !== "neu";
      if (b.dataset.seite === "offen") offeneLaden();
      window.scrollTo(0, 0);
    };
  });
  $("#kellner-wechseln").onclick = kellnerWaehlen;

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------
  (async function start() {
    await App.pinPruefen("kellner");
    if (DEMO) $("#demo-hinweis").hidden = false;
    renderTische(); renderArtikel();
    const setzeReiter = () => { $(".reiter").style.top = $(".kopf").offsetHeight + "px"; };
    setzeReiter(); window.addEventListener("resize", setzeReiter);
    if (kellner) $("#kellner-name").textContent = kellner; else kellnerWaehlen();
    offeneLaden();
    DB.onChange(() => offeneLaden(), (live) => verbindung.live(live));
    setInterval(offeneLaden, 15000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") offeneLaden(); });
    window.addEventListener("online", offeneLaden);
  })();
})();
