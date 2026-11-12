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
function lage(zone, seite) {
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
    if (neben.length) x.neben = neben.map((s) => ({ quelle: q(s), name: s.name, material: s.material, breite_mm: s.breite }));
    return x;
  }
  const latte = zone.find((s) => s.art === "latte_v");
  if (latte) return { quelle: q(latte), name: "Lattenebene (ruhende Luft)", rolle: "luftschicht", material: "luft", dicke_mm: latte.dicke,
    neben: [{ quelle: q(latte), name: latte.name, material: latte.material, breite_mm: latte.breite }] };
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
  const innenLagen = zonenListe(innen?.schichten || []).map((z) => lage(z, "innen")).filter(Boolean).reverse();
  const ende = fassade?.belueftung_ab ? fassade.schichten.findIndex((s) => s.id === fassade.belueftung_ab) : -1;
  const aussen = ende >= 0 ? fassade.schichten.slice(0, ende) : fassade?.schichten || [];
  const aussenLagen = zonenListe(aussen).map((z) => lage(z, "aussen")).filter(Boolean);
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
    glaser_ok: r.feuchte ? !!r.feuchte.glaser?.ok : null,
    feuchteschutz_ok: r.feuchte ? !!r.feuchte.ok : null,   // Glaser, Temperatur an der Bahn, luftdichte Ebene
    schnitt: "Gefachschnitt: Ständer, Halter und Latten neben einem Gefachstoff entfallen; Lattenebene ohne Gefachstoff als ruhende Luft; Aufbau endet an der Belüftungsebene.",
    entfallen,
    schichten: [...innenLagen, stein, ...aussenLagen],
  };
}

/** Wandaufbau aus einem Konfigurator- oder Datenblatt-Link (oder nur dem Teil nach „?“). */
export function wandaufbauAusLink(A, link) {
  const query = link.includes("?") ? link.slice(link.indexOf("?") + 1) : link;
  const z = zustandAusUrl(new URLSearchParams(query));
  return wandaufbau(A, { fassade: z.fassade, innen: z.innen, ziel: z.ziel, d: z.fest?.d, da: z.fest?.da }, { link });
}
