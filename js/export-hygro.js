// Wandaufbau für hygrothermische Berechnungen: der tatsächliche
// Schichtenaufbau einer Konfiguration als neutrales JSON, Format „sembla-wandaufbau“ Version 1.
// Reines Modul ohne DOM. Gedacht für eindimensionale Rechnungen; deshalb gilt wie im Glaser-
// Verfahren (feuchte.js) der Gefachschnitt: Ständer, Halter und Latten neben einem Gefachstoff
// entfallen, eine Lattenebene ohne Gefachstoff ist ruhende Luft. Bei hinterlüfteten Fassaden endet
// der Aufbau an der Belüftungsebene (`belueftung_ab`).

import { auslegen, bewerten } from "./waerme.js";
import { zustandAusUrl, aufbauWahl, RECHENSTAND } from "./inhalte.js";

export const FORMAT = "sembla-wandaufbau";
export const VERSION = 1;

const istBahn = (s) => s.material === "bahn" || s.material === "fassadenbahn";
const istStab = (s) => s.art === "staender" || s.art === "latte_v" || s.art === "halter";

function zonenListe(schichten) {
  const liste = [];
  for (const s of schichten) {
    if (!s.parallel || !liste.length) liste.push([]);
    liste[liste.length - 1].push(s);
  }
  return liste;
}

/** Eine Zone als eine Schicht im Gefachschnitt (oder null, wenn sie nichts beiträgt). */
function lage(zone, seite, raster) {
  const q = (s) => `${seite}:${s.id}`;
  const bahn = zone.find(istBahn);
  if (bahn) return { quelle: q(bahn), name: bahn.name, rolle: bahn.material === "bahn" ? "dampfbremse" : "fassadenbahn",
    material: bahn.material, dicke_mm: bahn.dicke, sd: bahn.sd };
  const stoff = zone.find((s) => s.lambda && !istStab(s));
  if (stoff) {
    const neben = zone.filter((s) => s !== stoff && istStab(s));
    const rolle = neben.some((s) => s.art === "staender" || s.art === "halter") ? "gefach"
      : neben.some((s) => s.art === "latte_v") ? "installationsebene" : "schicht";
    const x = { quelle: q(stoff), name: stoff.name, rolle, material: stoff.material, dicke_mm: stoff.dicke, lambda: stoff.lambda };
    for (const k of ["mu", "rho"]) if (stoff[k] != null) x[k] = stoff[k];
    if (neben.length) x.neben = neben.map((s) => ({ quelle: q(s), name: s.name, art: s.art, material: s.material, breite_mm: s.breite, achsraster_mm: raster }));
    return x;
  }
  const latte = zone.find((s) => s.art === "latte_v");
  if (latte) return { quelle: q(latte), name: "Lattenebene (ruhende Luft)", rolle: "luftschicht", material: "luft", dicke_mm: latte.dicke,
    neben: [{ quelle: q(latte), name: latte.name, art: latte.art, material: latte.material, breite_mm: latte.breite, achsraster_mm: raster }],
    R_zwischenraum: latte.r_zwischenraum ?? 0.18 };
  return null;
}

/** Art der Außenseite: offene Fugen in der Bekleidung gelten als offene Schalung. */
function aussenArt(fassade, aussen) {
  if (!fassade?.schichten?.length) return "direkt";
  if (!fassade.hinterlueftet) return "direkt";
  const bek = fassade.schichten.find((s) => s.id === "bekleidung");
  const offen = bek && bek.art === "leiste_h" && bek.fuge > 0;
  return offen ? "offene_schalung" : "hinterlueftet";
}

/**
 * Wandaufbau einer Auswahl. A: aufbauten.json. auswahl: { fassade, innen, ziel?, d?, da? } (Kennungen;
 * ohne d legt der Konfigurator die Dämmstärke wie auf der Seite aus). Rückgabe: Objekt im Format
 * „sembla-wandaufbau“, Schichten von innen nach außen.
 */
