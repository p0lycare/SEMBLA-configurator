// Wandansicht als SVG in Millimetern: Steinverband, Öffnungen, Spannachsen, Verbinder, Deckenfuge.

import { GRID } from "./sembla-core.js";

// Schrift und Maßlinien wachsen mit der Zeichnung, damit sie bei langen oder hohen Wänden auf dem
// Bildschirm und im Datenblatt etwa gleich groß lesbar bleiben (90 mm bei der 6-m-Standardwand).
const schrift = (L, D) => Math.max(90, Math.round(0.014 * Math.max(L, D)));

function bemassung(x0, x1, y, text, fs) {
  const t = Math.round(fs * 0.45), sw = Math.max(6, Math.round(fs / 15));
  return `<g class="mass"><line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#5E5E5E" stroke-width="${sw}"/>`
    + `<line x1="${x0}" y1="${y - t}" x2="${x0}" y2="${y + t}" stroke="#5E5E5E" stroke-width="${sw}"/>`
    + `<line x1="${x1}" y1="${y - t}" x2="${x1}" y2="${y + t}" stroke="#5E5E5E" stroke-width="${sw}"/>`
    + `<text x="${(x0 + x1) / 2}" y="${y - Math.round(fs * 0.55)}" text-anchor="middle" font-size="${fs}" fill="#5E5E5E" font-family="ui-monospace, Menlo, monospace">${text}</text></g>`;
}

/**
 * seite: "aussen" (Fassadenseite, x läuft nach rechts wie in der 3D-Ansicht „Außen“) oder "innen"
 * (Raumseite: gespiegelt, mit den Verbindern der Innenseite). Beschriftungen werden nicht gespiegelt.
 * minHoehe (px): Die Zeichnung wird nie flacher; breite Wände lassen sich dann seitlich scrollen.
 */
let zeichnungNr = 0;

