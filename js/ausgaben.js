/* Auswertung → Reiter "Ausgaben": Ausgaben erfassen und Gesamtübersicht (Einnahmen − Ausgaben) */
(function () {
  "use strict";
  const { DB, $, esc, euro, toast, cent } = App;

  const KATEGORIEN = ["🍺 Getränkeeinkauf", "🥨 Lebensmittel", "🏆 Preise / Gewinne", "🎈 Deko / Material", "🏠 Raum / Miete", "📄 Gebühren", "📦 Sonstiges"];
  let ausgaben = [];        // [{ id, bezeichnung, kategorie, betrag, von, notiz, erstellt_am }]
  let bearbeiten = null;    // id der Ausgabe, die gerade bearbeitet wird
  let speichert = false;

  $("#a-kategorie").innerHTML = KATEGORIEN.map((k) => "<option>" + esc(k) + "</option>").join("");

  const betragLesen = (t) => {
    const v = Number(String(t || "").replace(/€/g, "").replace(/\s/g, "").replace(",", "."));
    return isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : NaN;
  };
  const summeCent = (l) => l.reduce((s, a) => s + cent(a.betrag), 0);

  async function laden() {
    try {
      const w = await DB.ladeEinstellung("ausgaben");
      ausgaben = Array.isArray(w) ? w : [];
    } catch (e) { /* bleibt */ }
    render();
  }

  // Speichern mit frischem Stand aus der Datenbank, damit zwei Geräte sich nicht überschreiben
  async function aendern(fn) {
    if (speichert) return false;
    speichert = true;
    try {
      let aktuell = [];
      try { const w = await DB.ladeEinstellung("ausgaben"); aktuell = Array.isArray(w) ? w : []; } catch (e) { aktuell = ausgaben.slice(); }
      const neu = fn(aktuell);
      await DB.speichereEinstellung("ausgaben", neu);
      ausgaben = neu;
      render();
      return true;
    } catch (e) {
      toast("Nicht gespeichert – keine Verbindung (oder update-v4.sql fehlt)", { art: "fehler", dauer: 6000 });
      return false;
    } finally { speichert = false; }
  }

  function render() {
    // Liste
    const liste = ausgaben.slice().sort((a, b) => (b.erstellt_am || "").localeCompare(a.erstellt_am || ""));
    $("#ausgaben-liste").innerHTML = liste.length
      ? '<table class="tabelle ausgaben-tabelle">' + liste.map((a) =>
          "<tr><td><b>" + esc(a.bezeichnung) + "</b><br><small>" + esc(a.kategorie) + (a.von ? " · bezahlt von " + esc(a.von) : "") +
            (a.notiz ? " · " + esc(a.notiz) : "") + "</small></td>" +
          "<td class='zahl'><b>" + euro(Number(a.betrag)) + "</b></td>" +
          '<td class="zahl aktionen"><button data-bearb="' + esc(a.id) + '" title="bearbeiten">✎</button>' +
          '<button data-loesch="' + esc(a.id) + '" title="löschen">🗑</button></td></tr>').join("") +
        "<tr class='summe-zeile'><td>Summe Ausgaben</td><td class='zahl'>" + euro(summeCent(ausgaben) / 100) + "</td><td></td></tr></table>"
      : '<p class="klein-hinweis">Noch keine Ausgaben erfasst.</p>';
    // Vorschläge für "bezahlt von"
    $("#a-personen").innerHTML = [...new Set(ausgaben.map((a) => a.von).filter(Boolean))].map((v) => '<option value="' + esc(v) + '">').join("");
    abschluss();
  }

  // Gesamtübersicht
  function abschluss() {
    const e = App.einnahmen;
    const ausgCent = summeCent(ausgaben);
    const proKat = KATEGORIEN.map((k) => [k, summeCent(ausgaben.filter((a) => a.kategorie === k))]).filter(([, c]) => c);
    ausgaben.filter((a) => !KATEGORIEN.includes(a.kategorie)).forEach((a) => proKat.push([a.kategorie || "Sonstiges", cent(a.betrag)]));
    const proPerson = new Map();
    ausgaben.forEach((a) => { const k = a.von || "(ohne Angabe)"; proPerson.set(k, (proPerson.get(k) || 0) + cent(a.betrag)); });

    if (!e) { $("#abschluss").innerHTML = '<p class="klein-hinweis">Lade Einnahmen …</p>'; return; }
    const einGes = e.waren + e.startSoll + e.trinkgeld;
    const kassiert = e.bezahlt + e.trinkgeld;
    const ergebnis = einGes - ausgCent, ergebnisBar = kassiert - ausgCent;
    const zeile = (t, c, kl) => '<tr class="' + (kl || "") + '"><td>' + t + "</td><td class='zahl'>" + euro(c / 100) + "</td></tr>";
    $("#abschluss").innerHTML = "<h2>📒 Gesamtübersicht</h2>" +
      '<table class="tabelle abschluss-tabelle">' +
        '<tr class="abschnitt"><td colspan="2">Einnahmen</td></tr>' +
        zeile("Getränke, Speisen, Snacks", e.waren) +
        zeile("🎟 Startgeld", e.startSoll) +
        zeile("💶 Trinkgeld", e.trinkgeld) +
        zeile("<b>Einnahmen gesamt</b>", einGes, "summe-zeile") +
        '<tr class="abschnitt"><td colspan="2">Ausgaben</td></tr>' +
        (proKat.length ? proKat.map(([k, c]) => zeile(esc(k), -c)).join("") : '<tr><td colspan="2" class="klein-hinweis">noch keine</td></tr>') +
        zeile("<b>Ausgaben gesamt</b>", -ausgCent, "summe-zeile") +
        zeile("<b>" + (ergebnis >= 0 ? "✅ Gewinn" : "⚠️ Verlust") + "</b>", ergebnis, "ergebnis " + (ergebnis >= 0 ? "plus" : "minus")) +
      "</table>" +
      (e.mitKasse ? '<p class="klein-hinweis">Davon schon bar kassiert: <b>' + euro(kassiert / 100) + "</b> · noch offen: <b>" +
        euro((e.waren + e.startSoll - e.bezahlt) / 100) + "</b> · Ergebnis nach Kassenstand: <b>" + euro(ergebnisBar / 100) + "</b></p>" : "") +
      (e.eigen ? '<p class="klein-hinweis">👤 Eigenverzehr (Warenwert, nicht in den Einnahmen): ' + euro(e.eigen / 100) + "</p>" : "") +
      (proPerson.size ? "<h3>💳 Ausgelegt von (zur Erstattung)</h3><table class='tabelle'>" +
        [...proPerson.entries()].sort((a, b) => b[1] - a[1]).map(([p, c]) => zeile(esc(p), c)).join("") + "</table>" : "");
  }
  window.addEventListener("einnahmen", abschluss);

  // Formular
  function formularLeeren() {
    bearbeiten = null;
    $("#ausgabe-form").reset();
    $("#ausgabe-titel").textContent = "➕ Ausgabe erfassen";
    $("#a-speichern").textContent = "Ausgabe speichern";
    $("#a-abbrechen").hidden = true;
  }
  $("#a-abbrechen").onclick = formularLeeren;
  $("#ausgabe-form").onsubmit = async (e) => {
    e.preventDefault();
    const bezeichnung = $("#a-bezeichnung").value.trim();
    const betrag = betragLesen($("#a-betrag").value);
    if (!bezeichnung) { toast("Bitte angeben, wofür", { art: "fehler" }); return; }
    if (isNaN(betrag)) { toast("Bitte einen gültigen Betrag eingeben", { art: "fehler" }); $("#a-betrag").focus(); return; }
    const daten = { bezeichnung, betrag, kategorie: $("#a-kategorie").value, von: $("#a-von").value.trim(), notiz: $("#a-notiz").value.trim() };
    const id = bearbeiten;
    const ok = await aendern((l) => id
      ? l.map((a) => a.id === id ? Object.assign({}, a, daten) : a)
      : l.concat([Object.assign({ id: "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), erstellt_am: new Date().toISOString() }, daten)]));
    if (ok) { toast(id ? "✓ Ausgabe geändert" : "✓ Ausgabe gespeichert: " + euro(betrag), { art: "ok" }); formularLeeren(); }
  };
  $("#ausgaben-liste").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-bearb]"), l = e.target.closest("[data-loesch]");
    if (b) {
      const a = ausgaben.find((x) => x.id === b.dataset.bearb);
      if (!a) return;
      bearbeiten = a.id;
      $("#a-bezeichnung").value = a.bezeichnung; $("#a-betrag").value = String(a.betrag).replace(".", ",");
      $("#a-kategorie").value = KATEGORIEN.includes(a.kategorie) ? a.kategorie : KATEGORIEN[KATEGORIEN.length - 1];
      $("#a-von").value = a.von || ""; $("#a-notiz").value = a.notiz || "";
      $("#ausgabe-titel").textContent = "✎ Ausgabe ändern";
      $("#a-speichern").textContent = "Änderung speichern";
      $("#a-abbrechen").hidden = false;
      $("#ausgabe-form").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (l) {
      const a = ausgaben.find((x) => x.id === l.dataset.loesch);
      if (!a || !confirm("Ausgabe „" + a.bezeichnung + "“ (" + euro(Number(a.betrag)) + ") löschen?")) return;
      if (await aendern((liste) => liste.filter((x) => x.id !== a.id))) toast("Ausgabe gelöscht", { art: "ok" });
    }
  });

  laden();
  setInterval(() => { if (!bearbeiten && !speichert) laden(); }, 30000);
})();
