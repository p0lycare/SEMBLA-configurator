// Wärmeschutz der Außenwand: U-Wert nach DIN EN ISO 6946 (oberer und unterer Grenzwert für
// inhomogene Schichten, Mittelwert), punktförmige Wärmebrücken der Wandhalter als Zuschlag.
// Die Dämmstärken werden je Fassade aus `daemmstufen` gewählt: die dünnste Kombination, die das
// Ziel und den Tauwasserschutz nach DIN 4108-3 erfüllt (siehe feuchte.js). Reines Modul ohne DOM.

import { feuchteschutz } from "./feuchte.js";
import { schraubenlaenge } from "./aufbau-geometrie.js";

/**
 * Aufbau mit Dämmstärke d (Gefach) und da (Platte außen, `daemmstufen.aussen`): die Stufen-
 * schichten bekommen ihre Dicke, `{d}` und `{da}` im Namen werden ersetzt.
 */
export function mitDaemmung(aufbau, d, da) {
  const st = aufbau && aufbau.daemmstufen;
  if (!st) return aufbau;
  const aussen = st.aussen;
  const dA = aussen ? da ?? aussen.dicken[0] : null;
  const schichten = aufbau.schichten.map((s) => {
    if (aussen && s.id === aussen.schicht) return { ...s, dicke: dA, name: s.name.replace("{da}", String(dA)) };
    if (!(s.id in st.schichten)) return s;
    const dicke = d + st.schichten[s.id];
    return { ...s, dicke, name: s.name.replace("{d}", String(dicke)) };
  });
  return { ...aufbau, schichten, daemmung_mm: d, daemmung_aussen_mm: dA };
}

/** Dämmstärken als Text, z. B. „60 + 120 mm“ (Gefach + Platte außen) oder „140 mm“. */
export function daemmText(aufbau) {
  return aufbau.daemmung_aussen_mm ? `${aufbau.daemmung_mm} + ${aufbau.daemmung_aussen_mm} mm` : `${aufbau.daemmung_mm} mm`;
}

/** Die Dämmschicht, deren Dicke die Stufe bestimmt (erste Stufenschicht mit Wärmeleitfähigkeit). */
export function daemmschicht(aufbau) {
  const ids = Object.keys(aufbau?.daemmstufen?.schichten || {});
  return aufbau?.schichten.find((s) => ids.includes(s.id) && s.lambda && s.art !== "staender") || null;
}

/** Zonen gleicher Tiefe (eine Schicht plus die mit `parallel` danebenliegenden) mit Wärmeleitung. */
function zonen(schichten, achsraster) {
  const liste = [];
  for (const s of schichten) {
    if (!s.parallel || !liste.length) liste.push([]);
    liste[liste.length - 1].push(s);
  }
  return liste.map((zone) => {
    const mitLambda = zone.filter((s) => s.lambda);
    if (!mitLambda.length) return null;
    const d = Math.max(...mitLambda.map((s) => s.dicke)) / 1000;
    // Stäbe (Ständer, Latten) belegen breite/achsraster der Fläche, der Rest ist Gefach.
    const staebe = mitLambda.filter((s) => s.breite && (s.art === "staender" || s.art === "latte_v"));
    const gefache = mitLambda.filter((s) => !staebe.includes(s));
    if (gefache.length > 1 || staebe.length > 1) throw new Error(`Zone ${zone.map((s) => s.id)}: nicht unterstützte Schichtkombination`);
    const gefach = gefache[0];
    const teile = staebe.map((s) => ({ anteil: s.breite / achsraster, R: d / s.lambda }));
    const rest = 1 - teile.reduce((a, t) => a + t.anteil, 0);
    if (gefach) teile.push({ anteil: rest, R: d / gefach.lambda });
    else teile.push({ anteil: rest, R: staebe[0].r_zwischenraum ?? 0.18 });   // ruhende Luftschicht
    return { d, teile };
  }).filter(Boolean);
}

/**
 * U-Wert in W/(m²K). kennwerte aus aufbauten.json (`waerme`): Rsi, Rse, Steinwiderstand,
 * Wärmebrücke je Wandhalter und Halter je m².
 */
export function uWert(fassade, innen, kw, halterJeM2 = kw.halter.je_m2) {
  const z = [
    ...zonen(innen?.schichten || [], innen?.achsraster_mm || 625),
    { teile: [{ anteil: 1, R: kw.stein.R }] },
    ...zonen(fassade?.schichten || [], fassade?.achsraster_mm || 625),
  ];
  const Rse = fassade?.hinterlueftet ? kw.Rse_hinterlueftet : kw.Rse;
  // Oberer Grenzwert: parallele Wärmepfade über alle Kombinationen der Zonenteile.
  let pfade = [{ anteil: 1, R: kw.Rsi + Rse }];
  for (const zone of z) pfade = pfade.flatMap((p) => zone.teile.map((t) => ({ anteil: p.anteil * t.anteil, R: p.R + t.R })));
  const Ro = 1 / pfade.reduce((a, p) => a + p.anteil / p.R, 0);
  // Unterer Grenzwert: je Zone flächengewichteter Leitwert.
  const Ru = kw.Rsi + Rse + z.reduce((a, zone) => a + 1 / zone.teile.reduce((b, t) => b + t.anteil / t.R, 0), 0);
  const RT = (Ro + Ru) / 2;
  const halter = (fassade?.schichten || []).some((s) => s.art === "halter");
  const zuschlag = halter ? kw.halter.chi_W_K * halterJeM2 : 0;
  const schrauben = befestigerZuschlag(fassade, RT);
  return { U: 1 / RT + zuschlag + schrauben, RT, zuschlag, schrauben, halterJeM2: halter ? halterJeM2 : 0 };
}

