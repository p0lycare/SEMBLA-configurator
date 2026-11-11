// Vorbemessung der Verbinder FA und IA je Verbinder: Einflussfläche aus der Lage auf der Achse,
// Windsog (nur außen), Eigengewicht und dessen Ausmitte, Interaktion von Zug und Querlast. Wo ein
// Verbinder überlastet ist, setzt `auslegen` auf derselben Achse weitere Verbinder in freie Nut-
// positionen (Steinmitte, nicht in der Stoßfuge, nicht in Öffnung oder Ausgleichslage), bis alle
// halten oder keine Position mehr frei ist. Kennwerte: `verbinder` in aufbauten.json. Ohne DOM.

import { schichtLagen } from "./aufbau-geometrie.js";

/** Freie Verbinderhöhen (Lagenmitte, mm) auf der Nut x: x liegt in dieser Lage innerhalb eines Steins. */
export function freieHoehen(w, x) {
  return w.courses
    .filter((c) => !c.ausgleich && c.stones.some((s) => s.x0 + 1 < x && x < s.x1 - 1))
    .map((c) => (c.unterkante_mm + c.oberkante_mm) / 2);
}

/** Ausmitte (mm) des Eigengewichts: Steinoberfläche bzw. Fußauflager bis Mitte der Bekleidung. */
function ausmitten(aufbau) {
  const lagen = schichtLagen(aufbau.schichten);
  if (!lagen.length) return { frei: 0, getragen: 0 };
  const mitte = (s) => (s.z0 + s.z1) / 2;
  const bekleidung = lagen[lagen.length - 1];
  // Das Fußauflager steht unter der senkrechten Latte (Mock-up); darüber kragt nur die Bekleidung aus.
  const auflager = lagen.find((s) => s.id === aufbau.belueftung_ab) || lagen[0];
  return { frei: mitte(bekleidung), getragen: Math.max(0, mitte(bekleidung) - mitte(auflager)) };
}

/**
 * Nachweis aller Verbinder einer Seite. seite: "FA" | "IA"; punkte: [{x, y}] in mm; ver: Ableitung
 * aus Modul 2 (achsen, segmente). Rückgabe je Verbinder N, V (kN) und η = ((N/N_Rd)^1,5 + (V/V_Rd)^1,5)^(1/1,5).
 */
export function nachweis(w, ver, punkte, aufbau, seite, kv) {
  const L = w.length_mm, lt = kv.last, rd = kv.rd_kN, p = kv.interaktion_exponent || 1.5;
  const g = (aufbau.flaechengewicht_kg_m2 || 0) / 100;                       // kN/m²
  const sog = seite === "FA" ? lt.gamma_Q * Math.abs(lt.cpe1) * lt.qp_kN_m2 : 0;
  // Die Schraube zum KVH bzw. zur Latte spannt den Verbinder in der Nut mit. Schwindet das Holz,
  // lässt die Klemmung entlang der Nut nach; darum tragen Auflager das Eigengewicht, außen das
  // Fußauflager, innen die Schwelle. Zug hält der Verbinder formschlüssig.
  const fuss = seite === "FA" ? kv.fussauflager : kv.schwelle_innen;
  const e = ausmitten(aufbau);
  const achsen = [...ver.achsen].sort((a, b) => a - b);
  const breite = (x) => {
    const i = achsen.indexOf(x);
    const links = i > 0 ? (x - achsen[i - 1]) / 2 : x;
    const rechts = i < achsen.length - 1 ? (achsen[i + 1] - x) / 2 : L - x;
    return links + rechts;
  };
  // Lattenstränge: übereinander stoßende Segmente einer Achse tragen gemeinsam.
  const straenge = [];
  for (const s of [...ver.segmente].sort((a, b) => a.x - b.x || a.y0 - b.y0)) {
    const vorher = straenge[straenge.length - 1];
    if (vorher && vorher.x === s.x && Math.abs(vorher.y1 - s.y0) < 1) vorher.y1 = s.y1;
    else straenge.push({ x: s.x, y0: s.y0, y1: s.y1 });
  }
  const ergebnis = [];
  for (const st of straenge) {
    const pts = punkte.filter((q) => q.x === st.x && q.y >= st.y0 - 1 && q.y <= st.y1 + 1).sort((a, b) => a.y - b.y);
    if (!pts.length) continue;
    // Am Wandfuß steht der Strang auf dem Fußauflager, über einer Öffnung auf dem Sturzauflager
    // (Winkel bzw. Wechsel zu den Nachbarachsen); ohne Auflager hängt er an den Verbindern.
    const getragen = fuss && (st.y0 < 1 || !!kv.sturzauflager);
    const b = breite(st.x);
    const flaechen = pts.map((q, i) => {
      const unten = i ? (pts[i - 1].y + q.y) / 2 : st.y0, oben = i < pts.length - 1 ? (q.y + pts[i + 1].y) / 2 : st.y1;
      return b * (oben - unten) / 1e6;
    });
    // Eigengewicht des Strangs mit Ausmitte: Zug in den Verbindern linear zum Abstand vom Fußpunkt,
    // dort drückt die Latte gegen die Wand (bzw. steht auf dem Fußauflager).
    const G = flaechen.reduce((a, A) => a + lt.gamma_G * g * A, 0);
    const M = G * (getragen ? e.getragen : e.frei) / 1000;
    const hebel = pts.map((q) => Math.max(q.y - st.y0, 100) / 1000);
    const summe = hebel.reduce((a, h) => a + h * h, 0);
    pts.forEach((q, i) => {
      const N = sog * flaechen[i] + (summe ? M * hebel[i] / summe : 0);
      const V = getragen ? 0 : lt.gamma_G * g * flaechen[i];
      const bN = N / rd.zug, bV = V / rd.quer_parallel;
      ergebnis.push({ x: q.x, y: q.y, A: flaechen[i], N, V, bN, bV, eta: (bN ** p + bV ** p) ** (1 / p), getragen });
    });
  }
  return ergebnis;
}

