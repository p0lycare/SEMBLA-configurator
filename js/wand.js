// Fachlogik des Konfigurators: aus den Eingaben ein Wandelement (Rechenkern der Planungs-Suite),
// die Verbinderplanung (Modul 2 der Suite) und die Aufbauableitung. Reines Modul ohne DOM, damit
// es in Node getestet werden kann.

import { buildWall, Opening, GRID, THICK, FORBIDDEN_N } from "./sembla-core.js";
import { berechneAufbau } from "./sembla-aufbau.js";
import { auslegen, bewerten, daemmText } from "./waerme.js";
import { auslegen as verbinderAuslegen, qpGrenze } from "./verbinder.js";
import { schichtLagen, aufbauDicke, schraubenlaenge } from "./aufbau-geometrie.js";

export { schichtLagen, aufbauDicke, schraubenlaenge };

export const GRENZEN = { laengeMin: 1000, laengeMax: 12000, hoeheMin: 2400, hoeheMax: 5000 };

// Annahmen (mit Planungsteam prüfen): Fuge zwischen Wandkrone und Rohdecke, und ab welcher
// Resthöhe eine Ausgleichslage gesetzt wird. Darunter wird die Deckenfuge entsprechend größer.
export const DECKENFUGE_MM = 20;

// Gewindestangen wie im Standardkatalog der Planungs-Suite (1050 mm, Spannstück 100 mm oben,
// 10 mm Überstand) plus 600 mm als zweite Standardlänge: damit bleibt nach [Z-5] kein Zuschnitt
// unter 200 mm (Empfehlung an das Suite-Team, 03.11.2026). Spannplatte als oberer Anschluss.
export const VORSPANNUNG = { rod_lengths_mm: [1050, 600], rod_rest_mm: 100, rod_overhang_mm: 10, top_connection: "spannplatte" };
export const AUSGLEICH_MIN_MM = 60;

// Kennwerte der Rohwand (sembla.de/produkt).
export const ROHWAND = { flaechengewicht_kg_m2: 167, schalldaemmmass_db: 47, brandschutz: "F60" };

// Öffnungen im Raster: Breite in Rastern (12,5 cm), Unterkante (Brüstung) und Höhe in Lagen (20 cm).
// Voreinstellung und wählbarer Bereich. Breite Öffnungen prüft das Planungsteam (Sturz).
export const OEFFNUNGEN = {
  tuer: { name: "Tür", breite_grid: 8, l0: 0, lagen: 11, max: 4,
    bereich: { b: [6, 16], h: [10, 13], u: [0, 0] } },
  fenster: { name: "Fenster", breite_grid: 8, l0: 4, lagen: 6, max: 8,
    bereich: { b: [4, 20], h: [2, 10], u: [1, 7] } },
};

/** Maße einer Öffnung aus der Eingabe {art, b?, h?, u?}, auf den wählbaren Bereich begrenzt. */
export function oeffnungsMasse(o) {
  const def = OEFFNUNGEN[o.art], B = def.bereich;
  const in_ = (x, [a, z], std) => (Number.isInteger(x) ? Math.min(Math.max(x, a), z) : std);
  return { b: in_(o.b, B.b, def.breite_grid), h: in_(o.h, B.h, def.lagen), u: in_(o.u, B.u, def.l0) };
}

/** Maßtext, z. B. „1,00 × 2,20 m“ bzw. „1,00 × 1,20 m, Brüstung 0,80 m“. */
export function masseText(o) {
  const { b, h, u } = oeffnungsMasse(o);
  const z = (mm) => (mm / 1000).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  return `${z(b * GRID)} × ${z(h * 200)} m${o.art === "fenster" ? `, Brüstung ${z(u * 200)} m` : ""}`;
}

// Mindestbreite der Wandstücke neben und zwischen Öffnungen (2 Raster = ein i2).
const RAND_MIN_GRID = 2;

// Verbinderschrauben aus dem Mock-up der Demowand: Maschinenschrauben M6, sie gehen durch das Holz
// in den Verbinder (nicht ins Holz geschraubt).
export const VERBINDERSCHRAUBEN = { fa: "M6 × 75 (durch das KVH)", ia: "M6 × 45 (durch die Latte 27 mm)" };

// Eingaben für Modul 2 der Suite (Standardwerte aus storage.standardEingaben().aufbau).
const AUFBAU_STANDARD = {
  panel: { h_cm: 150, off_x_cm: 0, off_y_cm: 0 },
  achsen: { max_y_cm: 75, ohang_cm: 12.5 },
  verbinder: { FA: { typ: "FA-1", Rk: 1.3 }, IA: { typ: "IA-1", Rk: 1.3 }, gM: 2.0, wk: 0.8, gQ: 1.5 },   // Rk: Zug, charakteristisch
  latten: { breite_cm: 6, stange_cm: 300 },
};


