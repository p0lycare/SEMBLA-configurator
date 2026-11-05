// Draufsichten der Bauteile für die Stückliste: flach gelegt wie auf einem Werktisch, nicht
// maßstäblich. Jede Grafik füllt eine 160 × 100-Fläche.

const K = { kontur: "#1E1E1E", stein: "#C9C9C4", steinDunkel: "#A9A9A3", stahl: "#8E979C", stahlDunkel: "#5E676C", gruen: "#1FAA5F" };

const svg = (inhalt) => `<svg viewBox="0 0 160 100" aria-hidden="true">${inhalt}</svg>`;
const linie = `stroke="${K.kontur}" stroke-width="1.5" stroke-linejoin="round"`;

function sechseck(cx, cy, r, fill) {
  const p = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return `<polygon points="${p}" fill="${fill}" ${linie}/>`;
}

/** Stein in Draufsicht: Kammern je Raster, Nuten auf beiden Seiten. */
function stein(m) {
  const s = 128 / 3, b = m * s, h = s, x0 = (160 - b) / 2, y0 = (100 - h) / 2;
  let d = `<rect x="${x0}" y="${y0}" width="${b}" height="${h}" rx="3" fill="${K.stein}" ${linie}/>`;
  for (let i = 0; i < m; i++) d += `<rect x="${x0 + i * s + s * 0.27}" y="${y0 + h * 0.27}" width="${s * 0.46}" height="${h * 0.46}" rx="2" fill="#FDFDFD" ${linie}/>`;
  for (let j = 1; j < m; j++) {
    const x = x0 + j * s;
    d += `<rect x="${x - 3}" y="${y0 - 0.5}" width="6" height="4" fill="#FDFDFD"/><rect x="${x - 3}" y="${y0 + h - 3.5}" width="6" height="4" fill="#FDFDFD"/>`;
    d += `<path d="M${x - 3} ${y0} v3.5 h6 v-3.5 M${x - 3} ${y0 + h} v-3.5 h6 v3.5" fill="none" ${linie}/>`;
  }
  return svg(d);
}

function stange(laenge) {
  const b = 30 + 110 * Math.min(1, laenge / 1100), x0 = (160 - b) / 2;
  let d = `<rect x="${x0}" y="45" width="${b}" height="10" rx="2" fill="${K.stahl}" ${linie}/>`;
  for (let x = x0 + 3; x < x0 + b - 2; x += 4) d += `<line x1="${x}" y1="45.5" x2="${x + 2}" y2="54.5" stroke="${K.stahlDunkel}" stroke-width="1"/>`;
  return svg(d);
}

function blech(laenge) {
  const b = 40 + 110 * Math.min(1, laenge / 1250), x0 = (160 - b) / 2;
  let d = `<rect x="${x0}" y="40" width="${b}" height="20" fill="${K.stahl}" ${linie}/>`;
  for (let x = x0 + 10; x < x0 + b - 5; x += 14) d += `<circle cx="${x}" cy="50" r="2.4" fill="#FDFDFD" ${linie}/>`;
  return svg(d);
}

function holzQuerschnitt(b, h, farbe) {
  const s = 60 / Math.max(b, h), w = b * s, hh = h * s, x = 80 - w / 2, y = 50 - hh / 2;
  return svg(`<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${farbe}" ${linie}/>`
    + `<path d="M${x + w * 0.2} ${y + hh * 0.85} q${w * 0.3} ${-hh * 0.6} ${w * 0.6} ${-hh * 0.7} M${x + w * 0.1} ${y + hh * 0.55} q${w * 0.25} ${-hh * 0.35} ${w * 0.5} ${-hh * 0.4}" fill="none" stroke="${K.kontur}" stroke-opacity=".35" stroke-width="1.2"/>`);
}

function platte(farbe, muster) {
  let d = `<rect x="30" y="18" width="100" height="64" fill="${farbe}" ${linie}/>`;
  if (muster === "daemmung") for (let x = 34; x < 126; x += 8) d += `<path d="M${x} 24 l4 8 l-4 8 l4 8 l-4 8 l4 8 l-4 8" fill="none" stroke="${K.kontur}" stroke-opacity=".3" stroke-width="1.2"/>`;
  if (muster === "folie") d = `<rect x="30" y="22" width="92" height="56" fill="${farbe}" ${linie}/><ellipse cx="122" cy="50" rx="8" ry="28" fill="${farbe}" ${linie}/><ellipse cx="122" cy="50" rx="3" ry="10" fill="#FDFDFD" ${linie}/>`;
  return svg(d);
}

