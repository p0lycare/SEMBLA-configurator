// Wandschnitt als SVG in Millimetern (Feedback Felix 1.4/B5): Horizontalschnitt durch ein Stück
// Regelwand, innen oben, außen unten. Gezeigt werden alle Schichten mit Dicke, die Ständer bzw.
// Latten auf ihren echten Achsen und die Verbinder in der Verbindernut. Öffnungen bleiben weg.

import { schichtLagen } from "./aufbau-geometrie.js";

const AUSSCHNITT = 1000;                       // Länge des gezeigten Wandstücks, mm
const RAHMEN = new Set(["staender", "latte_v"]); // einzeln auf Achsen geschnitten
const MIN_ZEICHEN = 4;                         // Bahnen (1 mm) sichtbar machen

const de = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * Schichten einer Seite mit Tiefe ab Steinoberfläche (z0/z1) und Achsraster. richtung: -1 innen
 * (nach oben), +1 außen (nach unten).
 */
function seite(aufbau, achsen, richtung) {
  return schichtLagen(aufbau?.schichten).map((s) => ({ ...s, richtung, achsen }));
}

/** Zonen für die Beschriftung: parallele Schichten (Ständer + Dämmung) teilen eine Dicke. */
function zonen(lagen) {
  const liste = [];
  for (const s of lagen) {
    const z = liste.find((x) => x.z0 === s.z0 && x.richtung === s.richtung);
    if (z) { z.namen.push(s.name); z.z1 = Math.max(z.z1, s.z1); } else liste.push({ z0: s.z0, z1: s.z1, richtung: s.richtung, namen: [s.name] });
  }
  return liste;
}