// ---------- Öffnungen ----------

/** Geometrische Vorprüfung: Wandstücke neben und zwischen Öffnungen mindestens 2 Raster und nie 1 oder 4. */
function geometrischOk(N, liste) {
  const s = [...liste].sort((a, b) => a.g0 - b.g0);
  let rand = 0;
  for (const o of s) {
    const stueck = o.g0 - rand;
    if (stueck < RAND_MIN_GRID || FORBIDDEN_N.has(stueck)) return false;
    rand = o.g1;
  }
  const rest = N - rand;
  return rest >= RAND_MIN_GRID && !FORBIDDEN_N.has(rest);
}

const oeffnung = (o) => new Opening(o.g0, o.g1, o.l0, o.l1, o.art);

/**
 * Vorspannung mit Bodenblech-Aussparungen unter den Türen (Feedback Felix B4): Unter einer Tür
 * trägt das Blech keinen Stein und wäre eine Schwelle im Durchgang. Der Kern führt die Felder als
 * manuelle Aussparung ([A-28]) und zerlegt links und rechts davon getrennt.
 */
function vorspannung(liste) {
  const felder = liste.filter((o) => o.art === "tuer").flatMap((o) => Array.from({ length: o.g1 - o.g0 }, (_, i) => o.g0 + i));
  return felder.length ? { ...VORSPANNUNG, base_plate_aussparungen_grid: felder } : VORSPANNUNG;
}

// Baubarkeit laut Rechenkern (inkl. Fugenversatz). Über manchen Türstürzen meldet der Kern einen
// Versatzkonflikt; solche Positionen bietet der Konfigurator nicht an.
const baubarCache = new Map();
function baubar(L, H, liste) {
  const key = `${L}|${H}|${liste.map((o) => `${o.art}${o.g0}-${o.g1}/${o.l0}-${o.l1}`).sort().join(",")}`;
  if (!baubarCache.has(key)) {
    let ok = false;
    try {
      const w = buildWall("pruef", L, H, liste.map(oeffnung), null, vorspannung(liste), [], null, true);
      ok = w.validation.buildable && w.validation.versatz_ok;
    } catch { ok = false; }
    if (baubarCache.size > 2000) baubarCache.clear();
    baubarCache.set(key, ok);
  }
  return baubarCache.get(key);
}

/** Wunschposition für eine neue Öffnung: Mitte der größten Lücke. */
function freieMitte(N, breite, liste) {
  const s = [...liste].sort((a, b) => a.g0 - b.g0);
  let best = { laenge: -1, mitte: Math.floor((N - breite) / 2) }, rand = 0;
  for (const o of [...s, { g0: N, g1: N }]) {
    if (o.g0 - rand > best.laenge) best = { laenge: o.g0 - rand, mitte: Math.round((rand + o.g0 - breite) / 2) };
    rand = o.g1;
  }
  return best.mitte;
}

/**
 * Löst die Öffnungsliste zu baubaren Positionen auf. Jede Öffnung rastet auf die nächstgelegene
 * Position, an der sie zusammen mit den bereits gesetzten baubar ist. Die zuletzt bewegte
 * Öffnung (`aktiv`) wird zuletzt gesetzt, damit sie sich an die anderen anpasst.
 * Rückgabe je Eingabe-Index: {art, g0, g1, l0, l1} oder null (kein Platz bzw. zu hoch).
 */
export function oeffnungenAufloesen(L, H, eingabe, aktiv = -1) {
  const N = L / GRID, lagen = Math.floor(H / 200);
  const reihenfolge = eingabe.map((_, i) => i).filter((i) => i !== aktiv);
  if (aktiv >= 0 && aktiv < eingabe.length) reihenfolge.push(aktiv);
  const gesetzt = [], ergebnis = eingabe.map(() => null);
  for (const i of reihenfolge) {
    const { art, pos } = eingabe[i];
    if (!OEFFNUNGEN[art]) continue;
    const { b, h, u } = oeffnungsMasse(eingabe[i]);
    if (u + h >= lagen) continue;    // mindestens eine Lage über der Öffnung
    const wunsch = Number.isFinite(pos) ? pos : freieMitte(N, b, gesetzt);
    const kandidaten = [];
    for (let g = RAND_MIN_GRID; g + b <= N - RAND_MIN_GRID; g++) kandidaten.push(g);
    kandidaten.sort((a, c) => Math.abs(a - wunsch) - Math.abs(c - wunsch) || a - c);
    for (const g0 of kandidaten) {
      const neu = [...gesetzt, { art, g0, g1: g0 + b, l0: u, l1: u + h }];
      if (geometrischOk(N, neu) && baubar(L, H, neu)) { gesetzt.push(neu[neu.length - 1]); ergebnis[i] = neu[neu.length - 1]; break; }
    }
  }
  return ergebnis;
}

