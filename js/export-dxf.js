// CAD-Export: Ansicht der Wand mit Steinverband, Öffnungen und Spannachsen sowie ein Grundriss-
// Schnitt mit dem Schichtaufbau, als DXF (AutoCAD R12, ASCII, Einheit mm). Reines Modul ohne DOM.

import { schichtFolge } from "./aufbau-geometrie.js";

// Layer: Name, Farbe (ACI)
const LAYER = [
  ["STEINE_I3", 8], ["STEINE_I2", 9], ["AUSGLEICH", 30], ["OEFFNUNG", 5], ["SPANNACHSE", 1],
  ["SCHNITT_STEIN", 8], ["SCHNITT_INNEN", 3], ["SCHNITT_FASSADE", 30], ["SCHNITT_LUFT", 4], ["TEXT", 7], ["BEMASSUNG", 7],
];

// R12 kennt kein UTF-8: Zeichen außerhalb ASCII als \U+XXXX (versteht AutoCAD und die gängigen Leser).
const ascii = (t) => [...String(t)].map((c) => (c.codePointAt(0) < 128 ? c : `\\U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`)).join("");
const z = (x) => (Math.round(x * 100) / 100).toString();

/** DXF-Datei als Text. r: Ergebnis von berechne(); fassade/innen: Aufbauten; info: { titel }. */
export function wandAlsDxf(r, fassade, innen, info = {}) {
  const w = r.w, L = w.length_mm, H = w.height_mm;
  const ent = [];
  const linie = (layer, x1, y1, x2, y2) => ent.push("0", "LINE", "8", layer, "10", z(x1), "20", z(y1), "30", "0", "11", z(x2), "21", z(y2), "31", "0");
  const rechteck = (layer, x0, y0, x1, y1) => {
    ent.push("0", "POLYLINE", "8", layer, "66", "1", "10", "0", "20", "0", "30", "0", "70", "1");
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) ent.push("0", "VERTEX", "8", layer, "10", z(x), "20", z(y), "30", "0");
    ent.push("0", "SEQEND", "8", layer);
  };
  const schrift = (layer, x, y, h, t) => ent.push("0", "TEXT", "8", layer, "10", z(x), "20", z(y), "30", "0", "40", z(h), "1", ascii(t));

  // Ansicht (wie die Außenansicht, x nach rechts): jeder Stein als Rechteck, Öffnungen, Spannachsen
  for (const lage of w.courses) for (const s of lage.stones)
    rechteck(lage.ausgleich ? "AUSGLEICH" : s.type === "i2" ? "STEINE_I2" : "STEINE_I3", s.x0, lage.unterkante_mm, s.x1, lage.oberkante_mm);
  for (const op of w.openings) {
    const x0 = op.g0 * w.grid_mm, x1 = op.g1 * w.grid_mm;
    const y0 = w.courses[op.l0].unterkante_mm, y1 = w.courses[op.l1 - 1].oberkante_mm;
    rechteck("OEFFNUNG", x0, y0, x1, y1);
    linie("OEFFNUNG", x0, y0, x1, y1); linie("OEFFNUNG", x0, y1, x1, y0);
    schrift("TEXT", x0 + 40, y1 + 40, 60, `${op.art === "tuer" ? "Tür" : "Fenster"} ${(x1 - x0) / 10} × ${(y1 - y0) / 10} cm`);
  }
  for (const c of w.tension_columns) for (const s of c.segments) linie("SPANNACHSE", c.x_mm, s.z0_mm, c.x_mm, s.z1_mm);
  // Maßketten als Linien mit Text (ohne DIMENSION-Blöcke, damit jeder Leser sie zeigt)
  linie("BEMASSUNG", 0, -250, L, -250); linie("BEMASSUNG", 0, -300, 0, -200); linie("BEMASSUNG", L, -300, L, -200);
  schrift("BEMASSUNG", L / 2 - 200, -200, 80, `${(L / 1000).toFixed(3).replace(".", ",")} m`);
  linie("BEMASSUNG", -250, 0, -250, H); linie("BEMASSUNG", -300, 0, -200, 0); linie("BEMASSUNG", -300, H, -200, H);
  schrift("BEMASSUNG", -1400, H / 2, 70, `Wandhöhe ${(H / 1000).toFixed(2).replace(".", ",")} m`);
  schrift("TEXT", 0, H + 300, 140, info.titel || "SEMBLA-Wand, Ansicht");
  schrift("TEXT", 0, H + 120, 70, `${r.kennzahlen.i3} × i3, ${r.kennzahlen.i2} × i2, ${r.kennzahlen.spannachsen} Spannachsen (rot). Maße in mm.`);

  // Grundriss-Schnitt unter der Ansicht: Schichten von innen (oben) nach außen (unten)
  const schichten = schichtFolge(fassade, innen, w.thickness_mm).filter((s) => s.dicke > 0);
  const T = schichten.reduce((a, s) => a + s.dicke, 0);
  let y = -1200;
  schrift("TEXT", 0, y + 120, 100, `Grundriss-Schnitt, Schichtaufbau ${Math.round(T)} mm (oben innen, unten außen)`);
  // Beschriftung rechts mit Hinweislinien, mindestens 80 mm Zeilenabstand, damit dünne Schichten lesbar bleiben.
  let textY = y;
  for (const s of schichten) {
    const layer = { stein: "SCHNITT_STEIN", innen: "SCHNITT_INNEN", fassade: "SCHNITT_FASSADE", belueftung: "SCHNITT_LUFT" }[s.art];
    rechteck(layer, 0, y - s.dicke, L, y);
    const mitte = y - s.dicke / 2;
    textY = Math.min(textY, mitte);
    linie("TEXT", L, mitte, L + 150, mitte); linie("TEXT", L + 150, mitte, L + 300, textY);
    schrift("TEXT", L + 330, textY - 20, 45, `${String(s.dicke).replace(".", ",")} mm  ${s.name}`);
    textY -= 80;
    y -= s.dicke;
  }
  for (const op of w.openings) {
    const x0 = op.g0 * w.grid_mm, x1 = op.g1 * w.grid_mm;
    linie("OEFFNUNG", x0, -1200, x0, y); linie("OEFFNUNG", x1, -1200, x1, y);
  }

  const kopf = ["0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "9", "$INSUNITS", "70", "4",
    "9", "$EXTMIN", "10", z(-1500), "20", z(Math.min(y, -1200 - 80 * schichten.length) - 200), "9", "$EXTMAX", "10", z(L + 3500), "20", z(H + 500), "0", "ENDSEC"];
  const tabellen = ["0", "SECTION", "2", "TABLES",
    "0", "TABLE", "2", "LTYPE", "70", "1", "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0.0", "0", "ENDTAB",
    "0", "TABLE", "2", "LAYER", "70", String(LAYER.length),
    ...LAYER.flatMap(([name, farbe]) => ["0", "LAYER", "2", name, "70", "0", "62", String(farbe), "6", "CONTINUOUS"]),
    "0", "ENDTAB", "0", "ENDSEC"];
  return [...kopf, ...tabellen, "0", "SECTION", "2", "ENTITIES", ...ent, "0", "ENDSEC", "0", "EOF", ""].join("\r\n");
}
