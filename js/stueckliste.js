// Stückliste des Konfigurators: Wand und Spannsystem aus dem Rechenkern (exakt), Verbinder aus
// der Aufbau-Ableitung, Fassade und Innenausbau als überschlägige Mengen aus den Schichten.

import { wirksameZwischenpunkte, GRID } from "./sembla-core.js";
import { schichtLagen, VERBINDERSCHRAUBEN } from "./wand.js";
import { traglattenReihen } from "./aufbau-geometrie.js";

const lfm = (mm) => mm / 1000;

/** Fläche eines Rechtecks [x0,x1]×[y0,y1] ohne die Öffnungen, in mm². */
function nettoFlaeche(w, x0, x1, y0, y1) {
  let a = (x1 - x0) * (y1 - y0);
  for (const op of w.openings) {
    const ox0 = Math.max(x0, op.g0 * GRID), ox1 = Math.min(x1, op.g1 * GRID);
    const oy0 = Math.max(y0, w.courses[op.l0].unterkante_mm), oy1 = Math.min(y1, w.courses[op.l1 - 1].oberkante_mm);
    if (ox1 > ox0 && oy1 > oy0) a -= (ox1 - ox0) * (oy1 - oy0);
  }
  return a;
}

function zaehle(liste, schluessel) {
  const m = new Map();
  for (const x of liste) m.set(schluessel(x), (m.get(schluessel(x)) || 0) + 1);
  return [...m.entries()].sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
}

function wandTeile(r) {
  const { w } = r;
  const teile = [];
  const ausgleich = w.courses.find((c) => c.ausgleich);
  for (const typ of ["i3", "i2"]) {
    const regel = w.courses.filter((c) => !c.ausgleich).reduce((a, c) => a + c.stones.filter((s) => s.type === typ).length, 0);
    teile.push({ symbol: typ, name: `SEMBLA ${typ}`, menge: regel, einheit: "Stk",
      detail: typ === "i3" ? "375 × 125 × 200 mm, Regelstein" : "250 × 125 × 200 mm, Wandenden" });
    if (ausgleich) {
      const n = ausgleich.stones.filter((s) => s.type === typ).length;
      if (n) teile.push({ symbol: typ, name: `${typ} Ausgleichsstein`, menge: n, einheit: "Stk",
        detail: `Sonderzuschnitt, Höhe ${ausgleich.hoehe_mm} mm` });
    }
  }
  return teile;
}

function spannTeile(r) {
  const { w } = r;
  const b = w.bom;
  const stuecke = w.tension_columns.flatMap((c) => c.segments.flatMap((s) => s.stuecke || []));
  // Gruppiert nach Länge und Art: Standardlänge, Sonderzuschnitt, Spannstück oben am Strang.
  const ART = { standard: "", sonder: ", Zuschnitt", rest: ", Spannstück oben" };
  const teile = zaehle(stuecke, (s) => `${s.len_mm}|${s.art}`).map(([schluessel, n]) => {
    const [len, art] = schluessel.split("|");
    return { symbol: "stange", name: "Gewindestange M10", menge: n, einheit: "Stk", detail: `${len} mm${ART[art] ?? ""}`, laenge: +len, art };
  });
  const zp = wirksameZwischenpunkte(w).length;
  teile.push(
    { symbol: "kopplungsmutter", name: "Kopplungsmutter M10", menge: b.kopplungsmuttern_basis + b.verbindungsmuttern, einheit: "Stk",
      detail: `${b.kopplungsmuttern_basis} am Fuß, ${b.verbindungsmuttern} an Stößen` },
    { symbol: "sechskant", name: "Sechskantschraube M10 × 30", menge: b.senkkopfschrauben, einheit: "Stk", detail: "DIN 933, von unten durchs Bodenblech" },
  );
  if (zp) teile.push({ symbol: "einlegeblech", name: "Einlegeblech mit Mutter", menge: zp, einheit: "Stk", detail: "Zwischenspannpunkt" });
  teile.push(
    { symbol: "spannplatte", name: "Spannplatte", menge: b.spannplatten, einheit: "Stk", detail: "120 × 120 × 10 mm" },
    { symbol: "mutter", name: "Spannmutter M10", menge: b.spannmuttern, einheit: "Stk", detail: "eine je Spannplatte" },
  );
  return teile;
}

/** Boden- und Deckenanschluss: Bodenbleche, Ausgleichsbleche, Deckenwinkel (Lieferung Polycare). */
function anschlussTeile(r) {
  const { w } = r;
  const teile = [];
  for (const [len, n] of zaehle(w.base_plate.teile, (t) => t.bauteil_mm)) {
    teile.push({ symbol: "bodenblech", name: "Bodenblech", menge: n, einheit: "Stk", detail: `${len} × 125 mm`, laenge: len });
  }
  teile.push({ symbol: "ausgleichsblech", name: "Ausgleichsblech", menge: w.ausgleichspunkte.length, einheit: "Stk", detail: "20 × 100 × 8 mm" });
  if (w.deckenanschlusspunkte.length)
    teile.push({ symbol: "deckenanschluss", name: "Deckenanschluss", menge: w.deckenanschlusspunkte.length, einheit: "Stk", detail: "Winkel auf Spannachse" });
  return teile;
}