/**
 * Befestiger, die eine Dämmschicht ganz durchdringen (Holzbauschrauben der Konterlatte durch die
 * Holzfaserplatte), nach DIN EN ISO 6946 Anhang F: ΔUf = α · λf · Af · nf / d0 · (R1 / RT)², α = 0,8.
 */
function befestigerZuschlag(fassade, RT) {
  const sc = fassade?.schraube;
  if (!sc || !sc.lambda || !sc.abstand_mm) return 0;
  const platte = fassade.schichten.find((s) => sc.durch.includes(s.id) && s.lambda);
  if (!platte) return 0;
  const d0 = platte.dicke / 1000, R1 = d0 / platte.lambda;
  const Af = Math.PI * (sc.durchmesser_mm / 2000) ** 2;
  const nf = 1 / ((fassade.achsraster_mm / 1000) * (sc.abstand_mm / 1000));   // je Konterlatte alle `abstand_mm`
  return 0.8 * sc.lambda * Af * nf / d0 * (R1 / RT) ** 2;
}

/**
 * Schichten, die nur ohne luftdichte Innenseite gebraucht werden (die Dampfbremse als luftdichte
 * Ebene), entfallen bei verputzter Innenseite. Dort bremst der Stein (sd ≈ 1,9 m) den Dampf, und
 * eine kalte Bahn mitten im Aufbau würde nur Tauwasser sammeln.
 */
export function fuerInnen(fassade, innen) {
  if (!fassade || !innen?.luftdicht || !fassade.schichten.some((s) => s.nur_ohne_luftdichte_innenseite)) return fassade;
  return { ...fassade, schichten: fassade.schichten.filter((s) => !s.nur_ohne_luftdichte_innenseite) };
}

/** Bewertet einen Aufbau mit festen Dämmstärken: U-Wert, Ziel erfüllt, Tauwasserschutz. */
export function bewerten(fassade, innen, kw, ziel, halterJeM2 = kw.halter.je_m2, d = null, da = null) {
  const aufbau = fuerInnen(fassade?.daemmstufen ? mitDaemmung(fassade, d ?? fassade.daemmstufen.dicken[0], da) : fassade, innen);
  const u = uWert(aufbau, innen, kw, halterJeM2);
  const feuchte = aufbau?.schichten.length && kw.feuchte ? feuchteschutz(aufbau, innen, kw) : null;
  return { aufbau, ...u, ziel, erfuellt: u.U <= ziel, daemmung_mm: aufbau?.daemmung_mm || 0,
    daemmung_aussen_mm: aufbau?.daemmung_aussen_mm ?? null, feuchte };
}

/**
 * Wählt für das Ziel (W/(m²K)) die dünnste Kombination der Dämmstufen, die auch den Tauwasser-
 * schutz einhält und eine Handelslänge der Fassadenschraube zulässt; bei gleicher Gesamtdicke die
 * mit mehr Gefachdämmung. Erreicht keine das Ziel, die mit dem kleinsten U-Wert und intaktem
 * Feuchteschutz. Ohne Stufen bleibt der Aufbau, wie er ist.
 * halterJeM2: tatsächliche Halter je m² Wandfläche (ein Halter je FA-Verbinder).
 * Rückgabe: { aufbau, U, ziel, erfuellt, daemmung_mm, daemmung_aussen_mm, feuchte }
 */
export function auslegen(fassade, innen, kw, ziel, halterJeM2 = kw.halter.je_m2) {
  const st = fassade && fassade.daemmstufen;
  if (!st) return bewerten(fassade, innen, kw, ziel, halterJeM2);
  const kandidaten = [];
  for (const d of st.dicken) for (const da of st.aussen ? st.aussen.dicken : [null]) {
    const a = mitDaemmung(fassade, d, da);
    if (a.schraube && !schraubenlaenge(a).laenge_mm) continue;
    kandidaten.push({ ...bewerten(fassade, innen, kw, ziel, halterJeM2, d, da), summe: d + (da || 0) });
  }
  if (!kandidaten.length) return bewerten(fassade, innen, kw, ziel, halterJeM2);
  const feuchteOk = kandidaten.filter((k) => !k.feuchte || k.feuchte.tauwasserOk);
  const passend = feuchteOk.filter((k) => k.erfuellt).sort((a, b) => a.summe - b.summe || b.daemmung_mm - a.daemmung_mm);
  if (passend.length) return passend[0];
  const pool = feuchteOk.length ? feuchteOk : kandidaten;
  return pool.reduce((a, b) => (b.U < a.U ? b : a));
}