// ---------- Aufbau ----------


/**
 * Latten laufen bis zur Wandkrone, zum Wandfuß bzw. zur Öffnungskante. Modul 2 der Suite lässt ein
 * Segment an der letzten Lage enden, deren Nut die Achse führt ([U-8]); darüber fehlte der
 * Bekleidung bis zu einer Lage lang die Unterkonstruktion. Überstände bis 400 mm (zwei Lagen) ohne
 * Verbinder werden deshalb geschlossen, Lücken auf derselben Achse ebenso. Befestigt bleibt jede
 * Latte nur an den Verbindern aus Modul 2.
 */
export function lattenBisZumRand(w, segmente, max_mm = 400) {
  const H = w.height_mm;
  const oeffnungen = w.openings.map((o) => ({
    x0: o.g0 * w.grid_mm, x1: o.g1 * w.grid_mm,
    y0: w.courses[o.l0].unterkante_mm, y1: w.courses[o.l1 - 1].oberkante_mm,
  }));
  const ueber = (x) => oeffnungen.filter((o) => x > o.x0 + 1e-6 && x < o.x1 - 1e-6);
  const raus = [];
  for (const s of [...segmente].sort((p, q) => p.x - q.x || p.y0 - q.y0)) {
    const vorher = raus[raus.length - 1];
    const dazwischen = (y0, y1) => ueber(s.x).some((o) => o.y0 < y1 && o.y1 > y0);
    if (vorher && vorher.x === s.x && s.y0 - vorher.y1 <= max_mm && !dazwischen(vorher.y1, s.y0)) { vorher.y1 = Math.max(vorher.y1, s.y1); continue; }
    raus.push({ ...s });
  }
  for (const s of raus) {
    const oben = Math.min(H, ...ueber(s.x).filter((o) => o.y0 >= s.y1 - 1e-6).map((o) => o.y0));
    const unten = Math.max(0, ...ueber(s.x).filter((o) => o.y1 <= s.y0 + 1e-6).map((o) => o.y1));
    if (oben - s.y1 <= max_mm) s.y1 = oben;
    if (s.y0 - unten <= max_mm) s.y0 = unten;
  }
  return raus;
}

/**
 * Verbinder und Latten einer Wandseite nach Modul 2 der Planungs-Suite (`berechneAufbau`):
 * Achsen im Panelraster, Reihen an den Panelfugen plus Zwischenreihen, je Punkt nur auf einer
 * innenliegenden Nut in Steinmitte ([U-3], [U-4], [U-11]), Endverbinder je Lattensegment
 * ([U-12]), keine Verbinder in der Ausgleichslage ([U-13]).
 */
export function verbinder(w, aufbau, typ) {
  if (!aufbau || !aufbau.schichten || !aufbau.schichten.length) return { achsen: [], reihen: [], segmente: [], punkte: [], ausnutzung: 0 };
  const S = AUFBAU_STANDARD, v = S.verbinder[typ];
  const raster_cm = aufbau.achsraster_mm / 10;
  // Innen liegen die Plattenstöße im Achsraster, darum Achsen im festen Raster ab Wandanfang.
  // Außen ist die Holzfaserplatte durchlaufend: ohne Raster setzt Modul 2 nur die Endachsen und die
  // Achsen an den Öffnungskanten und verteilt dazwischen gleichmäßig (höchstens Achsraster). So
  // entsteht am Wandende kein schmales Restfeld.
  const gleichmaessig = typ === "FA" ? { b_cm: 1e6, off_x_cm: S.achsen.ohang_cm } : null;
  const a = {
    seite: typ === "FA" ? "vorne" : "hinten",
    panel: { b_cm: raster_cm, ...S.panel, ...(gleichmaessig || {}) },
    achsen: { max_x_cm: raster_cm, ...S.achsen },
    verbinder: { typ: v.typ, Rk: v.Rk, gM: S.verbinder.gM, wk: S.verbinder.wk, gQ: S.verbinder.gQ },
    latten: S.latten,
    feld_cm: null,
  };
  const x = berechneAufbau(w, a);
  const mm = (cm) => Math.round(cm * 100) / 10;
  const lage = (y) => w.courses.findIndex((c) => c.unterkante_mm <= y && y < c.oberkante_mm);
  return {
    achsen: x.xs.map(mm),
    reihen: x.ys.map(mm),
    punkte: x.pts.map((p) => ({ x: mm(p.x_cm), y: mm(p.y_cm), lage: lage(mm(p.y_cm)) })),
    segmente: lattenBisZumRand(w, x.batt.axes.flatMap((ax) => ax.segments.map((s) => ({ x: mm(ax.x_cm), y0: mm(s.y0_cm), y1: mm(s.y1_cm) })))),
    ausnutzung: x.util,
    typ: v.typ,
  };
}

