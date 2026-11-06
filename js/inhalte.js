// Gemeinsame Inhalte von Konfigurator und Datenblatt: Konfiguration aus der URL lesen und
// schreiben, Kennzahlen, Stückliste, Regeln und Wärmeschutz als HTML.

import { ROHWAND, VERBINDERSCHRAUBEN, OEFFNUNGEN, oeffnungsMasse } from "./wand.js";
import { THICK } from "./sembla-core.js";
import { teilBild } from "./teilebilder.js";
import { daemmText } from "./waerme.js";

export const de = (x, d = 2) => x.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
/** Millimeter mit Dezimalkomma, Nachkommastelle nur wenn nötig (12,5 mm). */
export const mmDe = (x) => x.toLocaleString("de-DE", { maximumFractionDigits: 1 });
export const m = (mm, d = 2) => `${de(mm / 1000, d)} m`;
/** Maß im 12,5-cm-Raster: drei Nachkommastellen nur, wo nötig (8,625 m statt 8,63 m). */
export const mRaster = (mm) => m(mm, Math.round(mm) % 10 ? 3 : 2);
/** Text für innerHTML: Namen aus den Daten können Sonderzeichen enthalten. */
export const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Stand der Rechnung. Ändert sich die Auslegung, steigt er; Datenblatt-Links tragen ihn als `v`
// und dazu die damals gewählten Dämmstärken (`dd`, `da`), damit verschickte Datenblätter gleich bleiben.
export const RECHENSTAND = 6;   // 6: Steinverband über alle Lagen ohne Kreuzfuge (Rechenkern 2f88b6b, 04.11.2026)

// Voreinstellung und frühere Kennungen (alt → neu), damit alte Links nicht ins Leere laufen.
export const STANDARD = { fassade: "schindel", innen: "trockenbau_putz", ziel: "beg" };
const ALIAS = { fassade: {}, innen: {}, ziel: {} };

// Öffnungen in der URL: o=t21,f5,f33 (Art und Startraster), abweichende Maße angehängt:
// b Breite in Rastern, h Höhe in Lagen, u Brüstung in Lagen (o=t21b10h12,f5u3). Altform o=tuer&p=21.
function oeffnungenAusUrl(url) {
  const o = url.get("o");
  if (o === null) return [{ art: "tuer", pos: null }];
  if (o === "keine" || o === "") return [];
  if (o === "tuer" || o === "fenster") return [{ art: o, pos: url.has("p") ? +url.get("p") : null }];
  return o.split(",").map((s) => /^([tf])(\d+)?(?:b(\d+))?(?:h(\d+))?(?:u(\d+))?$/.exec(s.trim())).filter(Boolean)
    .map(([, a, p, b, h, u]) => {
      const x = { art: a === "t" ? "tuer" : "fenster", pos: p ? +p : null };
      for (const [k, v] of [["b", b], ["h", h], ["u", u]]) if (v) x[k] = +v;
      return x;
    })
    .filter((x, i, a) => a.slice(0, i).filter((y) => y.art === x.art).length < OEFFNUNGEN[x.art].max);
}

const zahl = (url, k) => (/^\d+$/.test(url.get(k) || "") ? +url.get(k) : null);

/** Konfiguration aus den URL-Parametern (l, h, o, f, i, w; im Datenblatt-Link auch v, dd, da). */
export function zustandAusUrl(url) {
  const z = {
    laenge_mm: zahl(url, "l") || 6000,
    raumhoehe_mm: zahl(url, "h") || 2850,
    oeffnungen: oeffnungenAusUrl(url),
    aktiv: -1,
    fassade: url.get("f") || STANDARD.fassade,
    innen: url.get("i") || STANDARD.innen,
    ziel: url.get("w") || STANDARD.ziel,
    stand: zahl(url, "v"),
  };
  if (zahl(url, "dd")) z.fest = { d: zahl(url, "dd"), da: zahl(url, "da") };
  return z;
}

function oeffnungKurz(x) {
  const def = OEFFNUNGEN[x.art], ms = oeffnungsMasse(x);
  return (x.art === "tuer" ? "t" : "f") + (Number.isFinite(x.pos) ? x.pos : "")
    + (ms.b !== def.breite_grid ? `b${ms.b}` : "") + (ms.h !== def.lagen ? `h${ms.h}` : "") + (ms.u !== def.l0 ? `u${ms.u}` : "");
}