export function wandaufbau(A, auswahl, { link = null } = {}) {
  const zustand = { fassade: auswahl.fassade, innen: auswahl.innen, ziel: auswahl.ziel || "beg" };
  if (auswahl.d) zustand.fest = { d: auswahl.d, da: auswahl.da ?? null };
  const { roh, innen, ziel, waerme } = aufbauWahl(A, zustand);
  if (zustand.ersetzt.length) throw new Error(`unbekannte Auswahl: ${zustand.ersetzt.join(", ")} (${JSON.stringify(auswahl)})`);
  if (auswahl.d && !waerme.fest) throw new Error(`Dämmstärke ${auswahl.d}${auswahl.da ? ` + ${auswahl.da}` : ""} mm passt nicht zu ${roh.id}`);
  const kw = A.waerme;
  const r = waerme.fest ? bewerten(roh, innen, kw, ziel.U, kw.halter.je_m2, waerme.fest.d, waerme.fest.da) : auslegen(roh, innen, kw, ziel.U);
  const fassade = r.aufbau;
  const innenLagen = zonenListe(innen?.schichten || []).map((z) => lage(z, "innen", innen?.achsraster_mm || 625)).filter(Boolean).reverse();
  const ende = fassade?.belueftung_ab ? fassade.schichten.findIndex((s) => s.id === fassade.belueftung_ab) : -1;
  const aussen = ende >= 0 ? fassade.schichten.slice(0, ende) : fassade?.schichten || [];
  const aussenLagen = zonenListe(aussen).map((z) => lage(z, "aussen", fassade?.achsraster_mm || 625)).filter(Boolean);
  // Wärmeschutz nach DIN EN ISO 6946, wie im Konfigurator gerechnet: damit die Hygro den U-Wert
  // vollständig nachrechnen kann (Übergänge, Stein, Wandhalter, Befestiger). Zusatz in Version 1.
  const halter = (fassade?.schichten || []).find((s) => s.art === "halter");
  const sc = fassade?.schraube;
  const platte = sc && fassade.schichten.find((s) => sc.durch?.includes(s.id) && s.lambda);
  const r4 = (x) => Math.round(x * 10000) / 10000;
  const waermeBlock = {
    verfahren: "DIN EN ISO 6946, Mittel aus oberem und unterem Grenzwert",
    Rsi: kw.Rsi, Rse: fassade?.hinterlueftet ? kw.Rse_hinterlueftet : kw.Rse, stein_R: kw.stein.R,
    halter: halter ? { quelle: `aussen:${halter.id}`, name: halter.name, je_m2: r.halterJeM2, chi_W_K: kw.halter.chi_W_K,
      herkunft: kw.halter.quelle } : null,
    befestiger: r.schrauben && platte ? { quelle: `aussen:${platte.id}`, durchmesser_mm: sc.durchmesser_mm, lambda: sc.lambda,
      je_m2: r4(1 / ((fassade.achsraster_mm / 1000) * (sc.abstand_mm / 1000))) } : null,
    RT: r4(r.RT), zuschlag_halter: r4(r.zuschlag), zuschlag_befestiger: r4(r.schrauben),
  };
  const stein = { quelle: "stein", name: kw.stein.name || "SEMBLA-Stein", rolle: "stein", material: "stein",
    dicke_mm: kw.stein.dicke_mm ?? 125, R: kw.stein.R };
  // Schichten, die für diese Innenseite entfallen (Dampfbremse bei luftdichter Innenseite, fuerInnen).
  const entfallen = (roh?.schichten || []).filter((s) => !(fassade?.schichten || []).some((t) => t.id === s.id)).map((s) => s.id);
  return {
    format: FORMAT, version: VERSION, rechenstand: RECHENSTAND,
    konfiguration: { fassade: roh.id, innen: innen.id, ziel: ziel.id, daemmung_mm: r.daemmung_mm || null,
      daemmung_aussen_mm: r.daemmung_aussen_mm ?? null, freigegeben: roh.freigegeben !== false && innen.freigegeben !== false, link },
    bezeichnung: { fassade: roh.name, innen: innen.name },
    aussen: aussenArt(fassade, aussen),
    U: Math.round(r.U * 1000) / 1000,
    // Format v1, nicht stillschweigend ändern: glaser_ok ist das Gesamtergebnis des Feuchteschutzes
    // (Glaser, Temperatur an der Bahn, luftdichte Ebene), wie seit Einführung des Formats.
    glaser_ok: r.feuchte ? !!r.feuchte.ok : null,
    schnitt: "Gefachschnitt: Ständer, Halter und Latten neben einem Gefachstoff entfallen; Lattenebene ohne Gefachstoff als ruhende Luft; Aufbau endet an der Belüftungsebene.",
    entfallen,
    schichten: [...innenLagen, stein, ...aussenLagen],
    waerme: waermeBlock,
  };
}

/**
 * Wandaufbau aus einem Konfigurator- oder Datenblatt-Link (oder nur dem Teil nach „?“).
 * Ohne dd im Link wird ausgelegt; der zurückgegebene Link trägt dann v/dd/da wie die Links des
 * Konfigurators, damit derselbe Aufbau immer denselben Link (und in der Hygro dieselbe Prüfsumme) hat.
 */
export function wandaufbauAusLink(A, link) {
  const i = link.indexOf("?");
  const query = i >= 0 ? link.slice(i + 1) : link;
  const p = new URLSearchParams(query);
  const z = zustandAusUrl(p);
  const w = wandaufbau(A, { fassade: z.fassade, innen: z.innen, ziel: z.ziel, d: z.fest?.d, da: z.fest?.da }, { link });
  if (!z.fest && w.konfiguration.daemmung_mm) {
    for (const k of ["v", "dd", "da"]) p.delete(k);
    p.set("v", RECHENSTAND);
    p.set("dd", w.konfiguration.daemmung_mm);
    if (w.konfiguration.daemmung_aussen_mm != null) p.set("da", w.konfiguration.daemmung_aussen_mm);
    w.konfiguration.link = (i >= 0 ? link.slice(0, i + 1) : "") + p;
  }
  return w;
}