// ---------- Hauptrechnung ----------

/**
 * cfg: { laenge_mm, raumhoehe_mm, oeffnungen: [{art, pos}], aktiv, fassade, innen, waerme? }
 * fassade/innen als Aufbau-Objekte aus data/aufbauten.json. Mit waerme = { kennwerte, ziel_U }
 * wird die Dämmstärke der Fassade auf das Ziel ausgelegt; die Verbinderlage hängt nicht von der
 * Dämmstärke ab, darum gehen die tatsächlichen Halter je m² in den U-Wert ein.
 */
export function berechne(cfg) {
  const L = Math.round(Math.min(Math.max(cfg.laenge_mm, GRENZEN.laengeMin), GRENZEN.laengeMax) / GRID) * GRID;
  const raum = Math.min(Math.max(cfg.raumhoehe_mm, GRENZEN.hoeheMin), GRENZEN.hoeheMax);
  const rest = (raum - DECKENFUGE_MM) % 200;
  const H = raum - DECKENFUGE_MM - (rest < AUSGLEICH_MIN_MM ? rest : 0);

  const eingabe = cfg.oeffnungen || [];
  const oeffnungen = oeffnungenAufloesen(L, H, eingabe, cfg.aktiv ?? -1);

  // Die Ausgleichslage ist aktiv: die Wand füllt die lichte Höhe bis auf die Deckenfuge ([G-13]).
  const w = buildWall("SEMBLA-Konfigurator", L, H, oeffnungen.filter(Boolean).map(oeffnung), null, vorspannung(oeffnungen.filter(Boolean)), [], null, true);

  const innen = cfg.innen || { schichten: [] };
  const fa = verbinder(w, cfg.fassade || { schichten: [] }, "FA");
  const ia = verbinder(w, innen, "IA");

  const oeffFlaeche = w.openings.reduce((a, op) => {
    const y0 = w.courses[op.l0].unterkante_mm, y1 = w.courses[op.l1 - 1].oberkante_mm;
    return a + (op.g1 - op.g0) * GRID * (y1 - y0);
  }, 0);
  const flaeche_m2 = (L * H - oeffFlaeche) / 1e6;
  // Mit `waerme.fest` (Datenblatt-Link mit gespeicherten Dämmstärken) wird nicht neu ausgelegt.
  const wcfg = cfg.waerme, dichte = fa.punkte.length / flaeche_m2;
  const waerme = !wcfg || !cfg.fassade ? null
    : wcfg.fest ? bewerten(cfg.fassade, innen, wcfg.kennwerte, wcfg.ziel_U, dichte, wcfg.fest.d, wcfg.fest.da)
    : auslegen(cfg.fassade, innen, wcfg.kennwerte, wcfg.ziel_U, dichte);
  const fassade = waerme ? waerme.aufbau : cfg.fassade || { schichten: [] };
  // Vorbemessung je Verbinder; überlastete Achsen bekommen zusätzliche Verbinder (verbinder.js).
  const bemessung = { fa: null, ia: null };
  if (cfg.verbinder) {
    for (const [k, ver, aufbau, typ] of [["fa", fa, fassade, "FA"], ["ia", ia, innen, "IA"]]) {
      if (!ver.punkte.length) continue;
      const b = verbinderAuslegen(w, ver, aufbau, typ, cfg.verbinder);
      ver.punkte = b.punkte;
      bemessung[k] = { max: b.max, massgebend: b.massgebend, ergaenzt: b.ergaenzt, offen: b.offen.length,
        ...(typ === "FA" ? { qp_grenze: qpGrenze(b, cfg.verbinder) } : {}) };
    }
  }
  const ausgleich = w.courses.find((c) => c.ausgleich) || null;
  const dicke = THICK + aufbauDicke(fassade.schichten) + aufbauDicke(innen.schichten);

  const kennzahlen = {
    laenge_mm: L, raumhoehe_mm: raum, wandhoehe_mm: H, deckenfuge_mm: raum - H,
    lagen: w.courses.length,
    ausgleich_mm: ausgleich ? ausgleich.hoehe_mm : 0,
    i2: w.bom.i2, i3: w.bom.i3, steine: w.bom.i2 + w.bom.i3,
    spannachsen: w.tension_columns.length,
    gewindestangen: w.bom.gewindestangen,
    verbinder_fa: fa.punkte.length, verbinder_ia: ia.punkte.length,
    flaeche_m2,
    gewicht_rohwand_kg: flaeche_m2 * ROHWAND.flaechengewicht_kg_m2,
    dicke_gesamt_mm: dicke,
    flaechengewicht_fassade_kg_m2: fassade.flaechengewicht_kg_m2 || 0,
  };

  const hinweise = [];
  if (!w.validation.buildable) hinweise.push("Ein Wandstück hat eine nicht baubare Breite (1 oder 4 Raster).");
  if (!w.validation.versatz_ok) hinweise.push("Der Fugenversatz ist nicht überall eingehalten.");
  if (ausgleich) hinweise.push(`Oberste Lage als Ausgleichslage mit ${ausgleich.hoehe_mm} mm Höhe (Sonderzuschnitt, prüfen); dort sitzen keine Verbinder.`);
  const ohne = oeffnungen.filter((o) => !o).length;
  const fe = waerme && waerme.feuchte;
  if (fe && !fe.luftdicht) hinweise.push("Keine luftdichte Ebene: Die Steinfugen sind nicht luftdicht. Innenseite verputzen oder eine luftdichte Bahn vorsehen.");
  else if (fe && !fe.ok) hinweise.push("Tauwasserschutz nach DIN 4108-3 mit diesem Aufbau nicht erfüllt, siehe Wärmeschutz.");
  const zuschnitt = new Set((w.validation.zuschnitt_konflikte || []).map((k) => k.grund));
  if (zuschnitt.has("mindestmass")) hinweise.push("Bei dieser Höhe bzw. Öffnungslage entstünde ein Gewindestangen-Zuschnitt unter 20 cm. Das Planungsteam löst den Strang in der Ausführungsplanung; die Stückliste zeigt hier vorläufige Längen.");
  if (zuschnitt.has("stoss_auf_zwischenpunkt")) hinweise.push("Eine Stangenkopplung fiele auf einen Zwischenspannpunkt. Das Planungsteam verschiebt den Stoß in der Ausführungsplanung.");
  for (const [k, name] of [["fa", "Fassade"], ["ia", "innen"]]) {
    const b = bemessung[k];
    if (b && b.offen) hinweise.push(`Verbinder ${name}: ${b.offen} Verbinder ${b.offen === 1 ? "ist" : "sind"} in der Vorbemessung überlastet (Ausnutzung bis ${Math.round(b.max * 100)} %), und auf der Achse ist keine Nut mehr frei. Das Planungsteam löst das in der Ausführungsplanung.`);
  }
  if (ohne) hinweise.push(`${ohne === 1 ? "Eine Öffnung passt" : `${ohne} Öffnungen passen`} nicht mehr in die Wand und ${ohne === 1 ? "wird" : "werden"} nicht gezeichnet.`);

  return { w, oeffnungen, fa, ia, kennzahlen, hinweise, schraube: schraubenlaenge(fassade), fassade, waerme, bemessung };
}


/** Kurztext für Formular und Tracking. */
export function zusammenfassung(cfg, r) {
  const k = r.kennzahlen;
  const m = (mm) => (mm / 1000).toFixed(2).replace(".", ",");
  const teile = [`Wand ${m(k.laenge_mm)} × ${m(k.wandhoehe_mm)} m`];
  const tueren = r.oeffnungen.filter((o) => o && o.art === "tuer").length;
  const fenster = r.oeffnungen.filter((o) => o && o.art === "fenster").length;
  if (tueren) teile.push(`${tueren} ${tueren === 1 ? "Tür" : "Türen"}`);
  if (fenster) teile.push(`${fenster} Fenster`);
  if (cfg.fassade) teile.push(`Fassade: ${cfg.fassade.name}`);
  if (cfg.innen) teile.push(`Innen: ${cfg.innen.name}`);
  if (r.waerme && r.waerme.daemmung_mm) teile.push(`U = ${r.waerme.U.toFixed(3).replace(".", ",")} W/(m²K) bei ${daemmText(r.waerme)} Dämmung`);
  teile.push(`${k.steine} Steine (${k.i3} × i3, ${k.i2} × i2), ${k.spannachsen} Spannachsen`);
  return teile.join(" · ");
}