/** Bauseits am Wandfuß: Bett aus Vergussmasse unter den Bodenblechen. */
function untergrundTeile(r) {
  // Die Menge hängt von der Ebenheit des Untergrunds ab, darum nur die Länge als Richtwert.
  return [{ symbol: "verguss", name: "Vergussmasse unter den Bodenblechen", menge: Math.round(r.w.length_mm / 100) / 10, einheit: "lfm", ca: true,
    detail: "Bett je nach Ebenheit des Untergrunds" }];
}

/** Ausbauteile einer Seite. ver = Verbinderableitung (r.fa / r.ia). */
function ausbauTeile(r, aufbau, ver, seite) {
  const { w } = r;
  const L = w.length_mm, H = w.height_mm;
  const teile = [];
  if (!aufbau.schichten.length) return teile;
  const holz = aufbau.uk !== "alu";
  teile.push({ symbol: "verbinder", name: seite === "aussen" ? "Verbinder FA, Fassade" : "Verbinder IA, innen", menge: ver.punkte.length, einheit: "Stk",
    detail: "lösbar, in der Nut", seite });
  teile.push({ symbol: "schraube", name: `Verbinderschraube M6, ${seite === "aussen" ? "Fassade" : "innen"}`, menge: ver.punkte.length, einheit: "Stk",
    detail: seite === "aussen" ? (holz ? VERBINDERSCHRAUBEN.fa : "zum Wandhalter, Länge prüfen") : VERBINDERSCHRAUBEN.ia, seite });

  const segLaenge = ver.segmente.reduce((a, s) => a + s.y1 - s.y0, 0);
  for (const s of schichtLagen(aufbau.schichten)) {
    const t = { name: s.name, material: s.material, art: s.art, ca: true, ...(s.einbau ? { einbau: s.einbau } : {}) };
    switch (s.art) {
      case "staender":
      case "latte_v":
        Object.assign(t, { menge: lfm(segLaenge), einheit: "lfm", detail: `${ver.segmente.length} Stück auf ${ver.achsen.length} Achsen`, ca: false });
        break;
      case "latte_h": {
        const reihen = traglattenReihen(H, s).length;
        Object.assign(t, { menge: lfm(nettoFlaeche(w, 0, L, 0, H) / H * reihen), einheit: "lfm", detail: `${reihen} Reihen` });
        break;
      }
      case "feld":
      case "platte": {
        // Gefachdämmung: ohne den Anteil der Ständer bzw. Latten (Breite je Achsraster).
        const staender = s.art === "feld" && aufbau.schichten.find((x) => x.art === "staender" || x.art === "latte_v");
        const anteil = staender && aufbau.achsraster_mm ? 1 - staender.breite / aufbau.achsraster_mm : 1;
        Object.assign(t, { menge: nettoFlaeche(w, 0, L, 0, H) / 1e6 * anteil, einheit: "m²", detail: `${String(s.dicke).replace(".", ",")} mm` });
        break;
      }
      case "halter":
        Object.assign(t, { menge: ver.punkte.length, einheit: "Stk", detail: "je Verbinder einer", ca: false });
        break;
      case "schindel":
        Object.assign(t, { menge: Math.ceil(nettoFlaeche(w, 0, L, 0, H) / (s.breite * s.deckung)), einheit: "Stk", detail: `${s.breite} × ${s.hoehe} mm` });
        break;
      case "leiste_h": {
        const reihen = Math.ceil(H / (s.hoehe + s.fuge));
        Object.assign(t, { menge: lfm(nettoFlaeche(w, 0, L, 0, H) / H * reihen), einheit: "lfm", detail: `${s.dicke} × ${s.hoehe} mm` });
        break;
      }
      case "paneel":
        Object.assign(t, { menge: Math.ceil(nettoFlaeche(w, 0, L, 0, H) / (s.breite * s.hoehe)), einheit: "Stk", detail: `${s.breite} × ${s.hoehe} mm`, hoch: s.hoehe > s.breite });
        break;
    }
    t.symbol = s.art;
    teile.push(t);
  }
  if (aufbau.schraube && r.schraube && r.schraube.laenge_mm && seite === "aussen") {
    const konter = aufbau.schichten.find((s) => s.id === aufbau.schraube.durch[0]);
    if (konter) teile.push({ symbol: "schraube", name: `Holzbauschraube ${r.schraube.durchmesser_mm} × ${r.schraube.laenge_mm}`,
      menge: Math.ceil(lfm(segLaenge) / 0.3), einheit: "Stk", detail: `${konter.name.split(" ")[0]} → KVH, etwa alle 30 cm`, ca: true, material: "stahl" });
  }
  if (seite === "aussen" && holz) {
    // Eigengewicht über Auflager statt über die Verbinder (Verbinder-Vorbemessung, verbinder.js).
    const fuss = ver.segmente.filter((s) => s.y0 < 1).length, sturz = ver.segmente.length - fuss;
    teile.push({ symbol: "winkel", name: "Fußauflager", menge: fuss, einheit: "Stk", detail: "Stahlwinkel unter senkrechter Latte und KVH, je Achse", material: "stahl" });
    if (sturz) teile.push({ symbol: "winkel", name: "Auflager über Öffnung", menge: sturz, einheit: "Stk", detail: "Winkel am Sturz oder Wechsel zur Nachbarachse", material: "stahl" });
  }
  if (seite === "innen" && aufbau.schichten.some((s) => s.art === "latte_v")) {
    // Die Latten stehen auf einer Schwelle; über Öffnungen ein Riegel bzw. Wechsel (verbinder.js).
    let laenge = L;
    for (const op of w.openings) if (op.art === "tuer") laenge -= (op.g1 - op.g0) * GRID;
    const latte = aufbau.schichten.find((s) => s.art === "latte_v");
    teile.push({ symbol: "latte_h", art: "schwelle", name: `Schwelle ${latte.dicke} × ${latte.breite}`, material: "holz", menge: lfm(laenge), einheit: "lfm",
      detail: "am Boden, die Latten stehen darauf" });
    const sturz = ver.segmente.filter((s) => s.y0 >= 1).length;
    if (sturz) teile.push({ symbol: "winkel", name: "Auflager über Öffnung", menge: sturz, einheit: "Stk", detail: "Riegel bzw. Wechsel zur Nachbarlatte", material: "holz" });
  }
  if (seite === "aussen" && aufbau.belueftung_ab) {
    // Zu- und Abluft der Hinterlüftung: unten und oben über die Wandlänge, unter und über Fenstern,
    // über Türen; am Wandfuß unterbricht die Tür das Profil.
    let laenge = 2 * L;
    for (const op of w.openings) {
      const b = (op.g1 - op.g0) * GRID;
      laenge += op.art === "tuer" ? 0 : 2 * b;
    }
    teile.push({ symbol: "lueftung", name: "Lüftungsprofil mit Insektenschutz", menge: lfm(laenge), einheit: "lfm",
      detail: "Zu- und Abluft unten, oben und an Öffnungen, ≥ 50 cm²/m (DIN 18516-1)", material: "alu" });
  }
  return teile;
}