/** URL-Parameter der Konfiguration, mit den aufgelösten Werten aus dem Ergebnis. */
export function urlParameter(zustand, r) {
  const k = r.kennzahlen;
  const o = zustand.oeffnungen.map(oeffnungKurz).join(",") || "keine";
  return { l: k.laenge_mm, h: k.raumhoehe_mm, o, f: zustand.fassade, i: zustand.innen, w: zustand.ziel };
}

/** Parameter für den Datenblatt-Link: Konfiguration plus Rechenstand und die gewählten Dämmstärken. */
export function datenblattParameter(zustand, r) {
  const p = { ...urlParameter(zustand, r), v: RECHENSTAND };
  if (r.fassade?.daemmstufen) {
    p.dd = r.fassade.daemmung_mm;
    if (r.fassade.daemmung_aussen_mm) p.da = r.fassade.daemmung_aussen_mm;
  }
  return p;
}

/**
 * Aufbauten der Wahl. Frühere Kennungen werden umgeschrieben; unbekannte fallen auf die
 * Voreinstellung zurück und stehen in `zustand.ersetzt`, damit die Seite darauf hinweisen kann.
 * Zurückgezogene Varianten mit `ersatz` gehen im Konfigurator auf ihren Nachfolger über
 * (`zustand.umgestellt`: [alt, neu]); das Datenblatt rechnet sie unverändert weiter.
 */
export function aufbauWahl(A, zustand, { nurFreigegeben = false } = {}) {
  const ersetzt = [], umgestellt = [];
  const waehle = (liste, art, id) => {
    const gefunden = liste.find((x) => x.id === (ALIAS[art][id] || id));
    const nachfolger = nurFreigegeben && gefunden?.freigegeben === false && gefunden.ersatz
      && liste.find((x) => x.id === gefunden.ersatz && x.freigegeben !== false);
    if (nachfolger) { umgestellt.push([gefunden, nachfolger]); return nachfolger; }
    const treffer = gefunden && (!nurFreigegeben || gefunden.freigegeben !== false) ? gefunden : null;
    if (treffer) return treffer;
    ersetzt.push(art);
    return liste.find((x) => x.id === STANDARD[art]) || liste.find((x) => x.freigegeben !== false) || liste[0];
  };
  const roh = waehle(A.fassaden, "fassade", zustand.fassade);
  const innen = waehle(A.innen, "innen", zustand.innen);
  const ziel = waehle(A.waerme.ziele, "ziel", zustand.ziel);
  Object.assign(zustand, { fassade: roh.id, innen: innen.id, ziel: ziel.id, ersetzt, umgestellt });
  // Feste Dämmstärken nur, wenn sie zu den Stufen dieser Fassade passen.
  const st = roh.daemmstufen;
  const fest = zustand.fest && st && st.dicken.includes(zustand.fest.d)
    && (!st.aussen || st.aussen.dicken.includes(zustand.fest.da)) ? zustand.fest : null;
  return { roh, innen, ziel, verbinder: A.verbinder, waerme: { kennwerte: A.waerme, ziel_U: ziel.U, ...(fest ? { fest } : {}) } };
}

/** Kennwerte als Kacheln. kurz: nur Steine, Wanddicke, U-Wert und Gewicht (Konfigurator); das Datenblatt zeigt alle. */
export function kachelnHtml(r, { kurz = false } = {}) {
  const k = r.kennzahlen, fassade = r.fassade;
  const KURZ = new Set(["steine", "dicke", "u", "gewicht"]);
  const liste = [
    ["steine", k.steine, `Steine: ${k.i3} × i3, ${k.i2} × i2`],
    ["lagen", k.lagen, k.ausgleich_mm ? `Lagen, oben ${k.ausgleich_mm} mm Ausgleich` : "Lagen à 20 cm"],
    ["achsen", k.spannachsen, "Spannachsen, M10 vorgespannt"],
    ["verbinder", `${k.verbinder_fa} / ${k.verbinder_ia}`, "Verbinder Fassade / innen"],
    ["flaeche", `${de(k.flaeche_m2, 1)} m²`, r.w.openings.length ? "Wandfläche ohne Öffnungen" : "Wandfläche"],
    ["dicke", `${Math.round(k.dicke_gesamt_mm)} mm`, "Wanddicke gesamt"],
    ...(fassade.daemmstufen ? [["u", `${de(r.waerme.U, 3)}`, `U-Wert W/(m²K), ${daemmText(fassade)} Dämmung`]] : []),
    ["gewicht", `${de(k.gewicht_rohwand_kg / 1000, 1)} t`, `Rohwand, ${ROHWAND.flaechengewicht_kg_m2} kg/m²`],
  ];
  return liste.filter(([id]) => !kurz || KURZ.has(id))
    .map(([, w, b]) => `<div class="kachel"><span class="wert">${w}</span><span class="bez">${b}</span></div>`).join("");
}

