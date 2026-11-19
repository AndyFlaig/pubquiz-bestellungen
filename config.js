// =====================================================================
//  KONFIGURATION – nur diese Datei muss angepasst werden.
//  Texte immer in "Anführungszeichen", Zeilen mit Komma trennen.
// =====================================================================

window.APP_CONFIG = {

  // ---------------------------------------------------------------
  // 1) Supabase-Zugangsdaten (siehe ANLEITUNG.md, Schritt 1)
  //    Bleiben beide Felder leer, läuft die App im DEMO-MODUS:
  //    Daten nur auf diesem einen Gerät (zum Ausprobieren).
  // ---------------------------------------------------------------
  SUPABASE_URL: "",       // z. B. "https://abcdefghijk.supabase.co"
  SUPABASE_KEY: "",       // "anon public"-Key bzw. "Publishable key"

  // ---------------------------------------------------------------
  // 2) Veranstaltung
  // ---------------------------------------------------------------
  VERANSTALTUNG: "In 50 Fragen um die Welt – Sportheim Schiltach, 20.11.2026",

  // ---------------------------------------------------------------
  // 3) PINs pro Ansicht. Leer lassen ("") = kein PIN.
  //    Hinweis: Der PIN ist nur ein einfacher Schutz gegen versehentliches
  //    Öffnen, keine echte Sicherheit.
  // ---------------------------------------------------------------
  PIN: {
    kellner: "",
    kueche: "",
    theke: "",
  },

  // ---------------------------------------------------------------
  // 4) Die vier Kellner (Namen einfach ändern)
  // ---------------------------------------------------------------
  KELLNER: ["Kellner 1", "Kellner 2", "Kellner 3", "Kellner 4"],

  // ---------------------------------------------------------------
  // 5) Tische: Nummer und Teamname
  // ---------------------------------------------------------------
  TISCHE: [
    { nr: 1,  team: "Ich seh’s GRITisch" },
    { nr: 2,  team: "Zufallstreffer" },
    { nr: 3,  team: "Arnold Family" },
    { nr: 4,  team: "Antwort C" },
    { nr: 5,  team: "Papperlapub" },
    { nr: 6,  team: "IQ kleiner 40" },
    { nr: 7,  team: "SATALANA" },
    { nr: 8,  team: "Datz Tales" },
    { nr: 9,  team: "Unwissend 1" },
    { nr: 10, team: "S(chuh)uperhirne" },
    { nr: 11, team: "Feierwehr" },
    { nr: 12, team: "Brainteam" },
    { nr: 13, team: "TSV Alarm" },
    { nr: 14, team: "Muppet Show" },
    { nr: 15, team: "Hinz und Fix wir wissen nichts" },
    { nr: 16, team: "Unwissend 2" },
    { nr: 17, team: "Wartelisten Queens" },
    { nr: 18, team: "Weiß der Geier" },
    { nr: 19, team: "Besserholz" },
  ],

  // ---------------------------------------------------------------
  // 6) Preisliste
  //    id:     eindeutiges Kürzel (nicht doppelt vergeben!)
  //    ziel:   "theke" (Getränk) oder "kueche" (Speise)
  //    preis:  in Euro, mit PUNKT statt Komma (3.50)
  //    Die Reihenfolge hier = Reihenfolge in der Kellner-Ansicht.
  // ---------------------------------------------------------------
  ARTIKEL: [
    { id: "pils033",   kategorie: "Bier & Aperitif", name: "Pils vom Fass",   menge: "0,33 l", preis: 3.00, ziel: "theke" },
    { id: "pils05",    kategorie: "Bier & Aperitif", name: "Pils vom Fass",   menge: "0,5 l",  preis: 4.00, ziel: "theke" },
    { id: "weizen05",  kategorie: "Bier & Aperitif", name: "Weizen vom Fass", menge: "0,5 l",  preis: 4.00, ziel: "theke" },
    { id: "aperol",    kategorie: "Bier & Aperitif", name: "Aperol",          menge: "0,3 l",  preis: 5.50, ziel: "theke" },

    { id: "wschorle",  kategorie: "Wein", name: "Weinschorle", menge: "0,25 l", preis: 3.00, ziel: "theke" },
    { id: "weinrot",   kategorie: "Wein", name: "Wein rot",    menge: "0,25 l", preis: 4.00, ziel: "theke" },
    { id: "weinweiss", kategorie: "Wein", name: "Wein weiß",   menge: "0,25 l", preis: 4.00, ziel: "theke" },

    { id: "sprsauer",  kategorie: "Alkoholfrei", name: "Sprudel sauer",  menge: "0,5 l",  preis: 2.50, ziel: "theke" },
    { id: "sprsuess",  kategorie: "Alkoholfrei", name: "Sprudel süß",    menge: "0,5 l",  preis: 2.50, ziel: "theke" },
    { id: "fanta",     kategorie: "Alkoholfrei", name: "Fanta",          menge: "0,5 l",  preis: 3.00, ziel: "theke" },
    { id: "cola",      kategorie: "Alkoholfrei", name: "Cola",           menge: "0,5 l",  preis: 3.00, ziel: "theke" },
    { id: "colazero",  kategorie: "Alkoholfrei", name: "Cola Zero",      menge: "0,5 l",  preis: 3.00, ziel: "theke" },
    { id: "topfit",    kategorie: "Alkoholfrei", name: "Topfit",         menge: "0,5 l",  preis: 3.00, ziel: "theke" },
    { id: "puracell",  kategorie: "Alkoholfrei", name: "Puracell",       menge: "0,5 l",  preis: 3.00, ziel: "theke" },
    { id: "apfelsch",  kategorie: "Alkoholfrei", name: "Apfelschorle",   menge: "0,5 l",  preis: 3.00, ziel: "theke" },
    { id: "spezi",     kategorie: "Alkoholfrei", name: "Paulaner Spezi", menge: "0,33 l", preis: 2.50, ziel: "theke" },

    { id: "wsstrass",  kategorie: "Für den Hunger", name: "Straßburger Wurstsalat",  menge: "", preis: 9.00, ziel: "kueche" },
    { id: "wsschwab",  kategorie: "Für den Hunger", name: "Schwäbischer Wurstsalat", menge: "", preis: 9.00, ziel: "kueche" },
    { id: "wurstsal",  kategorie: "Für den Hunger", name: "Wurstsalat",              menge: "", preis: 9.00, ziel: "kueche" },
    { id: "kaesesal",  kategorie: "Für den Hunger", name: "Käsesalat",               menge: "", preis: 9.00, ziel: "kueche" },
    { id: "baguette",  kategorie: "Für den Hunger", name: "Schinken-Käse-Baguette",  menge: "", preis: 5.00, ziel: "kueche" },
  ],
};
