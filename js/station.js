/* Küchen- und Theken-Ansicht */
(function () {
  "use strict";
  const { DB, DEMO, $, esc, uhrzeit, minutenSeit, positionText, toast } = App;

  const ZIEL = document.body.dataset.ziel; // "kueche" oder "theke"
  const liste = $("#liste");
  const zaehler = $("#zaehler");
  const verbindung = App.verbindungsAnzeige($("#verbindung"));

  let bekannt = new Map(); // id -> Zeile (alle aktuell angezeigten offenen)
  let ersteLadung = true;
  const selbstErledigt = new Set(); // ids, die auf DIESEM Gerät erledigt wurden
  let laedt = false, nochmal = false;
  const neuBis = new Map(); // id -> Zeitpunkt, bis zu dem die Karte hervorgehoben wird
  let letzteSignatur = null; // null = noch nie gezeichnet

  function karte(r) {
    const min = minutenSeit(r.erstellt_am);
    const alt = min >= 15 ? "sehr-alt" : min >= 8 ? "alt" : "";
    const neu = (neuBis.get(r.id) || 0) > Date.now() ? " neu" : "";
    return (
      '<article class="karte ' + alt + neu + '" data-id="' + r.id + '">' +
        '<header><div class="tisch">Tisch ' + esc(r.tisch) + '</div>' +
        '<div class="team">' + esc(r.team) + "</div></header>" +
        '<div class="meta">#' + r.id + " · " + esc(r.kellner) + " · " + uhrzeit(r.erstellt_am) +
        ' · <span class="alter">' + (min < 1 ? "gerade eben" : "vor " + min + " Min") + "</span></div>" +
        '<ul class="positionen">' +
          r.positionen.map((p) => '<li><b>' + esc(p.anzahl) + "×</b> " + esc(p.name) +
            (p.menge ? ' <small>' + esc(p.menge) + "</small>" : "") + "</li>").join("") +
        "</ul>" +
        (r.kommentar ? '<div class="kommentar">' + esc(r.kommentar) + "</div>" : "") +
        '<button class="erledigt-knopf" data-id="' + r.id + '">✓ Erledigt</button>' +
      "</article>"
    );
  }

  function render(erzwingen) {
    const rows = [...bekannt.values()].sort((a, b) => a.id - b.id);
    const sig = rows.map((r) => r.id).join(",");
    if (!erzwingen && sig === letzteSignatur) return; // nichts geändert -> DOM nicht anfassen
    letzteSignatur = sig;
    zaehler.textContent = rows.length + " offen";
    liste.innerHTML = rows.length
      ? rows.map(karte).join("")
      : '<p class="leer">Keine offenen Bestellungen 🎉</p>';
  }

  async function laden() {
    if (laedt) { nochmal = true; return; }
    laedt = true;
    try {
      const rows = await DB.listOpen({ ziel: ZIEL });
      verbindung.erfolg();
      const neu = new Map(rows.map((r) => [r.id, r]));
      const hinzu = rows.filter((r) => !bekannt.has(r.id));
      const weg = [...bekannt.keys()].filter((id) => !neu.has(id) && !selbstErledigt.has(id));

      // Verschwundene Bestellungen: storniert? Dann deutlich melden.
      if (!ersteLadung && weg.length) {
        try {
          const st = await DB.getByIds(weg);
          st.filter((s) => s.status === "storniert").forEach((s) => {
            const r = bekannt.get(s.id);
            App.tonStorno(); App.blinken("rot");
            toast("STORNIERT: #" + r.id + " Tisch " + r.tisch + " – " +
              r.positionen.map(positionText).join(", "), { art: "storno", bleibt: true });
          });
        } catch (e) { /* nicht schlimm */ }
      }

      if (!ersteLadung && hinzu.length) {
        App.tonNeu(); App.blinken();
        hinzu.forEach((r) => neuBis.set(r.id, Date.now() + 60000));
        const ausser = hinzu.length === 1 ? "Neue Bestellung: Tisch " + hinzu[0].tisch : hinzu.length + " neue Bestellungen";
        toast(ausser, { art: "neu", dauer: 5000 });
      }
      bekannt = neu;
      ersteLadung = false;
      render();
    } catch (e) {
      verbindung.fehler();
    } finally {
      laedt = false;
      if (nochmal) { nochmal = false; laden(); }
    }
  }

  liste.addEventListener("click", async (e) => {
    const b = e.target.closest(".erledigt-knopf");
    if (!b) return;
    const id = Number(b.dataset.id);
    const r = bekannt.get(id);
    b.disabled = true;
    selbstErledigt.add(id);
    try {
      await DB.setStatus(id, "offen", "erledigt");
      bekannt.delete(id);
      render();
      toast("Tisch " + r.tisch + " erledigt", {
        knopf: "Rückgängig", dauer: 10000,
        aktion: async () => {
          try {
            await DB.setStatus(id, "erledigt", "offen");
            selbstErledigt.delete(id);
            bekannt.set(id, r); render(true);
          } catch (err) { toast("Rückgängig fehlgeschlagen – keine Verbindung", { art: "fehler" }); }
        },
      });
    } catch (err) {
      selbstErledigt.delete(id);
      b.disabled = false;
      toast("Fehler – keine Verbindung? Bitte nochmal tippen.", { art: "fehler" });
    }
  });

  // ------------------------------------------------------------------
  // Ausverkauft-Schalter (nur Artikel dieser Station)
  // ------------------------------------------------------------------
  const MEINE_ARTIKEL = App.CFG.ARTIKEL.filter((x) => x.ziel === ZIEL);
  let ausverkauft = new Set();
  async function ausverkauftLaden() {
    try { ausverkauft = new Set(await DB.listAusverkauft()); } catch (e) { return false; }
    const n = MEINE_ARTIKEL.filter((x) => ausverkauft.has(x.id)).length;
    const k = $("#ausverkauft-knopf");
    k.innerHTML = '🚫<span class="aus-text"> Ausverkauft</span>' + (n ? " (" + n + ")" : "");
    k.classList.toggle("hat", n > 0);
    return true;
  }
  function ausverkauftDialog() {
    const ov = document.createElement("div");
    ov.className = "overlay";
    document.body.appendChild(ov);
    const zeichnen = (fehler) => {
      ov.innerHTML = '<div class="dialog"><h2>Ausverkauft?</h2>' +
        '<p class="klein-hinweis">Antippen schaltet um. Ausverkaufte Artikel können die Kellner nicht mehr bestellen.</p>' +
        (fehler ? '<p class="fehler">' + esc(fehler) + "</p>" : "") +
        '<div class="aus-liste">' + MEINE_ARTIKEL.map((x) => {
          const aus = ausverkauft.has(x.id);
          return '<button class="aus-artikel' + (aus ? " aus" : "") + '" data-aus="' + esc(x.id) + '"><span>' + esc(x.name) +
            (x.menge ? " <small>" + esc(x.menge) + "</small>" : "") + "</span><em>" + (aus ? "AUSVERKAUFT" : "verfügbar") + "</em></button>";
        }).join("") + "</div>" +
        '<button class="gross primaer" data-schliessen>Fertig</button></div>';
    };
    zeichnen();
    ausverkauftLaden().then((ok) => zeichnen(ok ? "" : "Nicht verfügbar – keine Verbindung oder Supabase noch nicht aktualisiert (update-v3.sql)."));
    ov.addEventListener("click", async (e) => {
      if (e.target.closest("[data-schliessen]") || e.target === ov) { ov.remove(); return; }
      const b = e.target.closest("[data-aus]");
      if (!b) return;
      const id = b.dataset.aus, neu = !ausverkauft.has(id);
      b.disabled = true;
      try {
        await DB.setAusverkauft(id, neu);
        if (neu) ausverkauft.add(id); else ausverkauft.delete(id);
        await ausverkauftLaden();
        zeichnen();
      } catch (err) { zeichnen("Fehler beim Speichern – keine Verbindung oder Supabase noch nicht aktualisiert (update-v3.sql)."); }
    });
  }
  $("#ausverkauft-knopf").addEventListener("click", ausverkauftDialog);

  // Home-Knopf: in Küche/Theke nur nach Rückfrage verlassen
  $(".home-knopf").addEventListener("click", (e) => {
    if (!confirm("Ansicht wirklich verlassen? Danach kommt hier kein Ton mehr, bis du wieder auf Start tippst.")) e.preventDefault();
  });

  async function start() {
    await App.pinPruefen(ZIEL);
    const ov = $("#start-overlay");
    ov.hidden = false;
    if (DEMO) $("#demo-hinweis").hidden = false;
    $("#start-knopf").onclick = async () => {
      App.audioFreischalten();
      App.tonNeu();
      const wach = await App.wachHalten();
      if (!wach) toast("Bildschirm-wach-halten nicht verfügbar: bitte automatische Sperre am Gerät ausschalten.", { art: "fehler", dauer: 8000 });
      ov.remove();
    };
    laden();
    DB.onChange(() => laden(), (live) => verbindung.live(live));
    setInterval(laden, 5000); // Sicherheitsnetz, falls Live-Verbindung abreißt
    ausverkauftLaden();
    setInterval(ausverkauftLaden, 15000);
    setInterval(() => { // "vor x Min" aktualisieren
      liste.querySelectorAll(".karte").forEach((k) => {
        const r = bekannt.get(Number(k.dataset.id));
        if (!r) return;
        const min = minutenSeit(r.erstellt_am);
        k.querySelector(".alter").textContent = min < 1 ? "gerade eben" : "vor " + min + " Min";
        k.classList.toggle("alt", min >= 8 && min < 15);
        k.classList.toggle("sehr-alt", min >= 15);
        k.classList.toggle("neu", (neuBis.get(r.id) || 0) > Date.now());
      });
    }, 30000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") laden(); });
    window.addEventListener("online", laden);
  }

  start();
})();