export function stuecklisteHtml(gruppen, materialien) {
  const zahl = (t) => (t.einheit === "Stk" ? String(t.menge) : de(t.menge, 1));
  return gruppen.map((g) => `
    <section class="teilgruppe">
      <h3>${g.titel}</h3>
      <div class="teilraster">${g.teile.map((t) => `
        <div class="teil" title="${esc(t.name)}${t.detail ? ` · ${esc(t.detail)}` : ""}">
          ${teilBild(t, materialien)}
          <span class="menge">${t.ca ? "<small>ca.</small> " : ""}${zahl(t)} <small>${t.einheit}</small></span>
          <span class="name">${esc(t.name)}${t.detail ? ` · ${esc(t.detail)}` : ""}</span>
        </div>`).join("")}
      </div>
    </section>`).join("");
}

/** Stückliste in einer Zeile je Gruppe (Konfigurator); die Einzelpositionen stehen darunter aufklappbar. */
export function stuecklisteKurzHtml(gruppen, r) {
  const k = r.kennzahlen;
  const stk = (g) => g.teile.filter((t) => t.einheit === "Stk").reduce((a, t) => a + t.menge, 0);
  const zeile = (g) => g.id === "wand" ? `${stk(g)} Steine`
    : g.id === "spann" ? `${k.spannachsen} Spannachsen`
    : `${g.teile.length} Positionen`;
  return `<ul class="teile-kurz">${gruppen.map((g) => `<li><b>${esc(g.titel)}</b><span>${zeile(g)}</span></li>`).join("")}</ul>`;
}

/**
 * Regeln als Listenpunkte. mitRegler: Hinweis auf den Rückbau-Regler (nur im Konfigurator).
 * kurz: nur Raster, trocken vorgespannt, lösbar und zirkulär (Konfigurator); Bemessung,
 * Schrauben und Verwendbarkeit stehen im Datenblatt.
 */
