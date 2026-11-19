/* Beamer: Bier-Barometer und "Durstigstes Team" – nur Anzeige, ändert nichts */
(function () {
  "use strict";
  const { CFG, DB, $, esc } = App;

  const IST_BIER = /pils|weizen|weiß?bier|bier|radler|helles|export|lager/i;
  // "0,5 l" -> 0.5 ; "0,33 l" -> 0.33 ; "300 ml" -> 0.3
  function liter(menge) {
    const m = String(menge || "").replace(",", ".").match(/([\d.]+)\s*(ml|cl|l)\b/i);
    if (!m) return 0;
    const v = Number(m[1]);
    return m[2].toLowerCase() === "ml" ? v / 1000 : m[2].toLowerCase() === "cl" ? v / 100 : v;
  }
  const fmt1 = (x) => x.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  let letzteLiter = null;

  // Nächstes Ziel: unter 20 l in 10er-, bis 100 l in 25er-, darüber in 50er-Schritten
  function schrittFuer(l) { return l < 20 ? 10 : l < 100 ? 25 : 50; }
  function zielFuer(l) {
    const schritt = schrittFuer(l);
    return Math.max(schritt, Math.ceil((l + 0.0001) / schritt) * schritt);
  }

  function render(rows) {
    const ok = rows.filter((r) => r.status !== "storniert");
    // Bier: alles, was gezapft wurde (auch Eigenverzehr)
    let bierLiter = 0, getraenke = 0, speisen = 0;
    ok.forEach((r) => r.positionen.forEach((p) => {
      if (r.ziel === "theke") {
        getraenke += p.anzahl;
        if (IST_BIER.test(p.name)) bierLiter += p.anzahl * liter(p.menge);
      } else if (r.ziel === "kueche") speisen += p.anzahl;
    }));
    bierLiter = Math.round(bierLiter * 100) / 100;

    const ziel = zielFuer(bierLiter);
    const schritt = schrittFuer(bierLiter);
    const basis = ziel - schritt;
    const anteil = Math.max(0.03, Math.min(1, (bierLiter - basis) / schritt));
    $("#fuellung").style.height = (anteil * 100) + "%";
    $("#liter").textContent = fmt1(bierLiter);
    $("#ziel").innerHTML = "Nächstes Ziel: <b>" + ziel + " Liter</b> – noch " + fmt1(Math.max(0, ziel - bierLiter)) + " l";
    $("#nebenzahlen").textContent = getraenke + " Getränke · " + speisen + " Speisen";

    // Meilenstein überschritten -> Konfetti
    if (letzteLiter !== null) {
      const alt = zielFuer(letzteLiter);
      if (bierLiter >= alt && letzteLiter < alt) feiern(alt + " Liter Bier! 🍻");
    }
    letzteLiter = bierLiter;

    // Durstigstes Team: Getränke pro Tisch (ohne Eigenverzehr)
    const proTisch = new Map();
    ok.filter((r) => r.ziel === "theke" && !App.istEigen(r)).forEach((r) => {
      const n = r.positionen.reduce((s, p) => s + p.anzahl, 0);
      proTisch.set(r.tisch, (proTisch.get(r.tisch) || 0) + n);
    });
    const name = (nr) => { const t = CFG.TISCHE.find((x) => x.nr === nr); return t ? t.team : "Tisch " + nr; };
    const liste = [...proTisch.entries()].filter(([nr]) => !(CFG.TISCHE.find((x) => x.nr === nr) || {}).eigen)
      .sort((a, b) => b[1] - a[1]).slice(0, 8);
    const platz = (i) => liste[i] ? '<div class="b-team">' + esc(name(liste[i][0])) + '</div><div class="b-anzahl">' + liste[i][1] +
      ' <small>Getränke</small></div><div class="b-tischnr">Tisch ' + liste[i][0] + "</div>" : '<div class="b-team leer">–</div>';
    $("#podest").innerHTML = liste.length
      ? '<div class="b-platz p2"><div class="b-medaille">🥈</div>' + platz(1) + '<div class="b-sockel">2</div></div>' +
        '<div class="b-platz p1"><div class="b-medaille">🥇</div>' + platz(0) + '<div class="b-sockel">1</div></div>' +
        '<div class="b-platz p3"><div class="b-medaille">🥉</div>' + platz(2) + '<div class="b-sockel">3</div></div>'
      : '<p class="b-leer">Noch keine Getränke bestellt – Prost!</p>';
    $("#weitere").innerHTML = liste.slice(3).map(([nr, n]) =>
      "<li><span>" + esc(name(nr)) + "</span><b>" + n + "</b></li>").join("");
    $("#stand").textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function feiern(text) {
    const k = $("#konfetti");
    k.innerHTML = '<div class="b-feier">' + esc(text) + "</div>" +
      Array.from({ length: 80 }, () => {
        const farben = ["#b7821a", "#e9d29b", "#006837", "#ffffff", "#ffd400"];
        return '<i style="left:' + Math.random() * 100 + "%;background:" + farben[Math.floor(Math.random() * farben.length)] +
          ";animation-delay:" + (Math.random() * 1.5).toFixed(2) + "s;animation-duration:" + (2.5 + Math.random() * 2).toFixed(2) + 's"></i>';
      }).join("");
    k.classList.add("an");
    setTimeout(() => { k.classList.remove("an"); k.innerHTML = ""; }, 7000);
  }

  let laedt = false;
  async function laden() {
    if (laedt) return;
    laedt = true;
    try { render(await DB.listAll()); } catch (e) { /* nächster Versuch */ }
    finally { laedt = false; }
  }

  function uhr() { $("#uhr").textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }

  $("#vollbild").onclick = async () => {
    try { await (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement); } catch (e) { /* egal */ }
    App.wachHalten();
  };
  document.addEventListener("fullscreenchange", () => { $("#vollbild").hidden = !!document.fullscreenElement; });

  $("#veranstaltung").textContent = CFG.VERANSTALTUNG;
  uhr(); setInterval(uhr, 10000);
  laden();
  let timer = null;
  DB.onChange(() => { clearTimeout(timer); timer = setTimeout(laden, 800); });
  setInterval(laden, 15000);
  // Testen: beamer.html#feiern zeigt das Konfetti
  if (location.hash === "#feiern") setTimeout(() => feiern("Test: 50 Liter Bier! 🍻"), 800);
})();