/**
 * Stückliste in Gruppen. lieferung: "polycare" (Lieferumfang Polycare) oder "bauseits"
 * (beispielhaft, Richtwerte). Verbinder und ihre Schrauben stehen in der Gruppe „Verbinder“
 * und tragen `seite` ("aussen" | "innen"), damit das LV sie der Fassade bzw. Innenseite zuordnet.
 */
export function stueckliste(r, fassade, innen) {
  const aussen = ausbauTeile(r, fassade, r.fa, "aussen"), drinnen = ausbauTeile(r, innen, r.ia, "innen");
  const istVerbinder = (t) => !!t.seite;   // nur Verbinder und Verbinderschrauben tragen eine Seite
  const gruppen = [
    { id: "wand", lieferung: "polycare", titel: "SEMBLA-Steine", teile: wandTeile(r) },
    { id: "spann", lieferung: "polycare", titel: "Spannsystem", teile: spannTeile(r) },
    { id: "anschluss", lieferung: "polycare", titel: "Boden- und Deckenanschluss", teile: anschlussTeile(r) },
    { id: "verbinder", lieferung: "polycare", titel: "Verbinder", teile: [...aussen, ...drinnen].filter(istVerbinder) },
    { id: "untergrund", lieferung: "bauseits", titel: "Untergrund", teile: untergrundTeile(r) },
    { id: "fassade", lieferung: "bauseits", titel: `Fassade · ${fassade.name}`, teile: aussen.filter((t) => !istVerbinder(t)) },
    { id: "innen", lieferung: "bauseits", titel: `Innenseite · ${innen.name}`, teile: drinnen.filter((t) => !istVerbinder(t)) },
  ];
  return gruppen.filter((g) => g.teile.some((t) => t.menge > 0)).map((g) => ({ ...g, teile: g.teile.filter((t) => t.menge > 0) }));
}

export const LIEFERUNG = { polycare: "Lieferung Polycare", bauseits: "Bauseits, Richtwerte" };

/** CSV (Semikolon, deutsches Dezimalkomma) für den Download. */
export function alsCsv(gruppen) {
  const zeilen = [["Lieferung", "Gruppe", "Teil", "Menge", "Einheit", "Angabe", "überschlägig"]];
  for (const g of gruppen) for (const t of g.teile) {
    const menge = Number.isInteger(t.menge) ? String(t.menge) : t.menge.toFixed(2).replace(".", ",");
    zeilen.push([LIEFERUNG[g.lieferung], g.titel, t.name, menge, t.einheit, t.detail || "", t.ca ? "ja" : "nein"]);
  }
  return zeilen.map((z) => z.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