export function regelnHtml(r, innen, mitRegler = true, { kurz = false } = {}) {
  const k = r.kennzahlen, fassade = r.fassade;
  if (kurz) {
    const ausbau = fassade.schichten.length || innen.schichten.length;
    return [
      `<b>Raster:</b> ${m(k.laenge_mm, 3).replace(/0 m$/, " m")} = ${k.laenge_mm / 125} × 12,5 cm, die Stoßfugen von Lage zu Lage versetzt.`,
      `<b>Trocken und vorgespannt:</b> kein Mörtel. ${k.spannachsen} Gewindestangen spannen die Lagen zusammen.`,
      `<b>Lösbar und zirkulär:</b> ${ausbau ? `${k.verbinder_fa + k.verbinder_ia} Verbinder sitzen in den Nuten, gebohrt oder gedübelt wird nicht. ` : ""}Jede Schicht ist sortenrein trennbar, alle ${k.steine} Steine sind wiederverwendbar.${mitRegler ? " Probieren Sie den Rückbau-Regler." : ""}`,
    ].map((t) => `<li><span>${t}</span></li>`).join("");
  }
  const li = [
    `<b>Raster:</b> ${m(k.laenge_mm, 3).replace(/0 m$/, " m")} = ${k.laenge_mm / 125} × 12,5 cm. Lange i3-Steine füllen die Wand, kurze i2 nur an den Enden. Die Stoßfugen sind von Lage zu Lage versetzt.`,
    `<b>Trocken und vorgespannt:</b> kein Mörtel. ${k.spannachsen} Gewindestangen laufen durch die Kammern und spannen die Lagen zwischen Bodenblech und Spannplatte zusammen. Die Spannachsen haben höchstens 37,5 cm Abstand (drei Raster).`,
  ];
  if (fassade.schichten.length || innen.schichten.length) {
    li.push(`<b>Lösbare Verbinder:</b> ${k.verbinder_fa + k.verbinder_ia} Verbinder sitzen in den Nuten, immer in Steinmitte und nie in einer Fuge. In den Stein wird nicht gebohrt oder gedübelt; befestigt werden nur die Anschlüsse an Boden und Decke.`);
    const b = r.bemessung || {}, pz = (x) => `${Math.round(x * 100)} %`;
    const teile = [];
    if (b.fa) teile.push(`außen höchstens ${pz(b.fa.max)} (Windsog in Windzone 2, Gebäude bis 10 m, auch an der Gebäudeecke; das Eigengewicht trägt ein Fußauflager)`);
    if (b.ia) teile.push(`innen höchstens ${pz(b.ia.max)} (die Latten stehen auf einer Schwelle)`);
    const ergaenzt = (b.fa?.ergaenzt || 0) + (b.ia?.ergaenzt || 0);
    if (teile.length) li.push(`<b>Verbinder bemessen:</b> Ausnutzung ${teile.join(", ")}.${ergaenzt ? ` ${ergaenzt} Verbinder sind dafür zusätzlich gesetzt.` : ""} Vorbemessung, ersetzt keine Statik.`);
  }
  if (r.schraube && r.schraube.laenge_mm) {
    li.push(`<b>Schrauben aus dem Aufbau berechnet:</b> ${r.schraube.bezeichnung} ${r.schraube.durchmesser_mm} × ${r.schraube.laenge_mm}, weil ${r.schraube.begruendung}. Verbinderschrauben: Fassade ${VERBINDERSCHRAUBEN.fa}, innen ${VERBINDERSCHRAUBEN.ia}.`);
  }
  li.push(fassade.schichten.length
    ? `<b>Verwendbarkeit:</b> Für SEMBLA als nichttragende Innenwand ist ein allgemeines bauaufsichtliches Prüfzeugnis (abP) in Vorbereitung. Mit vorgehängter Fassade braucht die Wand eine Zustimmung im Einzelfall.`
    : `<b>Verwendbarkeit:</b> nichttragende Innenwand nach DIN 4103-1; das allgemeine bauaufsichtliche Prüfzeugnis (abP) ist in Vorbereitung.`);
  li.push(`<b>Zirkulär:</b> Jede Schicht ist sortenrein trennbar, alle ${k.steine} Steine sind wiederverwendbar.${mitRegler ? " Probieren Sie den Rückbau-Regler." : ""}`);
  return li.map((t) => `<li><span>${t}</span></li>`).join("");
}

/** Verwendbarkeit in einer Zeile (Kleingedrucktes im Konfigurator). */
export function verwendbarkeitText(r) {
  return r.fassade.schichten.length
    ? "Verwendbarkeit: abP für SEMBLA als nichttragende Innenwand in Vorbereitung; mit vorgehängter Fassade Zustimmung im Einzelfall."
    : "Verwendbarkeit: nichttragende Innenwand nach DIN 4103-1, abP in Vorbereitung.";
}

export function hinweiseHtml(r) {
  return r.hinweise.map((t) => `<li><span>${t}</span></li>`).join("");
}

