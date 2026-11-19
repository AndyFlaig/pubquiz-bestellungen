/* Gemeinsame Funktionen für alle Ansichten */
(function () {
  "use strict";

  const CFG = window.APP_CONFIG;
  const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_KEY;

  // ------------------------------------------------------------------
  // Kleine Helfer
  // ------------------------------------------------------------------
  const $ = (sel, root) => (root || document).querySelector(sel);

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  const euroFmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  const euro = (n) => euroFmt.format(n);

  function uhrzeit(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function minutenSeit(iso) {
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  const store = {
    get(k, def) {
      try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); }
      catch (e) { return def; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* egal */ } },
  };

  function positionText(p) {
    return p.anzahl + "× " + p.name + (p.menge ? " " + p.menge : "");
  }

  // ------------------------------------------------------------------
  // Datenzugriff: Supabase oder Demo (localStorage, nur ein Gerät)
  // ------------------------------------------------------------------
  function supabaseBackend() {
    const client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const T = "bestellungen";

    function check(res) {
      if (res.error) throw new Error(res.error.message || "Datenbankfehler");
      return res.data;
    }

    return {
      async listOpen(filter) {
        let q = client.from(T).select("*").eq("status", "offen").order("id", { ascending: true });
        if (filter.ziel) q = q.eq("ziel", filter.ziel);
        if (filter.kellner) q = q.eq("kellner", filter.kellner);
        return check(await q);
      },
      async getByIds(ids) {
        if (!ids.length) return [];
        return check(await client.from(T).select("id,status").in("id", ids));
      },
      // Alle nicht stornierten Bestellungen (für die Auswertung)
      async listAll() {
        return check(await client.from(T).select("*").neq("status", "storniert")
          .order("id", { ascending: true }).limit(5000));
      },
      // Letzte (nicht stornierte) Bestellung eines Tisches, alle Teile (Küche + Theke)
      async lastForTable(tisch) {
        const rows = check(await client.from(T).select("*").eq("tisch", tisch).neq("status", "storniert")
          .neq("ziel", "kasse").order("id", { ascending: false }).limit(10));
        if (!rows.length) return [];
        return rows.filter((r) => r.gruppe === rows[0].gruppe);
      },
      async insert(rows) {
        return check(await client.from(T).insert(rows).select());
      },
      // Ändert den Status nur, wenn er noch "from" ist. Gibt true zurück, wenn es geklappt hat.
      async setStatus(id, from, to) {
        const data = check(await client.from(T)
          .update({ status: to, geaendert_am: new Date().toISOString() })
          .eq("id", id).eq("status", from).select("id"));
        return data.length > 0;
      },
      onChange(cb, onState) {
        client.channel("bestellungen-live")
          .on("postgres_changes", { event: "*", schema: "public", table: T }, cb)
          .subscribe((status) => onState && onState(status === "SUBSCRIBED"));
      },
    };
  }

  function demoBackend() {
    const KEY = "pubquiz_demo_db";
    const load = () => store.get(KEY, { nextId: 1, rows: [] });
    const save = (db) => store.set(KEY, db);
    const listeners = [];
    window.addEventListener("storage", (e) => { if (e.key === KEY) listeners.forEach((f) => f()); });
    const notify = () => listeners.forEach((f) => f());

    return {
      async listOpen(filter) {
        return load().rows.filter((r) => r.status === "offen" &&
          (!filter.ziel || r.ziel === filter.ziel) &&
          (!filter.kellner || r.kellner === filter.kellner));
      },
      async getByIds(ids) {
        return load().rows.filter((r) => ids.includes(r.id)).map((r) => ({ id: r.id, status: r.status }));
      },
      async listAll() {
        return load().rows.filter((r) => r.status !== "storniert");
      },
      async lastForTable(tisch) {
        const rows = load().rows.filter((r) => r.tisch === tisch && r.status !== "storniert" && r.ziel !== "kasse").reverse();
        return rows.length ? rows.filter((r) => r.gruppe === rows[0].gruppe) : [];
      },
      async insert(rows) {
        const db = load();
        const now = new Date().toISOString();
        const out = rows.map((r) => Object.assign({ id: db.nextId++, status: "offen", erstellt_am: now }, r));
        db.rows.push(...out);
        save(db); notify();
        return out;
      },
      async setStatus(id, from, to) {
        const db = load();
        const r = db.rows.find((x) => x.id === id);
        if (!r || r.status !== from) return false;
        r.status = to; r.geaendert_am = new Date().toISOString();
        save(db); notify();
        return true;
      },
      onChange(cb, onState) { listeners.push(cb); onState && onState(true); },
    };
  }

  const DB = DEMO ? demoBackend() : supabaseBackend();

  // ------------------------------------------------------------------
  // Verbindungsanzeige
  // ------------------------------------------------------------------
  function verbindungsAnzeige(el) {
    let live = false, ok = true, letzte = null;
    function render() {
      if (!el) return;
      el.className = "verbindung " + (!ok ? "rot" : live ? "gruen" : "gelb");
      el.textContent = !ok
        ? "Keine Verbindung" + (letzte ? " – Stand " + uhrzeit(letzte) : "")
        : live ? (DEMO ? "Demo" : "Live") : "Verbinde…";
      document.body.classList.toggle("offline", !ok);
    }
    render();
    return {
      live(v) { live = v; render(); },
      erfolg() { ok = true; letzte = new Date().toISOString(); render(); },
      fehler() { ok = false; render(); },
    };
  }

  // ------------------------------------------------------------------
  // Toast-Meldungen
  // ------------------------------------------------------------------
  function toast(text, opts) {
    opts = opts || {};
    let box = $("#toasts");
    if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast " + (opts.art || "");
    t.innerHTML = "<span>" + esc(text) + "</span>";
    if (opts.knopf) {
      const b = document.createElement("button");
      b.textContent = opts.knopf;
      b.onclick = () => { t.remove(); opts.aktion && opts.aktion(); };
      t.appendChild(b);
    }
    box.appendChild(t);
    if (!opts.bleibt) setTimeout(() => t.remove(), opts.dauer || 3500);
    else t.addEventListener("click", (e) => { if (e.target === t || e.target.tagName === "SPAN") t.remove(); });
    return t;
  }

  // ------------------------------------------------------------------
  // PIN-Abfrage (optional)
  // ------------------------------------------------------------------
  function pinPruefen(ansicht) {
    const pin = (CFG.PIN && CFG.PIN[ansicht]) || "";
    return new Promise((resolve) => {
      if (!pin || store.get("pin_" + ansicht) === pin) return resolve();
      const ov = document.createElement("div");
      ov.className = "overlay";
      ov.innerHTML =
        '<form class="dialog"><h2>PIN eingeben</h2>' +
        '<input type="password" inputmode="numeric" autocomplete="off" class="pin-eingabe">' +
        '<p class="fehler" hidden>Falscher PIN</p>' +
        '<button class="gross primaer" type="submit">OK</button></form>';
      document.body.appendChild(ov);
      const input = $("input", ov);
      input.focus();
      $("form", ov).onsubmit = (e) => {
        e.preventDefault();
        if (input.value.trim() === pin) {
          store.set("pin_" + ansicht, pin); ov.remove(); resolve();
        } else {
          $(".fehler", ov).hidden = false; input.value = ""; input.focus();
        }
      };
    });
  }

  // ------------------------------------------------------------------
  // Ton (Web Audio – keine Sounddatei nötig)
  // ------------------------------------------------------------------
  let audioCtx = null;
  function audioFreischalten() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    // stummer Mini-Ton, damit iOS den Kontext wirklich freigibt
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    g.gain.value = 0.0001; o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.05);
  }
  function toene(folge) {
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    let t = audioCtx.currentTime + 0.02;
    folge.forEach(([freq, dauer]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t); o.stop(t + dauer + 0.02);
      t += dauer + 0.04;
    });
  }
  const tonNeu = () => toene([[880, 0.18], [1175, 0.18], [1568, 0.3], [880, 0.18], [1175, 0.18], [1568, 0.3]]);
  const tonStorno = () => toene([[440, 0.3], [330, 0.3], [220, 0.5]]);

  function blinken(farbe) {
    const f = document.createElement("div");
    f.className = "blitz " + (farbe || "");
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1600);
  }

  // ------------------------------------------------------------------
  // Bildschirm wach halten
  // ------------------------------------------------------------------
  let wakeLock = null;
  async function wachHalten() {
    if (!("wakeLock" in navigator)) return false;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      return true;
    } catch (e) { return false; }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wakeLock !== null) wachHalten();
  });

  window.App = {
    CFG, DEMO, DB, $, esc, euro, uhrzeit, minutenSeit, uuid, store, positionText,
    verbindungsAnzeige, toast, pinPruefen, audioFreischalten, tonNeu, tonStorno, blinken, wachHalten,
  };
})();
