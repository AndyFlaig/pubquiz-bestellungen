/* Minimaler Excel-Export (.xlsx) ohne Fremdbibliothek.
   Eine .xlsx-Datei ist ein ZIP-Archiv mit XML-Dateien; hier ungepackt ("stored") geschrieben.

   App.excelHerunterladen("datei.xlsx", [
     { name: "Blatt", spalten: [{ titel: "Artikel", breite: 30 }, { titel: "Preis", typ: "euro" }], zeilen: [["Pils", 4]] },
   ]);
   Spaltentypen: "text" (Standard), "zahl", "euro". */
(function () {
  "use strict";

  const enc = new TextEncoder();

  // ---------- CRC32 ----------
  const CRC_TAB = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TAB[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // ---------- ZIP (stored) ----------
  function zip(dateien) { // [{ name, text }]
    const teile = [], zentral = [];
    let offset = 0;
    const d = new Date();
    const dosZeit = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDatum = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

    dateien.forEach((f) => {
      const name = enc.encode(f.name);
      const daten = enc.encode(f.text);
      const crc = crc32(daten);

      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, dosZeit, true); lh.setUint16(12, dosDatum, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, daten.length, true); lh.setUint32(22, daten.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      teile.push(new Uint8Array(lh.buffer), name, daten);

      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, dosZeit, true); ch.setUint16(14, dosDatum, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, daten.length, true); ch.setUint32(24, daten.length, true);
      ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      zentral.push(new Uint8Array(ch.buffer), name);

      offset += 30 + name.length + daten.length;
    });

    const zentralLaenge = zentral.reduce((s, b) => s + b.length, 0);
    const ende = new DataView(new ArrayBuffer(22));
    ende.setUint32(0, 0x06054b50, true); ende.setUint16(8, dateien.length, true); ende.setUint16(10, dateien.length, true);
    ende.setUint32(12, zentralLaenge, true); ende.setUint32(16, offset, true);
    return new Blob([...teile, ...zentral, new Uint8Array(ende.buffer)],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  // ---------- XLSX ----------
  const x = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  function spaltenName(i) {
    let s = "";
    for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  }

  // Stile: 0 normal, 1 fett (Kopfzeile), 2 Euro, 3 ganze Zahl
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE6EFFF"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    "</cellXfs></styleSheet>";

  function blattXml(blatt) {
    const kopf = blatt.spalten.map((sp, i) =>
      '<c r="' + spaltenName(i) + '1" t="inlineStr" s="1"><is><t xml:space="preserve">' + x(sp.titel) + "</t></is></c>").join("");
    const zeilen = blatt.zeilen.map((z, ri) => {
      const r = ri + 2;
      return '<row r="' + r + '">' + z.map((wert, ci) => {
        const ref = spaltenName(ci) + r;
        const typ = (blatt.spalten[ci] && blatt.spalten[ci].typ) || "text";
        if (wert === null || wert === undefined || wert === "") return "";
        if ((typ === "euro" || typ === "zahl") && typeof wert === "number" && isFinite(wert)) {
          return '<c r="' + ref + '" s="' + (typ === "euro" ? 2 : 3) + '"><v>' + wert + "</v></c>";
        }
        return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + x(wert) + "</t></is></c>";
      }).join("") + "</row>";
    }).join("");
    const cols = "<cols>" + blatt.spalten.map((sp, i) =>
      '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (sp.breite || 14) + '" customWidth="1"/>').join("") + "</cols>";
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      cols + '<sheetData><row r="1">' + kopf + "</row>" + zeilen + "</sheetData>" +
      (blatt.zeilen.length ? '<autoFilter ref="A1:' + spaltenName(blatt.spalten.length - 1) + (blatt.zeilen.length + 1) + '"/>' : "") +
      "</worksheet>";
  }

  function blattName(n, i, vergeben) {
    let name = String(n || "Blatt" + (i + 1)).replace(/[\\/?*\[\]:]/g, " ").slice(0, 31) || "Blatt" + (i + 1);
    while (vergeben.has(name.toLowerCase())) name = name.slice(0, 28) + " " + (i + 1);
    vergeben.add(name.toLowerCase());
    return name;
  }

  function excelBlob(blaetter) {
    const vergeben = new Set();
    const namen = blaetter.map((b, i) => blattName(b.name, i, vergeben));
    const dateien = [
      { name: "[Content_Types].xml", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        blaetter.map((b, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
          '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") +
        "</Types>" },
      { name: "_rels/.rels", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>" },
      { name: "xl/workbook.xml", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        "<sheets>" + namen.map((n, i) => '<sheet name="' + x(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") +
        "</sheets></workbook>" },
      { name: "xl/_rels/workbook.xml.rels", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        blaetter.map((b, i) => '<Relationship Id="rId' + (i + 1) +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") +
        '<Relationship Id="rId' + (blaetter.length + 1) +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>" },
      { name: "xl/styles.xml", text: STYLES },
    ].concat(blaetter.map((b, i) => ({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", text: blattXml(b) })));
    return zip(dateien);
  }

  function excelHerunterladen(dateiname, blaetter) {
    const blob = excelBlob(blaetter);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = dateiname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  window.App = window.App || {};
  window.App.excelBlob = excelBlob;
  window.App.excelHerunterladen = excelHerunterladen;
})();
