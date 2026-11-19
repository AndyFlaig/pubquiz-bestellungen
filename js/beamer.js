/* Beamer: Pausen-Show mit Zwischenständen – Folien wechseln alle 10 Sekunden in Dauerschleife.
   Startet die Orga in der Auswertung eine Pause (⏸), erscheint im Wechsel ein großer Countdown.
   Nur Anzeige, ändert nichts. Optionen in der Adresse:
     beamer.html?sekunden=15   andere Anzeigedauer
     beamer.html?folie=spritz  nur diese eine Folie zeigen
     beamer.html#feiern        Konfetti testen
   Tastatur: → / Leertaste = weiter, ← = zurück, P = Pause */
(function () {
  "use strict";
  const { CFG, DB, $, esc } = App;

  const PARAM = new URLSearchParams(location.search);
  const SEKUNDEN = Math.max(5, Number(PARAM.get("sekunden")) || 10);
  const NUR_FOLIE = PARAM.get("folie");

  // ---------- Was zählt wozu (über den Artikelnamen) ----------
  const IST_BIER = /pils|weizen|weiß?bier|bier|radler|helles|export|lager/i;
  const IST_SPRITZ = /aperol|spritz|wein|prosecco|sekt|hugo|lillet/i;   // Aperol + alle Weine/Schorlen
  const IST_WASSER = /sprudel|wasser|mineral/i;
  const IST_KOFFEIN = /cola|spezi|mezzo|energy/i;

  function liter(menge) {
    const m = String(menge || "").replace(",", ".").match(/([\d.]+)\s*(ml|cl|l)\b/i);
    if (!m) return 0;
    const v = Number(m[1]), e = m[2].toLowerCase();
    return e === "ml" ? v / 1000 : e === "cl" ? v / 100 : v;
  }
  const fmt1 = (x) => x.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const team = (nr) => { const t = CFG.TISCHE.find((x) => x.nr === nr); return t ? t.team : "Tisch " + nr; };
  const istEigenTisch = (nr) => !!(CFG.TISCHE.find((x) => x.nr === nr) || {}).eigen;
  const kategorieVon = (id) => (CFG.ARTIKEL.find((a) => a.id === id) || {}).kategorie || "";

  // ---------- Daten aufbereiten ----------
  let D = null;
  function auswerten(rows) {
    const ok = rows.filter((r) => r.status !== "storniert");
    const gast = ok.filter((r) => !App.istEigen(r) && !istEigenTisch(r.tisch));

    // Summe pro Tisch (nur Gäste): bedingung(r, p) -> Wert
    function proTisch(wert) {
      const m = new Map();
      gast.forEach((r) => r.positionen.forEach((p) => {
        const w = wert(r, p);
        if (w) m.set(r.tisch, (m.get(r.tisch) || 0) + w);
      }));
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    }
    const summeAlle = (wert) => ok.reduce((s, r) => s + r.positionen.reduce((t, p) => t + (wert(r, p) || 0), 0), 0);

    const bierL = (r, p) => r.ziel === "theke" && IST_BIER.test(p.name) ? p.anzahl * liter(p.menge) : 0;
    const spritzL = (r, p) => r.ziel === "theke" && IST_SPRITZ.test(p.name) ? p.anzahl * liter(p.menge) : 0;
    const getraenk = (r, p) => r.ziel === "theke" ? p.anzahl : 0;
    const speise = (r, p) => r.ziel === "kueche" ? p.anzahl : 0;

    const zeit = (r) => r.geaendert_am && r.status === "erledigt"
      ? (new Date(r.geaendert_am) - new Date(r.erstellt_am)) / 60000 : null;
    const schnitt = (ziel) => {
      const z = ok.filter((r) => r.ziel === ziel).map(zeit).filter((x) => x !== null && x >= 0 && x < 120);
      return z.length ? z.reduce((s, x) => s + x, 0) / z.length : null;
    };
    const ersteBestellung = gast.filter((r) => r.ziel !== "kasse").sort((a, b) => a.id - b.id)[0] || null;

    const alleGetraenke = summeAlle(getraenk);
    const alkfrei = summeAlle((r, p) => r.ziel === "theke" && /alkoholfrei/i.test(kategorieVon(p.id)) ? p.anzahl : 0);

    const kellner = new Map();
    ok.filter((r) => r.ziel !== "kasse").forEach((r) => {
      const k = kellner.get(r.kellner) || new Set(); k.add(r.gruppe); kellner.set(r.kellner, k);
    });

    return {
      bierLiter: Math.round(summeAlle(bierL) * 100) / 100,
      spritzLiter: Math.round(summeAlle(spritzL) * 100) / 100,
      bierTische: proTisch(bierL),
      spritzTische: proTisch(spritzL),
      durst: proTisch(getraenk),
      hunger: proTisch(speise),
      wasser: proTisch((r, p) => r.ziel === "theke" && IST_WASSER.test(p.name) ? p.anzahl : 0),
      koffein: proTisch((r, p) => r.ziel === "theke" && IST_KOFFEIN.test(p.name) ? p.anzahl : 0),
      snacks: proTisch((r, p) => r.ziel === "kasse" ? p.anzahl : 0),
      strassburger: summeAlle((r, p) => /straßburger|strassburger/i.test(p.name) ? p.anzahl : 0),
      schwaebisch: summeAlle((r, p) => /schwäbisch|schwaebisch/i.test(p.name) ? p.anzahl : 0),
      pils: summeAlle((r, p) => r.ziel === "theke" && /pils/i.test(p.name) ? p.anzahl * liter(p.menge) : 0),
      weizen: summeAlle((r, p) => r.ziel === "theke" && /weizen/i.test(p.name) ? p.anzahl * liter(p.menge) : 0),
      kellner: [...kellner.entries()].map(([k, s]) => [k, s.size]).sort((a, b) => b[1] - a[1]),
      getraenke: alleGetraenke,
      speisen: summeAlle(speise),
      bestellungen: new Set(ok.filter((r) => r.ziel !== "kasse").map((r) => r.gruppe)).size,
      alkfreiQuote: alleGetraenke ? Math.round(alkfrei / alleGetraenke * 100) : 0,
      erste: ersteBestellung,
      schnittTheke: schnitt("theke"),
      schnittKueche: schnitt("kueche"),
    };
  }

  // ---------- Bausteine ----------
  function podest(liste, einheit, format) {
    format = format || ((x) => String(x));
    if (!liste.length) return '<p class="b-leer">Noch keine Daten – das kann sich schnell ändern!</p>';
    const platz = (i, medaille) => {
      const e = liste[i];
      return '<div class="b-platz p' + (i + 1) + '"><div class="b-medaille">' + medaille + "</div>" +
        (e ? '<div class="b-team">' + esc(team(e[0])) + '</div><div class="b-anzahl">' + format(e[1]) + " <small>" + einheit +
          '</small></div><div class="b-tischnr">Tisch ' + e[0] + "</div>" : '<div class="b-team leer">–</div>') +
        '<div class="b-sockel">' + (i + 1) + "</div></div>";
    };
    return '<div class="b-podest">' + platz(1, "🥈") + platz(0, "🥇") + platz(2, "🥉") + "</div>" +
      (liste.length > 3 ? '<ol class="b-weitere" start="4">' + liste.slice(3, 5).map((e) =>
        "<li><span>" + esc(team(e[0])) + "</span><b>" + format(e[1]) + " " + einheit + "</b></li>").join("") + "</ol>" : "");
  }

  function schrittFuer(l) { return l < 20 ? 10 : l < 100 ? 25 : 50; }
  function zielFuer(l) { const s = schrittFuer(l); return Math.max(s, Math.ceil((l + 0.0001) / s) * s); }

  function messglas(art, l) {
    const ziel = zielFuer(l), schritt = schrittFuer(l);
    const anteil = Math.max(0.03, Math.min(1, (l - (ziel - schritt)) / schritt));
    const glas = art === "bier"
      ? '<div class="b-glas"><div class="b-fuellung" data-hoehe="' + (anteil * 100) + '"><div class="b-schaum"></div>' + blasen() + '</div><div class="b-henkel"></div></div>'
      : '<div class="b-weinglas"><div class="b-kelch"><div class="b-fuellung spritz" data-hoehe="' + (anteil * 100) + '">' + blasen() +
        '</div><div class="b-orange"></div></div><div class="b-stiel"></div><div class="b-fuss"></div></div>';
    return '<div class="b-glas-zeile">' + glas + '<div class="b-zahlen"><div class="b-liter ' + art + '"><span>' + fmt1(l) +
      "</span><small> Liter</small></div>" +
      '<div class="b-ziel">Nächstes Ziel: <b>' + ziel + " Liter</b> – noch " + fmt1(Math.max(0, ziel - l)) + " l</div></div></div>";
  }
  const blasen = () => '<div class="b-blasen">' + "<i></i>".repeat(6) + "</div>";

  function duell(links, rechts) {
    const summe = links.wert + rechts.wert || 1;
    const seite = (s, rechtsSeite) => {
      const sieger = s.wert > (rechtsSeite ? links : rechts).wert;
      return '<div class="b-duell-seite' + (sieger ? " sieger" : "") + '"><div class="b-duell-emoji">' + s.emoji + (sieger ? "👑" : "") + "</div>" +
        '<div class="b-duell-name">' + esc(s.name) + '</div><div class="b-duell-wert">' + s.text + "</div></div>";
    };
    return '<div class="b-duell">' + seite(links, false) + '<div class="b-vs">VS</div>' + seite(rechts, true) + "</div>" +
      '<div class="b-duell-balken"><div style="width:' + (links.wert / summe * 100) + '%"></div></div>';
  }

  function folie(emoji, titel, untertitel, inhalt, klasse) {
    return '<section class="b-folie ' + (klasse || "") + '"><h1 class="b-folien-titel"><span>' + emoji + "</span> " + esc(titel) + "</h1>" +
      (untertitel ? '<p class="b-folien-unter">' + untertitel + "</p>" : "") + '<div class="b-folien-inhalt">' + inhalt + "</div></section>";
  }

  // ---------- Die Folien (null = wird übersprungen) ----------
  const fmtL = (x) => fmt1(x);
  const FOLIEN = [
    { id: "bier", html: (d) => folie("🍺", "Bier-Barometer", "So viel Bier ist heute schon geflossen",
      '<div class="b-zwei">' + messglas("bier", d.bierLiter) + '<div><h2 class="b-mini">🏅 Die Top-Zapfer</h2>' + podest(d.bierTische, "l", fmtL) + "</div></div>") },
    { id: "spritz", html: (d) => folie("🍹", "Spritz-O-Meter", "Aperol & Wein – die feine Gesellschaft",
      '<div class="b-zwei">' + messglas("spritz", d.spritzLiter) + '<div><h2 class="b-mini">🥂 Die Spritz-Society</h2>' + podest(d.spritzTische, "l", fmtL) + "</div></div>", "spritz-folie") },
    { id: "durst", html: (d) => d.durst.length ? folie("🏆", "Durstigstes Team", "Die meisten Getränke des Abends", podest(d.durst, "Getränke")) : null },
    { id: "hunger", html: (d) => d.hunger.length ? folie("🍽", "Hungrigster Tisch", "Hier wird nicht nur Wissen verschlungen", podest(d.hunger, "Portionen")) : null },
    { id: "wasser", html: (d) => d.wasser.length ? folie("💧", "Die Wassertrinker des Abends", "Hydriert zum Quizsieg – Sprudel sauer & süß", podest(d.wasser, "Sprudel"), "wasser-folie") : null },
    { id: "koffein", html: (d) => d.koffein.length ? folie("⚡", "Koffein-Kommando", "Hellwach bis zur letzten Frage – Cola & Spezi", podest(d.koffein, "Getränke")) : null },
    { id: "snacks", html: (d) => d.snacks.length ? folie("🥨", "Snack-Monster", "Knabbern fürs Gehirn", podest(d.snacks, "Snacks")) : null },
    { id: "wurstsalat", html: (d) => d.strassburger + d.schwaebisch > 0 ? folie("🥊", "Das Wurstsalat-Duell", "Die ewige Frage im Schwarzwald",
      duell({ emoji: "🇫🇷", name: "Straßburger", wert: d.strassburger, text: d.strassburger + " Portionen" },
            { emoji: "🦁", name: "Schwäbischer", wert: d.schwaebisch, text: d.schwaebisch + " Portionen" })) : null },
    { id: "pilsweizen", html: (d) => d.pils + d.weizen > 0 ? folie("⚔️", "Bier-Duell", "Pils oder Weizen – wer hat die Nase vorn?",
      duell({ emoji: "🍺", name: "Pils", wert: d.pils, text: fmt1(d.pils) + " Liter" },
            { emoji: "🌾", name: "Weizen", wert: d.weizen, text: fmt1(d.weizen) + " Liter" })) : null },
    { id: "kellner", html: (d) => d.kellner.length ? folie("🏃", "Kellner-Rennen", "Wer flitzt am meisten? Bestellungen pro Kellner",
      '<div class="b-rennen">' + d.kellner.map(([k, n], i) => '<div class="b-bahn"><div class="b-bahn-name">' + (i === 0 ? "🥇 " : "") + esc(k) +
        '</div><div class="b-bahn-spur"><div class="b-bahn-balken" data-breite="' + (n / d.kellner[0][1] * 100) + '"><span>' + n + "</span></div></div></div>").join("") + "</div>") : null },
    { id: "zahlen", html: (d) => folie("📊", "Der Abend in Zahlen", "",
      '<div class="b-kacheln">' +
        kachel("🥤", d.getraenke, "Getränke") + kachel("🍽", d.speisen, "Portionen Essen") + kachel("🧾", d.bestellungen, "Bestellungen") +
        kachel("🍺", fmt1(d.bierLiter) + " l", "Bier") + kachel("🍹", fmt1(d.spritzLiter) + " l", "Spritz & Wein") +
        kachel("🌱", d.alkfreiQuote + " %", "alkoholfrei") +
        (d.erste ? kachel("🐦", esc(team(d.erste.tisch)), "Early Bird – erste Bestellung um " + App.uhrzeit(d.erste.erstellt_am)) : "") +
        (d.schnittTheke !== null ? kachel("⏱", fmt1(d.schnittTheke) + " Min", "Ø bis das Getränk fertig ist") : "") +
        (d.schnittKueche !== null ? kachel("👨‍🍳", fmt1(d.schnittKueche) + " Min", "Ø bis das Essen fertig ist") : "") +
      "</div>") },
  ];
  function kachel(emoji, wert, text) {
    return '<div class="b-kachel"><div class="b-kachel-emoji">' + emoji + '</div><div class="b-kachel-wert">' + wert + '</div><div class="b-kachel-text">' + text + "</div></div>";
  }

  // ---------- Diashow ----------
  let index = -1, timer = null, pause = false, sichtbar = [];
  let letzteWarCountdown = false;

  // ---------- Pausen-Countdown ----------
  let quizPause = null; // { ende: ISO, minuten } aus der Datenbank
  const NACHLAUF = 90; // Sekunden "Weiter geht's!" nach Ablauf
  const restSek = () => quizPause ? Math.ceil((new Date(quizPause.ende) - Date.now()) / 1000) : null;
  const pauseAktiv = () => { const r = restSek(); return r !== null && r > -NACHLAUF; };
  const mmss = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

  function countdownFolie() {
    return '<section class="b-folie b-countdown"><div class="b-ring-box"><svg viewBox="0 0 100 100" class="b-ring">' +
      '<circle cx="50" cy="50" r="45" class="b-ring-hinten"></circle><circle cx="50" cy="50" r="45" class="b-ring-vorne" id="cd-ring"></circle></svg>' +
      '<div class="b-ring-innen"><div class="b-cd-titel" id="cd-titel">⏸ Pause</div><div class="b-cd-zeit" id="cd-zeit">–</div>' +
      '<div class="b-cd-text" id="cd-text">Zeit für ein Getränk 🍻</div></div></div></section>';
  }
  function countdownAktualisieren() {
    const badge = $("#pause-badge");
    const r = restSek();
    const aktiv = pauseAktiv();
    badge.hidden = !aktiv;
    if (aktiv) badge.textContent = r > 0 ? "⏸ " + mmss(r) : "▶ Weiter!";
    const zeit = $("#cd-zeit");
    if (!zeit) return;
    const ring = $("#cd-ring"), gesamt = (quizPause && quizPause.minuten ? quizPause.minuten * 60 : 600);
    if (r !== null && r > 0) {
      zeit.textContent = mmss(r);
      $("#cd-titel").textContent = "⏸ Pause";
      $("#cd-text").textContent = r <= 60 ? "Gleich geht's weiter – letzte Bestellungen! 🏃" : "Zeit für ein Getränk 🍻";
      ring.style.strokeDashoffset = String(283 * (1 - Math.min(1, r / gesamt)));
      document.querySelector(".b-countdown").classList.toggle("knapp", r <= 60);
    } else {
      zeit.textContent = "▶";
      $("#cd-titel").textContent = "Weiter geht's!";
      $("#cd-text").textContent = "Bitte Plätze einnehmen – das Quiz geht weiter 🎤";
      ring.style.strokeDashoffset = "283";
      document.querySelector(".b-countdown").classList.add("vorbei");
    }
  }
  setInterval(countdownAktualisieren, 1000);

  async function pauseLaden() {
    let neu = null;
    try { neu = await DB.ladeEinstellung("pause"); } catch (e) { return; }
    if (neu && !neu.ende) neu = null;
    const neueStartet = neu && (!quizPause || quizPause.ende !== neu.ende);
    quizPause = neu;
    countdownAktualisieren();
    if (neueStartet && pauseAktiv() && D) { letzteWarCountdown = false; zeige(0); } // sofort zum Countdown springen
  }

  function zeige(richtung) {
    if (!D) return;
    sichtbar = FOLIEN.filter((f) => (!NUR_FOLIE || f.id === NUR_FOLIE) && f.html(D) !== null);
    const box = $("#folien");
    if (!NUR_FOLIE && pauseAktiv() && (!letzteWarCountdown || !sichtbar.length) && richtung !== -1) {
      // Während der Pause: Countdown im Wechsel mit den Statistiken
      box.innerHTML = countdownFolie();
      letzteWarCountdown = true;
      countdownAktualisieren();
    } else {
      if (!sichtbar.length) return;
      index = (index + (richtung === 0 ? 0 : richtung || 1) + sichtbar.length) % sichtbar.length;
      if (index < 0) index = 0;
      box.innerHTML = sichtbar[index].html(D);
      letzteWarCountdown = false;
    }
    // Animationen starten (Glas füllen, Balken wachsen)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      box.querySelectorAll("[data-hoehe]").forEach((el) => { el.style.height = el.dataset.hoehe + "%"; });
      box.querySelectorAll("[data-breite]").forEach((el) => { el.style.width = Math.max(8, el.dataset.breite) + "%"; });
    }));
    $("#punkte").innerHTML = sichtbar.map((x, i) => '<i class="' + (i === index && !letzteWarCountdown ? "an" : "") + '"></i>').join("");
    const balken = $("#balken");
    balken.style.animation = "none"; void balken.offsetWidth;
    balken.style.animation = pause ? "none" : "b-laufen " + SEKUNDEN + "s linear forwards";
    clearTimeout(timer);
    if (!pause && !NUR_FOLIE) timer = setTimeout(() => zeige(1), SEKUNDEN * 1000);
  }

  // Meilensteine -> Konfetti
  let alt = null;
  function meilensteine(d) {
    if (alt) {
      const zb = zielFuer(alt.bierLiter), zs = zielFuer(alt.spritzLiter);
      if (d.bierLiter >= zb && alt.bierLiter < zb) feiern(zb + " Liter Bier! 🍻");
      else if (d.spritzLiter >= zs && alt.spritzLiter < zs) feiern(zs + " Liter Spritz! 🍹");
    }
    alt = d;
  }
  function feiern(text) {
    const k = $("#konfetti");
    const farben = ["#b7821a", "#e9d29b", "#006837", "#ffffff", "#ff7a1a", "#ffd400"];
    k.innerHTML = '<div class="b-feier">' + esc(text) + "</div>" + Array.from({ length: 90 }, () =>
      '<i style="left:' + Math.random() * 100 + "%;background:" + farben[Math.floor(Math.random() * farben.length)] +
      ";animation-delay:" + (Math.random() * 1.5).toFixed(2) + "s;animation-duration:" + (2.5 + Math.random() * 2).toFixed(2) + 's"></i>').join("");
    k.classList.add("an");
    setTimeout(() => { k.classList.remove("an"); k.innerHTML = ""; }, 7000);
  }

  let laedt = false;
  async function laden() {
    if (laedt) return;
    laedt = true;
    try {
      const d = auswerten(await DB.listAll());
      meilensteine(d);
      const erstes = !D;
      D = d;
      if (erstes) zeige(1);
    } catch (e) { /* nächster Versuch */ }
    finally { laedt = false; }
  }

  // Bedienung
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); zeige(1); }
    else if (e.key === "ArrowLeft") zeige(-1);
    else if (e.key === "p" || e.key === "P") { pause = !pause; zeige(0); }
  });
  $("#folien").addEventListener("click", () => zeige(1));
  $("#vollbild").onclick = async () => {
    try { await (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement); } catch (e) { /* egal */ }
    App.wachHalten();
  };
  // Im Vollbild die Knöpfe ausblenden; Mausbewegung zeigt sie kurz wieder
  const steuerung = document.querySelector(".b-steuerung");
  let mausTimer = null;
  document.addEventListener("fullscreenchange", () => { steuerung.classList.toggle("versteckt", !!document.fullscreenElement); });
  document.addEventListener("mousemove", () => {
    if (!document.fullscreenElement) return;
    steuerung.classList.remove("versteckt"); clearTimeout(mausTimer);
    mausTimer = setTimeout(() => steuerung.classList.add("versteckt"), 3000);
  });
  App.pauseKnopf($("#pause-knopf"), () => pauseLaden());
  // Klicks auf die Knöpfe nicht als "nächste Folie" werten
  steuerung.addEventListener("click", (e) => e.stopPropagation());

  function uhr() { $("#uhr").textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }
  $("#veranstaltung").textContent = CFG.VERANSTALTUNG;
  uhr(); setInterval(uhr, 10000);
  laden();
  let t = null;
  DB.onChange(() => { clearTimeout(t); t = setTimeout(laden, 800); });
  setInterval(laden, 15000);
  pauseLaden();
  setInterval(pauseLaden, 5000);
  if (location.hash === "#feiern") setTimeout(() => feiern("Test: 50 Liter Bier! 🍻"), 800);
})();
