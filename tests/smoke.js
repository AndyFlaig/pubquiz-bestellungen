// Automatischer Durchlauf der Kernabläufe im Demo-Modus (ohne Supabase, ohne PINs).
// Start:  node tests/smoke.js [Ordner für Screenshots]
// Startet selbst einen lokalen Server auf Port 8799 und beendet ihn wieder.
// Ergebnis: Liste ✔/✘ pro Prüfung, Exit-Code 1 bei mindestens einem Fehler.
const { chromium, devices } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const WURZEL = path.resolve(__dirname, "..");
const PORT = 8799;
const B = `http://localhost:${PORT}/`;
const SHOTS = process.argv[2] || null;
const TYPEN = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

// Kleiner statischer Server; config.js wird auf Demo-Modus umgebogen (keine Datenbank, keine PINs)
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const datei = path.join(WURZEL, p);
  if (!datei.startsWith(WURZEL) || !fs.existsSync(datei)) { res.writeHead(404); return res.end(); }
  let inhalt = fs.readFileSync(datei);
  if (p === "/config.js") {
    inhalt = inhalt.toString() + '\nwindow.APP_CONFIG.SUPABASE_URL = ""; window.APP_CONFIG.SUPABASE_KEY = ""; window.APP_CONFIG.PIN = {};\n';
  }
  res.writeHead(200, { "Content-Type": TYPEN[path.extname(datei)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(inhalt);
});

const ergebnisse = [];
function pruefe(name, ok, info) {
  ergebnisse.push({ name, ok: !!ok });
  console.log(`${ok ? "✔" : "✘"} ${name}${info ? "  (" + info + ")" : ""}`);
}
const text = async (page, sel) => ((await page.textContent(sel)) || "").replace(/\s+/g, " ").trim();
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png") }); };

(async () => {
  await new Promise((ok) => server.listen(PORT, ok));
  const browser = await chromium.launch();
  const fehler = [];
  try {
    const handy = await browser.newContext({ ...devices["iPhone 13"], acceptDownloads: true });
    const neu = async (ctx, url) => {
      const p = await ctx.newPage();
      p.on("pageerror", (e) => fehler.push(`${url}: ${e.message}`));
      p.on("dialog", (d) => d.accept());
      await p.goto(B + url);
      return p;
    };

    // Saubere Ausgangslage
    const k = await neu(handy, "kellner.html");
    await k.evaluate(() => { localStorage.clear(); localStorage.setItem("tour_kellner_gesehen", "true"); });

    const kueche = await neu(handy, "kueche.html");
    await kueche.click("#start-knopf");
    const theke = await neu(handy, "theke.html");
    await theke.click("#start-knopf");

    // 1) Kellner bestellt: 2× Pils 0,5 + 1× Wurstsalat an Tisch 7
    await k.reload();
    await k.click("text=Axel");
    await k.click('.tisch-knopf[data-nr="7"]');
    await k.click('.artikel[data-id="pils05"] .plus');
    await k.click('.artikel[data-id="pils05"] .plus');
    await k.click('.artikel[data-id="wurstsal"] .plus');
    pruefe("Kellner: Summe 17,00 €", (await text(k, "#summe")).includes("17,00"), await text(k, "#summe"));
    await k.click("#absenden");
    await k.click('[data-a="senden"]');
    await k.waitForTimeout(1200);
    await shot(k, "kellner");

    // 2) Aufteilung Küche / Theke
    await kueche.waitForTimeout(800); await theke.waitForTimeout(800);
    const kTxt = await text(kueche, "#liste"), tTxt = await text(theke, "#liste");
    pruefe("Küche: nur Wurstsalat", kTxt.includes("Wurstsalat") && !kTxt.includes("Pils"), kTxt.slice(0, 80));
    pruefe("Theke: nur Pils", tTxt.includes("Pils") && !tTxt.includes("Wurstsalat"), tTxt.slice(0, 80));
    await shot(kueche, "kueche");

    // 3) Küche erledigt → Kellner bekommt „fertig“-Hinweis
    await kueche.click(".karte .erledigt-knopf");
    await k.waitForTimeout(1500);
    pruefe("Kellner: Hinweis Essen fertig", (await k.$$(".toast.fertig")).length > 0, await text(k, "#toasts"));

    // 4) Storno des offenen Theken-Teils
    await k.click('[data-seite="offen"]');
    await k.waitForTimeout(300);
    await k.click(".storno-knopf");
    await theke.waitForTimeout(1500);
    pruefe("Theke: stornierte Bestellung verschwunden", !(await text(theke, "#liste")).includes("Pils"));

    // 5) Auswertung und Excel-Export
    const aus = await neu(handy, "auswertung.html");
    await aus.waitForTimeout(800);
    pruefe("Auswertung: Kacheln geladen", (await text(aus, "#kacheln")).length > 0);
    const [dl] = await Promise.all([aus.waitForEvent("download", { timeout: 5000 }), aus.click("#excel")]);
    pruefe("Excel-Export lädt eine .xlsx", dl.suggestedFilename().endsWith(".xlsx"), dl.suggestedFilename());
    await shot(aus, "auswertung");

    // 6) Admin und Beamer öffnen ohne Fehler
    const admin = await neu(handy, "admin.html");
    await admin.waitForTimeout(500);
    pruefe("Admin: Artikelliste da", (await admin.$$("#artikel-liste > *")).length > 0);
    const laptop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const beamer = await neu(laptop, "beamer.html");
    await beamer.waitForTimeout(1200);
    pruefe("Beamer: Folien da", (await beamer.$$("#folien > *")).length > 0);
    await shot(beamer, "beamer");
  } catch (e) {
    pruefe("Ablauf ohne Abbruch", false, e.message.split("\n")[0]);
  } finally {
    pruefe("Keine JavaScript-Fehler", fehler.length === 0, fehler.slice(0, 3).join(" | "));
    await browser.close();
    server.close();
  }
  const kaputt = ergebnisse.filter((r) => !r.ok).length;
  console.log(`\n${ergebnisse.length - kaputt}/${ergebnisse.length} bestanden`);
  process.exit(kaputt ? 1 : 0);
})();