/**
 * Prüft die Verbinder aus Modul 2 und ergänzt auf überlasteten Achsen freie Positionen.
 * Rückgabe: { punkte, nachweis, ergaenzt, max, massgebend, offen }
 */
export function auslegen(w, ver, aufbau, seite, kv) {
  const punkte = ver.punkte.map((q) => ({ ...q }));
  const lage = (y) => w.courses.findIndex((c) => c.unterkante_mm <= y && y < c.oberkante_mm);
  const gesperrt = new Set();
  let ergaenzt = 0, liste = nachweis(w, ver, punkte, aufbau, seite, kv);
  for (let runde = 0; runde < 200; runde++) {
    const schlimm = liste.filter((r) => r.eta > 1 && !gesperrt.has(`${r.x}|${r.y}`)).sort((a, b) => b.eta - a.eta)[0];
    if (!schlimm) break;
    const strang = ver.segmente.find((s) => s.x === schlimm.x && s.y0 <= schlimm.y && schlimm.y <= s.y1);
    const belegt = punkte.filter((q) => q.x === schlimm.x).map((q) => q.y).sort((a, b) => a - b);
    const i = belegt.indexOf(schlimm.y);
    const unten = i > 0 ? belegt[i - 1] : strang ? strang.y0 : schlimm.y, oben = i < belegt.length - 1 ? belegt[i + 1] : strang ? strang.y1 : schlimm.y;
    const frei = freieHoehen(w, schlimm.x).filter((y) => strang && y > strang.y0 && y < strang.y1 && !belegt.includes(y));
    // In die größere Lücke neben dem überlasteten Verbinder, möglichst mittig.
    const luecken = [[unten, schlimm.y], [schlimm.y, oben]].sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    let neu = null;
    for (const [a, b] of luecken) {
      const kandidaten = frei.filter((y) => y > a && y < b).sort((p, q) => Math.abs(p - (a + b) / 2) - Math.abs(q - (a + b) / 2));
      if (kandidaten.length) { neu = kandidaten[0]; break; }
    }
    if (neu == null) { gesperrt.add(`${schlimm.x}|${schlimm.y}`); continue; }
    punkte.push({ x: schlimm.x, y: neu, lage: lage(neu), ergaenzt: true });
    ergaenzt++;
    liste = nachweis(w, ver, punkte, aufbau, seite, kv);
  }
  const massgebend = liste.reduce((a, r) => (!a || r.eta > a.eta ? r : a), null);
  return { punkte, nachweis: liste, ergaenzt, max: massgebend ? massgebend.eta : 0, massgebend, offen: liste.filter((r) => r.eta > 1 + 1e-9) };
}

/** Höchster zulässiger Böenstaudruck q_p (kN/m²) für die gewählte Verbinderlage, nur Windsog betrachtet. */
export function qpGrenze(ergebnis, kv) {
  const lt = kv.last, p = kv.interaktion_exponent || 1.5;
  let grenze = Infinity;
  for (const r of ergebnis.nachweis) {
    if (!r.A) continue;
    // N = N_sog · q/q0 + N_eigen; Grenze aus (N/N_Rd)^p + bV^p = 1
    const rest = 1 - r.bV ** p;
    if (rest <= 0) return 0;
    const nMax = rest ** (1 / p) * kv.rd_kN.zug;
    const nSog = lt.gamma_Q * Math.abs(lt.cpe1) * r.A;
    const nEigen = r.N - nSog * lt.qp_kN_m2;
    grenze = Math.min(grenze, (nMax - nEigen) / nSog);
  }
  return grenze;
}