export function zeichneSchnitt(el, r, innen, materialien = {}) {
  const { w } = r;
  const T = w.thickness_mm, L = w.length_mm;
  const S = Math.min(AUSSCHNITT, L);
  const x0 = Math.max(0, Math.round((L / 2 - S / 2) / 125) * 125), x1 = x0 + S;
  const farbe = (m) => materialien[m] || "#CCCCC8";
  const lagen = [
    ...seite(innen, (r.ia?.achsen || []), -1),
    ...seite(r.fassade, (r.fa?.achsen || []), 1),
  ];
  const tiefeInnen = Math.max(0, ...lagen.filter((s) => s.richtung < 0).map((s) => s.z1));
  const tiefeAussen = Math.max(0, ...lagen.filter((s) => s.richtung > 0).map((s) => s.z1));
  // y = 0 an der Innenkante des Aufbaus; Stein von tiefeInnen bis tiefeInnen + T.
  const steinOben = tiefeInnen, steinUnten = tiefeInnen + T, gesamt = tiefeInnen + T + tiefeAussen;
  const yVon = (s, z) => (s.richtung < 0 ? steinOben - z : steinUnten + z);
  const fs = Math.max(26, Math.round(Math.max(gesamt, 500) * 0.06));
  const teile = [];

  // Flächige Schichten zuerst, Ständer und Latten darüber.
  const band = (s) => {
    const ya = yVon(s, s.z0), yb = yVon(s, s.z1);
    let y = Math.min(ya, yb), h = Math.abs(yb - ya);
    if (h < MIN_ZEICHEN) { y -= (MIN_ZEICHEN - h) / 2; h = MIN_ZEICHEN; }
    return { y, h };
  };
  for (const s of lagen.filter((x) => !RAHMEN.has(x.art))) {
    const { y, h } = band(s);
    const luft = s.art === "latte_h";   // waagerechte Latten: im Schnitt meist Luftraum, hell schraffiert
    teile.push(`<rect x="${x0}" y="${y}" width="${S}" height="${h}" fill="${luft ? "url(#luft)" : farbe(s.material)}"`
      + `${h <= MIN_ZEICHEN ? ` stroke="${farbe(s.material)}" stroke-width="2"` : ` stroke="#5E5E5E" stroke-width="2"`}/>`);
  }
  for (const s of lagen.filter((x) => RAHMEN.has(x.art))) {
    const { y, h } = band(s);
    // Zwischen den Latten Luft (Hinterlüftung), außer die Zone ist gedämmt (parallele Schicht).
    const gefuellt = lagen.some((x) => x !== s && x.richtung === s.richtung && x.z0 === s.z0 && !RAHMEN.has(x.art));
    if (!gefuellt) teile.push(`<rect x="${x0}" y="${y}" width="${S}" height="${h}" fill="url(#luft)" stroke="#5E5E5E" stroke-width="2"/>`);
    for (const a of s.achsen.filter((a) => a > x0 - s.breite && a < x1 + s.breite)) {
      const xa = Math.max(x0, a - s.breite / 2), xb = Math.min(x1, a + s.breite / 2);
      teile.push(`<rect x="${xa}" y="${y}" width="${xb - xa}" height="${h}" fill="${farbe(s.material)}" stroke="#5E5E5E" stroke-width="3"/>`);
    }
  }

  // Stein: unterste Lage mit Stoßfugen, Kammern angedeutet.
  teile.push(`<rect x="${x0}" y="${steinOben}" width="${S}" height="${T}" fill="${farbe("stein")}" stroke="#5E5E5E" stroke-width="3"/>`);
  for (const st of (w.courses[0]?.stones || []).filter((st) => st.x1 > x0 && st.x0 < x1)) {
    for (const x of [st.x0, st.x1]) if (x > x0 && x < x1)
      teile.push(`<line x1="${x}" y1="${steinOben}" x2="${x}" y2="${steinUnten}" stroke="#5E5E5E" stroke-width="5"/>`);
    for (let k = st.x0 + 62.5; k < st.x1; k += 125) if (k > x0 + 30 && k < x1 - 30)
      teile.push(`<rect x="${k - 30}" y="${steinOben + T / 2 - 30}" width="60" height="60" rx="8" fill="none" stroke="#8A8A85" stroke-width="3"/>`);
  }
  // Verbinder in der Verbindernut: kleine Marken an der Steinoberfläche, auf den Achsen.
  const marke = (achsen, y) => achsen.filter((a) => a > x0 && a < x1)
    .forEach((a) => teile.push(`<rect x="${a - 14}" y="${y - 14}" width="28" height="28" fill="#1FAA5F" stroke="#1E1E1E" stroke-width="3"/>`));
  if (r.fassade?.schichten?.length) marke(r.fa?.achsen || [], steinUnten);
  if (innen?.schichten?.length) marke(r.ia?.achsen || [], steinOben);

  // Beschriftung rechts: Dicke und Name je Zone, mit Hinweislinie; Zeilen mit Mindestabstand.
  const eintraege = [
    ...zonen(lagen.filter((s) => s.richtung < 0)).map((z) => ({ ...z, y: (yVon(z, z.z0) + yVon(z, z.z1)) / 2 })),
    { y: (steinOben + steinUnten) / 2, dicke: T, namen: ["SEMBLA-Stein, Trockenmauerwerk vorgespannt"] },
    ...zonen(lagen.filter((s) => s.richtung > 0)).map((z) => ({ ...z, y: (yVon(z, z.z0) + yVon(z, z.z1)) / 2 })),
  ].map((e) => ({ ...e, dicke: e.dicke ?? e.z1 - e.z0 })).sort((a, b) => a.y - b.y);
  // Nummern rechts neben dem Schnitt, mit Hinweislinie; dicht liegende Schichten weichen nach unten aus.
  // Die Namen stehen als Liste unter der Zeichnung (HTML), damit sie in normaler Schriftgröße lesbar sind.
  const r0 = fs * 0.62, zeile = r0 * 2.3;
  let ty = Math.min(eintraege[0].y, (gesamt - zeile * (eintraege.length - 1)) / 2);
  const xk = x1 + 150, xl = x1 + 40;
  eintraege.forEach((e, i) => {
    ty = Math.max(ty, e.y);
    teile.push(`<polyline points="${x1},${e.y} ${xl},${e.y} ${xk - r0},${ty}" fill="none" stroke="#8A8A85" stroke-width="3"/>`);
    teile.push(`<circle cx="${xk}" cy="${ty}" r="${r0}" fill="#FDFDFD" stroke="#1E1E1E" stroke-width="3"/>`
      + `<text x="${xk}" y="${ty + r0 * 0.42}" font-size="${r0 * 1.2}" text-anchor="middle" fill="#1E1E1E" font-family="ui-monospace, Menlo, monospace">${i + 1}</text>`);
    ty += zeile;
  });
  const textEnde = ty - zeile + r0 + 10;

  // Gesamtdicke links, Seitenangaben
  const xm = x0 - 90, t = 25;
  teile.push(`<g stroke="#5E5E5E" stroke-width="4"><line x1="${xm}" y1="0" x2="${xm}" y2="${gesamt}"/>`
    + `<line x1="${xm - t}" y1="0" x2="${xm + t}" y2="0"/><line x1="${xm - t}" y1="${gesamt}" x2="${xm + t}" y2="${gesamt}"/></g>`);
  teile.push(`<text x="${xm - 30}" y="${gesamt / 2}" font-size="${fs}" fill="#5E5E5E" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" `
    + `transform="rotate(-90 ${xm - 30} ${gesamt / 2})">${de(gesamt)} mm</text>`);
  const kopfY = -fs * 1.2;
  teile.push(`<text x="${x0}" y="${kopfY}" font-size="${fs}" fill="#5E5E5E" font-family="ui-monospace, Menlo, monospace">Innen</text>`);
  teile.push(`<text x="${x0}" y="${gesamt + fs * 1.6}" font-size="${fs}" fill="#5E5E5E" font-family="ui-monospace, Menlo, monospace">${r.fassade?.schichten?.length ? "Außen" : "Gegenseite"}</text>`);

  const defs = `<defs><pattern id="luft" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<rect width="24" height="24" fill="#FDFDFD"/><line x1="0" y1="0" x2="0" y2="24" stroke="#A7A7A6" stroke-width="3"/></pattern></defs>`;
  const links = x0 - 90 - fs * 1.6, oben = Math.min(kopfY - fs, -r0 - 10), rechts = xk + r0 + 20;
  const unten = Math.max(gesamt + fs * 2.2, textEnde);
  const vb = `${links} ${oben} ${rechts - links} ${unten - oben}`;
  el.innerHTML = `<svg viewBox="${vb}" role="img" aria-label="Wandschnitt, Aufbau ${de(gesamt)} mm, ${eintraege.length} Schichten von innen nach außen">${defs}${teile.join("")}</svg>`
    + `<ol class="schnitt-liste">${eintraege.map((e) => `<li><span class="mono">${de(e.dicke)} mm</span> ${esc(e.namen.join(" + "))}</li>`).join("")}</ol>`;
  return { gesamt_mm: gesamt, schichten: eintraege.length };
}