/** Wärmeschutz. rechenweg: "offen" (Datenblatt) oder "einklappen": Schichten, Tauwasserschutz und Rechenweg hinter „Rechenweg anzeigen“. */
export function waermeHtml(r, innen, A, zielId, { rechenweg = "offen" } = {}) {
  const kw = A.waerme, w = r.waerme, fassade = r.fassade;
  const roh = A.fassaden.find((f) => f.id === fassade.id);
  if (!roh.daemmstufen) {
    return `<p>Ohne Fassade bleibt die Rohwand ungedämmt (U ≈ ${de(w.U, 1)} W/(m²K)). Für beheizte Räume wählen Sie eine gedämmte Fassade.</p>`;
  }
  const sd = (s) => (s.sd != null ? s.sd : s.mu != null ? s.mu * s.dicke / 1000 : null);
  const schicht = (s, aussen) => `<tr><td>${esc(s.name)}</td><td class="zahl">${mmDe(s.dicke)} mm</td>
    <td class="zahl">${s.lambda ? de(s.lambda, 3) : "–"}</td><td class="zahl">${sd(s) != null ? de(sd(s)) : "–"}</td>
    <td>${s.lambda || s.sd ? "" : aussen ? "hinterlüftet, nicht angesetzt" : s.art === "halter" ? "Wärmebrücke als Zuschlag" : ""}</td></tr>`;
  const innenS = [...innen.schichten].reverse().map((s) => schicht(s, false)).join("");
  let hinterLuft = false;
  const aussenS = fassade.schichten.map((s) => { if (s.art === "latte_v") hinterLuft = true; return schicht(s, hinterLuft && !s.lambda); }).join("");
  // Kein Bezug auf Förderprogramme oder Bestandsanforderungen: Die Wand ist ein Neubauprodukt, den
  // Nachweis führt das Gebäude. Die Dämmstärke ist auf einen festen U-Wert ausgelegt (Datenblatt-Link: `w`).
  const ziel = kw.ziele.find((z) => z.id === zielId) || kw.ziele[0];
  return `
    <p><b>U = ${de(w.U, 3)} W/(m²K)</b> für ${fassade.name} mit ${daemmText(fassade)} Dämmung und Innenseite ${innen.name}.
      Die Dämmstärke ist auf U ${ziel.richtwert ? "≈" : "≤"} ${de(ziel.U)} W/(m²K) ausgelegt; den energetischen Nachweis führt das Gebäude.</p>
    ${rechenweg === "einklappen" ? `${feuchteKurz(w.feuchte)}<details class="rechenweg"><summary>Rechenweg anzeigen</summary>` : ""}
    ${feuchteHtml(w.feuchte, kw)}
    <h3>Schichten von innen nach außen</h3>
    <div class="tabelle"><table>
      <thead><tr><th>Schicht</th><th class="zahl">Dicke</th><th class="zahl">λ W/(m·K)</th><th class="zahl">s<sub>d</sub> m</th><th></th></tr></thead>
      <tbody>${innenS}<tr><td>SEMBLA-Stein</td><td class="zahl">125 mm</td><td class="zahl">–</td><td class="zahl">${kw.stein.mu ? de(kw.stein.mu * THICK / 1000) : "–"}</td><td>R = ${de(kw.stein.R)} m²K/W${kw.stein.mu ? "" : ", als Dampfbremse nicht angesetzt"}</td></tr>${aussenS}</tbody></table></div>
    <p class="klein">Rechnung nach DIN EN ISO 6946: Mittel aus oberem und unterem Grenzwert für Schichten mit Holz im Gefach, R<sub>si</sub> = ${de(kw.Rsi)}, R<sub>se</sub> = ${de(fassade.hinterlueftet ? kw.Rse_hinterlueftet : kw.Rse)}${fassade.hinterlueftet ? " (hinterlüftet)" : ""}.
      λ sind Bemessungswerte (Wärmeleitstufe); für den Nachweis gilt der Wert des eingesetzten Produkts. ${kw.stein.quelle}. ${kw.stein.quelle_mu}.
      ${w.schrauben ? `Holzbauschrauben durch die Holzfaserplatte nach DIN EN ISO 6946 Anhang F: + ${de(w.schrauben, 3)} W/(m²K).` : ""} ${w.zuschlag ? `Wandhalter: ${de(w.halterJeM2, 1)} je m² (einer je Verbinder) × χ = ${de(kw.halter.chi_W_K, 3)} W/K = + ${de(w.zuschlag, 3)} W/(m²K).` : ""}
      Wärmebrücken an Anschlüssen (Sockel, Fenster, Decke, Ecken) sind nicht enthalten; im GEG-Nachweis werden sie mit einem Zuschlag ΔU<sub>WB</sub> (pauschal 0,10 bzw. 0,05 W/(m²K) mit Gleichwertigkeitsnachweis) oder detailliert berücksichtigt.
      Vorbemessung: Den Nachweis nach GEG für das Gebäude führt die Energieberatung.</p>
    ${rechenweg === "einklappen" ? "</details>" : ""}`;
}

/** Tauwasserschutz in einer Zeile, für die eingeklappte Darstellung. */
function feuchteKurz(fe) {
  if (!fe) return "";
  const ok = fe.ok;
  return `<p class="feuchte-kurz">Tauwasserschutz nach DIN 4108-3: ${ok ? '<span class="u-ok">✓ erfüllt</span>' : '<span class="u-nein">✗ nicht erfüllt</span>, Details im Rechenweg'}</p>`;
}