export function teilBild(t, farben) {
  const f = (m) => farben[m] || "#cccccc";
  switch (t.symbol) {
    case "i3": return stein(3);
    case "i2": return stein(2);
    case "stange": return stange(t.laenge || 1100);
    case "bodenblech": return blech(t.laenge || 1250);
    case "kopplungsmutter": return svg(`<rect x="52" y="38" width="56" height="24" rx="2" fill="${K.stahl}" ${linie}/>`
      + [64, 80, 96].map((x) => `<line x1="${x}" y1="38" x2="${x}" y2="62" stroke="${K.stahlDunkel}" stroke-width="1"/>`).join(""));
    case "mutter": return svg(sechseck(80, 50, 24, K.stahl) + `<circle cx="80" cy="50" r="10" fill="#FDFDFD" ${linie}/>`);
    case "sechskant": return svg(`<rect x="43" y="36" width="14" height="28" rx="1" fill="${K.stahl}" ${linie}/><line x1="43" y1="45" x2="57" y2="45" stroke="${K.stahlDunkel}" stroke-width="1"/><line x1="43" y1="55" x2="57" y2="55" stroke="${K.stahlDunkel}" stroke-width="1"/><rect x="57" y="45" width="66" height="10" fill="${K.stahl}" ${linie}/>`
      + Array.from({ length: 15 }, (_, i) => `<line x1="${62 + i * 4}" y1="45.5" x2="${64 + i * 4}" y2="54.5" stroke="${K.stahlDunkel}" stroke-width="1"/>`).join(""));
    case "spannplatte": return svg(`<rect x="50" y="20" width="60" height="60" rx="2" fill="${K.stahl}" ${linie}/><circle cx="80" cy="50" r="7" fill="#FDFDFD" ${linie}/>`);
    case "einlegeblech": return svg(`<rect x="38" y="30" width="84" height="40" rx="3" fill="${K.stahl}" ${linie}/>` + sechseck(80, 50, 13, K.stahlDunkel) + `<circle cx="80" cy="50" r="5" fill="#FDFDFD" ${linie}/>`);
    case "verguss": return svg(`<rect x="30" y="44" width="100" height="10" fill="${K.stahl}" ${linie}/><path d="M26 54 Q40 60 54 56 T82 57 T110 56 T134 54 V66 H26 Z" fill="#B9B6AC" ${linie}/>`);
    case "ausgleichsblech": return svg(`<rect x="72" y="20" width="16" height="60" fill="${K.stahl}" ${linie}/>`);
    case "deckenanschluss": return svg(`<path d="M45 25 H75 V65 H115 V75 H65 V35 H45 Z" fill="${K.stahl}" ${linie}/><circle cx="95" cy="70" r="2.5" fill="#FDFDFD" ${linie}/><circle cx="70" cy="45" r="2.5" fill="#FDFDFD" ${linie}/>`);
    case "verbinder": return svg(`<rect x="56" y="30" width="48" height="40" rx="8" fill="${K.gruen}" ${linie}/><rect x="74" y="22" width="12" height="56" rx="3" fill="${K.gruen}" ${linie}/><circle cx="80" cy="50" r="5" fill="#FDFDFD" ${linie}/>`);
    case "schraube": return svg(`<rect x="34" y="40" width="10" height="20" rx="2" fill="${K.stahl}" ${linie}/><path d="M44 46 H118 L128 50 L118 54 H44 Z" fill="${K.stahl}" ${linie}/>`
      + Array.from({ length: 16 }, (_, i) => `<line x1="${56 + i * 4}" y1="46.5" x2="${58 + i * 4}" y2="53.5" stroke="${K.stahlDunkel}" stroke-width="1"/>`).join(""));
    case "staender": return holzQuerschnitt(60, 60, f(t.material));
    case "latte_v":
    case "latte_h":
      if (t.material === "alu") return svg(`<path d="M40 30 H120 V40 H86 V75 H74 V40 H40 Z" fill="${f("alu")}" ${linie}/>`);
      return holzQuerschnitt(58, 34, f(t.material));
    case "halter": return svg(`<path d="M50 25 H62 V63 H112 V75 H50 Z" fill="${f("alu")}" ${linie}/><circle cx="56" cy="35" r="2.5" fill="#FDFDFD" ${linie}/><circle cx="100" cy="69" r="2.5" fill="#FDFDFD" ${linie}/>`);
    case "feld": return platte(f(t.material), "daemmung");
    case "platte": return t.material === "bahn" ? platte(f(t.material), "folie") : platte(f(t.material), t.material === "mineralwolle" || t.material.startsWith("holzfaser") ? "daemmung" : null);
    case "schindel": return svg(`<rect x="28" y="26" width="104" height="50" rx="2" fill="${f(t.material)}" ${linie}/><rect x="28" y="26" width="104" height="14" fill="#000" fill-opacity=".12"/><circle cx="44" cy="33" r="2.5" fill="#FDFDFD" ${linie}/><circle cx="116" cy="33" r="2.5" fill="#FDFDFD" ${linie}/>`);
    case "leiste_h": return svg(`<path d="M30 58 L42 42 H130 L118 58 Z" fill="${f(t.material)}" ${linie}/>`);
    case "paneel": {
      return t.hoch ? svg(`<rect x="58" y="12" width="44" height="76" fill="${f(t.material)}" ${linie}/>`)
        : svg(`<rect x="24" y="36" width="112" height="28" fill="${f(t.material)}" ${linie}/><line x1="24" y1="42" x2="136" y2="42" stroke="${K.kontur}" stroke-opacity=".3"/>`);
    }
    case "winkel": return svg(`<path d="M45 25 H57 V63 H115 V75 H45 Z" fill="${K.stahl}" ${linie}/><circle cx="51" cy="38" r="2.5" fill="#FDFDFD" ${linie}/><circle cx="51" cy="52" r="2.5" fill="#FDFDFD" ${linie}/><circle cx="100" cy="69" r="2.5" fill="#FDFDFD" ${linie}/>`);
    case "lueftung": return svg(`<path d="M24 40 H136 V48 H24 Z M24 48 H32 V64 H24 Z" fill="${f("alu")}" ${linie}/>`
      + Array.from({ length: 13 }, (_, i) => `<rect x="${36 + i * 7.5}" y="42.5" width="4" height="3" fill="#FDFDFD"/>`).join(""));
    default: return svg(`<rect x="50" y="30" width="60" height="40" fill="#ddd" ${linie}/>`);
  }
}
