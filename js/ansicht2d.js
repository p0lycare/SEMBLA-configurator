// Wandansicht als SVG in Millimetern: Steinverband, Öffnungen, Spannachsen, Verbinder, Deckenfuge.

import { GRID } from "./sembla-core.js";

const RAND = 260;

function bemassung(x0, x1, y, text) {
  return `<g class="mass"><line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#5E5E5E" stroke-width="6"/>`
    + `<line x1="${x0}" y1="${y - 40}" x2="${x0}" y2="${y + 40}" stroke="#5E5E5E" stroke-width="6"/>`
    + `<line x1="${x1}" y1="${y - 40}" x2="${x1}" y2="${y + 40}" stroke="#5E5E5E" stroke-width="6"/>`
    + `<text x="${(x0 + x1) / 2}" y="${y - 50}" text-anchor="middle" font-size="90" fill="#5E5E5E" font-family="ui-monospace, Menlo, monospace">${text}</text></g>`;
}

export function zeichne(el, r) {
  const { w, fa, kennzahlen: k } = r;
  const L = w.length_mm, H = w.height_mm, D = k.raumhoehe_mm;
  const Y = (y) => D - y;   // SVG-y nach unten
  const teile = [];

  teile.push(`<defs><pattern id="schraffur" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<line x1="0" y1="0" x2="0" y2="40" stroke="#1E1E1E" stroke-opacity=".18" stroke-width="10"/></pattern></defs>`);

  // Decke und Deckenfuge
  teile.push(`<rect x="-120" y="${Y(D) - 60}" width="${L + 240}" height="60" fill="#1E1E1E"/>`);
  teile.push(`<rect x="0" y="${Y(D)}" width="${L}" height="${D - H}" fill="url(#schraffur)"/>`);

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

  // Spannachsen (Segmente)
  for (const col of w.tension_columns) {
    for (const sg of col.segments) {
      teile.push(`<line x1="${col.x_mm}" y1="${Y(sg.z0_mm)}" x2="${col.x_mm}" y2="${Y(sg.z1_mm)}" stroke="#1FAA5F" stroke-width="22" stroke-opacity=".9"/>`);
    }
  }

  // Verbinder der Fassadenseite
  for (const p of fa.punkte) {
    teile.push(`<circle cx="${p.x}" cy="${Y(p.y)}" r="34" fill="#1FAA5F" stroke="#1E1E1E" stroke-width="6"/>`);
  }

  // Boden, Bodenblech, Maße
  teile.push(`<rect x="0" y="${Y(0)}" width="${L}" height="12" fill="#6B747A"/>`);
  teile.push(`<rect x="-120" y="${Y(0) + 12}" width="${L + 240}" height="40" fill="#1E1E1E"/>`);
  const m = (mm) => (mm / 1000).toFixed(3).replace(/0$/, "").replace(".", ",");
  teile.push(bemassung(0, L, Y(0) + 200, `${m(L)} m`));
  teile.push(`<text x="${L / 2}" y="${Y(D) - 110}" text-anchor="middle" font-size="90" fill="#5E5E5E" font-family="ui-monospace, Menlo, monospace">`
    + `Deckenfuge ${D - H} mm${k.ausgleich_mm ? ` · Ausgleichslage ${k.ausgleich_mm} mm` : ""}</text>`);

  const vb = `${-RAND} ${-RAND} ${L + 2 * RAND} ${D + 2 * RAND + 60}`;
  el.innerHTML = `<svg viewBox="${vb}" role="img" aria-label="Wandansicht ${m(L)} m lang, ${k.lagen} Lagen, ${k.steine} Steine">${teile.join("")}</svg>`;
}