/** Tauwasserschutz nach DIN 4108-3: luftdichte Ebene, Temperatur an der Dampfbremse, Glaser. */
export function feuchteHtml(fe, kw) {
  if (!fe) return "";
  const f = kw.feuchte, g = fe.glaser, b = fe.bahn;
  const zeichen = (ok) => `<span class="${ok ? "u-ok" : "u-nein"}">${ok ? "✓" : "✗"}</span>`;
  const li = [];
  if (fe.luftdicht === "innen") li.push(`<b>Luftdichte Ebene innen:</b> der Putz, mit überputzten Plattenstößen. Steckdosen und Schalter als luftdichte Hohlwanddosen, Durchführungen und Anschlüsse an Boden, Decke und Fenster luftdicht ausführen.${b ? "" : " Eine Dampfbremse ist nicht erforderlich: Die luftdichte Ebene liegt innen (Putz), nach außen ist der Aufbau diffusionsoffen."}`);
  else if (fe.luftdicht === "bahn") li.push(`<b>Luftdichte Ebene außen:</b> Die Steinfugen sind nicht luftdicht. ${b?.einbau || "Die Dampfbremse wird nach der Gefachdämmung auf die Holz-UK getackert und an Stößen, Rändern und Anschlüssen luftdicht verklebt. Die Schrauben der Konterlattung durchdringen sie unter Pressung; das gilt nach DIN 4108-7, 6.1.2 als ausreichend luftdicht."} Damit Raumluft an der Bahn nicht kondensiert, muss sie warm genug bleiben.`);
  else li.push(`<b>Keine luftdichte Ebene:</b> Die Steinfugen sind nicht luftdicht, und dieser Aufbau hat keine luftdichte Schicht. Innenseite verputzen oder eine luftdichte Bahn vorsehen. ${zeichen(false)}`);
  if (b) {
    const urteil = b.ok ? zeichen(true) : fe.bahnPflicht ? `${zeichen(false)} zu kalt` : "Unter dem Taupunkt; zulässig, weil die Innenseite luftdicht ist und der Glaser-Nachweis aufgeht";
    li.push(`<b>Temperatur an der Dampfbremse:</b> ${de(b.theta, 1)} °C bei ${de(f.tau.theta_e, 0)} °C außen, Taupunkt der Raumluft ${de(b.taupunkt, 1)} °C, Abstand ${de(b.theta - b.taupunkt, 1)} K. R außen / R innen = ${de(b.verhaeltnis)}; Planungsregel mindestens ${de(b.verhaeltnis_min, 1)}, Grenze aus dem Taupunkt ${de(b.verhaeltnis_din)}. ${urteil}`);
  }
  li.push(g.tauwasser_kg_m2 > 0
    ? `<b>Glaser-Verfahren:</b> ${de(g.tauwasser_kg_m2, 3)} kg/m² Tauwasser an ${g.ebenen.map(esc).join(", ")}, zulässig ${de(g.grenze_kg_m2, 1)} kg/m². Verdunstung im Sommer ${de(g.verdunstung_kg_m2, 2)} kg/m².${g.holz.map((h) => ` Feuchtezunahme ${esc(h.name)}: ${de(h.zunahme * 100, 1)} %, zulässig ${de(h.max * 100, 0)} %.`).join("")} ${zeichen(g.ok)}`
    : `<b>Glaser-Verfahren:</b> kein Tauwasser im Bauteil. ${zeichen(true)}`);
  return `
    <h3>Tauwasserschutz nach DIN 4108-3</h3>
    <ul class="feuchte">${li.map((t) => `<li>${t}</li>`).join("")}</ul>
    <p class="klein">Tauperiode ${de(f.tau.theta_i, 0)} °C / ${de(f.tau.phi_i * 100, 0)} % innen, ${de(f.tau.theta_e, 0)} °C / ${de(f.tau.phi_e * 100, 0)} % außen, je ${f.tau.stunden} h; R<sub>si</sub> = ${de(f.Rsi)}, R<sub>se</sub> = ${de(f.Rse)}; Gefachschnitt bis zur Hinterlüftung. Bedingung an der Bahn: Temperatur ≥ Taupunkt, daraus R außen / R innen ≥ (θ<sub>s</sub> − θ<sub>e</sub>) / (θ<sub>i</sub> − θ<sub>s</sub>); geplant wird mit mindestens ${de(f.bahn_verhaeltnis_min || 0, 1)}. ${f.quelle_analyse || ""}</p>`;
}