export function zeichne(el, r, { seite = "aussen", minHoehe = 0 } = {}) {
  const { w, kennzahlen: k } = r;
  const innen = seite === "innen";
  const punkte = (innen ? r.ia : r.fa)?.punkte || [];
  const L = w.length_mm, H = w.height_mm, D = k.raumhoehe_mm;
  const Y = (y) => D - y;   // SVG-y nach unten
  const fs = schrift(L, D);
  const kopf = `Ansicht von ${innen ? "innen" : "außen"} · Deckenfuge ${D - H} mm${k.ausgleich_mm ? ` · Ausgleichslage ${k.ausgleich_mm} mm` : ""}`;
  // Rand so breit, dass die Kopfzeile auch bei kurzen Wänden ganz zu sehen ist (Monospace ≈ 0,6 × Schrift je Zeichen).
  const rand = Math.max(260, Math.round(fs * 2.9), Math.round((kopf.length * 0.6 * fs - L) / 2 + 40));
  const teile = [];
  const sid = `schraffur-${++zeichnungNr}`;   // eindeutig, auch wenn mehrere Zeichnungen im DOM stehen

  teile.push(`<defs><pattern id="${sid}" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<line x1="0" y1="0" x2="0" y2="40" stroke="#1E1E1E" stroke-opacity=".18" stroke-width="10"/></pattern></defs>`);

  // Decke und Deckenfuge
  teile.push(`<rect x="-120" y="${Y(D) - 60}" width="${L + 240}" height="60" fill="#1E1E1E"/>`);
  teile.push(`<rect x="0" y="${Y(D)}" width="${L}" height="${D - H}" fill="url(#${sid})"/>`);

  // Steine
  for (const c of w.courses) {
    for (const s of c.stones) {
      const fill = c.ausgleich ? "#E6E3D8" : s.type === "i3" ? "#B4B4AE" : "#CFCFCA";
      teile.push(`<rect x="${s.x0 + 3}" y="${Y(c.oberkante_mm) + 3}" width="${s.x1 - s.x0 - 6}" height="${c.hoehe_mm - 6}" `
        + `rx="6" fill="${fill}" stroke="#8A8A85" stroke-width="4"/>`);
    }
  }

  // Öffnungen
  for (const op of w.openings) {
    const y0 = w.courses[op.l0].unterkante_mm, y1 = w.courses[op.l1 - 1].oberkante_mm;
    teile.push(`<rect x="${op.g0 * GRID}" y="${Y(y1)}" width="${(op.g1 - op.g0) * GRID}" height="${y1 - y0}" `
      + `fill="#FDFDFD" stroke="#5E5E5E" stroke-width="6" stroke-dasharray="30 20"/>`);
  }

  // Gewünschte, aber nicht baubare Lage der zuletzt bewegten Öffnung (Kollision, app.js)
  const ko = r.kollision, kc = ko && w.courses[ko.l0] && w.courses[ko.l1 - 1];
  if (kc) {
    const y0 = w.courses[ko.l0].unterkante_mm, y1 = w.courses[ko.l1 - 1].oberkante_mm;
    teile.push(`<rect x="${ko.x0}" y="${Y(y1)}" width="${ko.x1 - ko.x0}" height="${y1 - y0}" fill="#D0342C" fill-opacity=".22" stroke="#D0342C" stroke-width="14" stroke-dasharray="40 24"/>`);
  }

  // Spannachsen (Segmente), blau; die Verbinder sind grün (Feedback Felix 2.1)
  for (const col of w.tension_columns) {
    for (const sg of col.segments) {
      teile.push(`<line x1="${col.x_mm}" y1="${Y(sg.z0_mm)}" x2="${col.x_mm}" y2="${Y(sg.z1_mm)}" stroke="#2F6DB5" stroke-width="22" stroke-opacity=".9"/>`);
    }
  }

  // Verbinder der gezeigten Seite
  for (const p of punkte) {
    teile.push(`<circle cx="${p.x}" cy="${Y(p.y)}" r="34" fill="#1FAA5F" stroke="#1E1E1E" stroke-width="6"/>`);
  }

  // Boden, Bodenblech, Maße
  for (const t of w.base_plate.teile) teile.push(`<rect x="${t.x0_mm}" y="${Y(0)}" width="${t.raster_mm}" height="12" fill="#6B747A"/>`);
  teile.push(`<rect x="-120" y="${Y(0) + 12}" width="${L + 240}" height="40" fill="#1E1E1E"/>`);
  // Von innen gesehen ist die Wand gespiegelt; die Beschriftungen darunter bleiben lesbar.
  const bild = innen ? `<g transform="matrix(-1 0 0 1 ${L} 0)">${teile.splice(1).join("")}</g>` : teile.splice(1).join("");
  teile.push(bild);
  const m = (mm) => (mm / 1000).toFixed(3).replace(/0$/, "").replace(".", ",");
  teile.push(bemassung(0, L, Y(0) + 52 + Math.round(fs * 1.9), `${m(L)} m`, fs));
  // Blickrichtung: außen läuft x nach rechts wie in der 3D-Ansicht „Außen“, innen gespiegelt.
  teile.push(`<text x="${L / 2}" y="${Y(D) - 60 - Math.round(fs * 0.5)}" text-anchor="middle" font-size="${fs}" fill="#5E5E5E" font-family="ui-monospace, Menlo, monospace">`
    + `${kopf}</text>`);

  const vbB = L + 2 * rand, vbH = D + 2 * rand + 60;
  const vb = `${-rand} ${-rand} ${vbB} ${vbH}`;
  const stil = minHoehe ? ` style="min-width:${Math.round(minHoehe * vbB / vbH)}px"` : "";
  el.innerHTML = `<svg viewBox="${vb}"${stil} role="img" aria-label="Wandansicht von ${innen ? "innen" : "außen"}, ${m(L)} m lang, ${k.lagen} Lagen, ${k.steine} Steine">${teile.join("")}</svg>`;
}
