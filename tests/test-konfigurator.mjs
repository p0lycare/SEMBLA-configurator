// Regressionstests des Konfigurators. Laufen lokal (`npm test`) und in der Action, die den
// Rechenkern der Planungs-Suite übernimmt: nur wenn sie grün sind, geht ein neuer Kern live.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { berechne, oeffnungenAufloesen, oeffnungsMasse, schraubenlaenge, schichtLagen, DECKENFUGE_MM, AUSGLEICH_MIN_MM, zusammenfassung } from "../js/wand.js";
import { GRID, FORBIDDEN_N } from "../js/sembla-core.js";
import { stueckliste, alsCsv } from "../js/stueckliste.js";
import { auslegen, uWert, mitDaemmung } from "../js/waerme.js";
import { feuchteschutz, glaserSchichten, ps, taupunkt } from "../js/feuchte.js";
import { wandAlsIfc } from "../js/export-ifc.js";
import { wandaufbau, wandaufbauAusLink, FORMAT } from "../js/export-hygro.js";
import { traglattenReihen } from "../js/aufbau-geometrie.js";
import { freieHoehen, nachweis } from "../js/verbinder.js";
import { wandAlsDxf } from "../js/export-dxf.js";
import { wandAlsLv, lvDaten } from "../js/export-lv.js";
import { zeichneSchnitt } from "../js/schnitt2d.js";
import { planungHtml } from "../js/inhalte.js";
import { wandAlsGaeb } from "../js/export-gaeb.js";
import { zustandAusUrl, urlParameter, aufbauWahl, datenblattParameter, RECHENSTAND, STANDARD, regelnHtml, feuchteHtml } from "../js/inhalte.js";

const A = JSON.parse(readFileSync(new URL("../data/aufbauten.json", import.meta.url), "utf8"));
const fass = (id) => A.fassaden.find((f) => f.id === id);
const inn = (id) => A.innen.find((f) => f.id === id);

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };

const T = { art: "tuer" }, F = { art: "fenster" };
const VARIANTEN = { keine: [], tuer: [T], fenster: [F], tuer_2fenster: [T, F, F], fenster3: [F, F, F] };

// Referenzwände: verschiedene Längen, Höhen, Öffnungen und Aufbauten.
const FAELLE = [];
for (const laenge_mm of [1000, 2000, 3875, 6000, 12000])
  for (const raumhoehe_mm of [2500, 2850, 5000])
    for (const [vname, oeffnungen] of Object.entries(VARIANTEN))
      for (const [f, i] of [["schindel", "lehm"], ["terrakotta", "trockenbau"], ["sicht", "sicht"]])
        FAELLE.push({ laenge_mm, raumhoehe_mm, oeffnungen, vname, fassade: fass(f), innen: inn(i) });
const R = FAELLE.map((cfg) => ({ cfg, r: berechne(cfg) }));

test("alle Referenzwände sind rechenbar und baubar", () => {
  for (const { cfg, r } of R) {
    assert.ok(r.w.validation.buildable, `${cfg.laenge_mm}/${cfg.vname}`);
    assert.ok(r.w.validation.versatz_ok, `Versatz ${cfg.laenge_mm}/${cfg.vname}`);
    assert.equal(r.kennzahlen.steine, r.w.courses.reduce((a, c) => a + c.stones.length, 0));
    assert.ok(r.kennzahlen.spannachsen >= 1);
  }
});

test("Wandhöhe = lichte Höhe minus Deckenfuge, Lagen 200 mm plus höchstens eine Ausgleichslage", () => {
  for (const { cfg, r } of R) {
    const top = r.w.courses[r.w.courses.length - 1].oberkante_mm;
    assert.equal(top, cfg.raumhoehe_mm - r.kennzahlen.deckenfuge_mm);
    assert.ok(r.w.courses.filter((c) => c.ausgleich).length <= 1);
    r.w.courses.filter((c) => !c.ausgleich).forEach((c) => assert.equal(c.hoehe_mm, 200));
    r.w.courses.filter((c) => c.ausgleich).forEach((c) => assert.ok(c.hoehe_mm >= AUSGLEICH_MIN_MM));
    assert.ok(r.kennzahlen.deckenfuge_mm >= DECKENFUGE_MM && r.kennzahlen.deckenfuge_mm < DECKENFUGE_MM + AUSGLEICH_MIN_MM);
  }
});

test("mehrere Öffnungen: überlappungsfrei, Wandstücke ≥ 2 Raster und nie 1 oder 4", () => {
  for (const { r } of R) {
    const N = r.w.length_mm / GRID;
    const s = r.oeffnungen.filter(Boolean).sort((a, b) => a.g0 - b.g0);
    let rand = 0;
    for (const o of s) { const st = o.g0 - rand; assert.ok(st >= 2 && !FORBIDDEN_N.has(st)); rand = o.g1; }
    assert.ok(N - rand >= 2 && !FORBIDDEN_N.has(N - rand));
  }
  const r = berechne({ laenge_mm: 12000, raumhoehe_mm: 2850, oeffnungen: [T, F, F, F], fassade: fass("sicht"), innen: inn("sicht") });
  assert.equal(r.oeffnungen.filter(Boolean).length, 4, "12 m Wand fasst Tür + 3 Fenster");
  assert.equal(r.w.openings.length, 4);
});

test("Öffnung rastet auf die nächste baubare Position und weicht anderen aus", () => {
  const L = 6000, H = 2800;
  const [t] = oeffnungenAufloesen(L, H, [{ art: "tuer", pos: 10 }]);
  assert.ok(Math.abs(t.g0 - 10) <= 3);
  const [a, b] = oeffnungenAufloesen(L, H, [{ art: "fenster", pos: 10 }, { art: "fenster", pos: 10 }], 1);
  assert.equal(a.g0, 10, "die ruhende Öffnung bleibt");
  assert.ok(b.g0 >= a.g1 + 2 || b.g1 <= a.g0 - 2, "die bewegte weicht aus");
});

test("Öffnungsmaße wählbar, mehrere Türen, Maße in der URL", () => {
  const L = 6000, H = 2820;
  const [t, f] = oeffnungenAufloesen(L, H, [{ art: "tuer", pos: 4, b: 10, h: 12 }, { art: "fenster", pos: 30, b: 12, h: 5, u: 3 }]);
  assert.deepEqual([t.g1 - t.g0, t.l0, t.l1], [10, 0, 12], "Tür 1,25 × 2,40 m");
  assert.deepEqual([f.g1 - f.g0, f.l0, f.l1], [12, 3, 8], "Fenster 1,50 × 1,00 m, Brüstung 0,60 m");
  assert.deepEqual(oeffnungsMasse({ art: "tuer", b: 99, h: 1 }), { b: 16, h: 10, u: 0 }, "auf den Bereich begrenzt");
  // Tür höher als die Wand minus eine Lage: passt nicht
  assert.equal(oeffnungenAufloesen(L, 2480, [{ art: "tuer", h: 13 }])[0], null);
  const r = berechne({ laenge_mm: 9000, raumhoehe_mm: 2850, oeffnungen: [{ art: "tuer", pos: null }, { art: "tuer", pos: null }, { art: "tuer", pos: null }] });
  assert.equal(r.oeffnungen.filter(Boolean).length, 3, "drei Türen auf 9 m");
  const z = zustandAusUrl(new URLSearchParams("o=t4b10h12,t30,f20u3"));
  assert.deepEqual(z.oeffnungen, [{ art: "tuer", pos: 4, b: 10, h: 12 }, { art: "tuer", pos: 30 }, { art: "fenster", pos: 20, u: 3 }]);
  assert.equal(urlParameter(z, berechne({ ...z, fassade: fass("sicht"), innen: inn("sicht") })).o.split(",")[0].replace(/^t\d+/, ""), "b10h12", "Maße bleiben im Link");
});

test("Verbinder nach Modul 2: nur innen in einem Stein, in Lagenmitte, nie in Öffnung oder Ausgleichslage", () => {
  for (const { r } of R) {
    for (const p of [...r.fa.punkte, ...r.ia.punkte]) {
      const c = r.w.courses[p.lage];
      assert.ok(c, "Lage gefunden");
      assert.equal(p.x % (GRID / 10 * 10), 0, "Nutraster");
      assert.ok(c.stones.some((s) => s.x0 < p.x && p.x < s.x1), "Stoßfuge oder kein Stein");
      assert.equal(p.y, (c.unterkante_mm + c.oberkante_mm) / 2, "Steinmitte");
      assert.ok(!c.ausgleich, "nicht in der Ausgleichslage");
      for (const op of r.w.openings)
        assert.ok(!(op.g0 * GRID < p.x && p.x < op.g1 * GRID && op.l0 <= p.lage && p.lage < op.l1), "in Öffnung");
    }
  }
});

test("Lattensegmente liegen auf den Achsen und nie in einer Öffnung", () => {
  for (const { r } of R) for (const s of r.fa.segmente) {
    assert.ok(r.fa.achsen.includes(s.x));
    assert.ok(s.y1 > s.y0);
    for (const op of r.w.openings) {
      const y0 = r.w.courses[op.l0].unterkante_mm, y1 = r.w.courses[op.l1 - 1].oberkante_mm;
      assert.ok(!(op.g0 * GRID < s.x && s.x < op.g1 * GRID && s.y0 < y1 && s.y1 > y0), "Latte in Öffnung");
    }
  }
});

test("Ohne Aufbau gibt es keine Verbinder", () => {
  const r = berechne({ laenge_mm: 3000, raumhoehe_mm: 2600, oeffnungen: [], fassade: fass("sicht"), innen: inn("sicht") });
  assert.equal(r.fa.punkte.length + r.ia.punkte.length, 0);
});

test("Schraubenregel: Latte 24 + Platte 80 + 50 mm Einbindung → 6 × 160, Spitze 4 mm vor dem Stein", () => {
  const s = schraubenlaenge(fass("schindel"));
  assert.equal(s.laenge_mm, 160);
  assert.equal(s.durchmesser_mm, 6);
  assert.equal(schraubenlaenge(fass("holzleiste")).laenge_mm, 140);
  assert.equal(schraubenlaenge(fass("terrakotta")), null);
});

test("Aufbaudaten sind vollständig", () => {
  const arten = new Set(["staender", "feld", "platte", "latte_v", "latte_h", "schindel", "leiste_h", "paneel", "halter"]);
  for (const a of [...A.fassaden, ...A.innen]) {
    assert.ok(a.id && a.name && a.kurz, a.id);
    if (a.schichten.length) assert.ok(a.achsraster_mm % GRID === 0, a.id);
    for (const s of schichtLagen(a.schichten)) {
      assert.ok(arten.has(s.art), `${a.id}/${s.id}: Art ${s.art}`);
      assert.ok(s.dicke > 0 && A.materialien[s.material], `${a.id}/${s.id}`);
    }
  }
});

test("Stückliste stimmt mit dem Rechenkern überein", () => {
  for (const { cfg, r } of R) {
    const g = stueckliste(r, cfg.fassade, cfg.innen);
    const alle = g.flatMap((x) => x.teile);
    const summe = (sym) => alle.filter((t) => t.symbol === sym).reduce((a, t) => a + t.menge, 0);
    assert.equal(summe("i3") + summe("i2"), r.w.bom.i2 + r.w.bom.i3, "Steine");
    assert.equal(summe("stange"), r.w.bom.gewindestangen, "Gewindestangen");
    assert.equal(summe("bodenblech"), r.w.base_plate.teile.length, "Bodenbleche");
    assert.equal(summe("verbinder"), r.fa.punkte.length + r.ia.punkte.length, "Verbinder");
    alle.forEach((t) => assert.ok(t.menge > 0 && Number.isFinite(t.menge) && t.name && t.einheit, JSON.stringify(t)));
    assert.ok(alsCsv(g).split("\r\n").length === alle.length + 1);
  }
});

test("Wärmeschutz: jede gedämmte Fassade erreicht GEG und BEG, dünnste Kombination mit Tauwasserschutz", () => {
  const kw = A.waerme;
  for (const f of A.fassaden.filter((x) => x.daemmstufen)) {
    for (const id of Object.keys(f.daemmstufen.schichten)) assert.ok(f.schichten.some((s) => s.id === id), `${f.id}/${id}`);
    if (f.daemmstufen.aussen) assert.ok(f.schichten.some((s) => s.id === f.daemmstufen.aussen.schicht), `${f.id}: Plattenschicht`);
    for (const i of A.innen) for (const z of kw.ziele.filter((x) => x.id !== "eh40")) {
      const r = auslegen(f, i, kw, z.U);
      assert.ok(r.erfuellt && r.U <= z.U, `${f.id}/${i.id}/${z.id}: U = ${r.U}`);
      assert.ok(r.feuchte.tauwasserOk, `${f.id}/${i.id}/${z.id}: Tauwasserschutz`);
      // Minimal: keine dünnere Kombination erfüllt Ziel und Tauwasserschutz.
      const summe = r.daemmung_mm + (r.daemmung_aussen_mm || 0);
      for (const d of f.daemmstufen.dicken) for (const da of f.daemmstufen.aussen ? f.daemmstufen.aussen.dicken : [null]) {
        if (d + (da || 0) >= summe) continue;
        const a = mitDaemmung(f, d, da);
        if (a.schraube && !schraubenlaenge(a).laenge_mm) continue;
        assert.ok(uWert(a, i, kw).U > z.U || !feuchteschutz(a, i, kw).ok, `${f.id}/${i.id}/${z.id}: ${d}+${da} wäre dünner`);
      }
      assert.ok(!r.aufbau.schichten.some((s) => /\{da?\}/.test(s.name)), "Platzhalter ersetzt");
      if (r.aufbau.schraube) assert.ok(schraubenlaenge(r.aufbau).laenge_mm, `${f.id}: Schraube bei ${r.daemmung_mm} mm`);
    }
  }
  // Plausibel: mehr Dämmung, kleinerer U-Wert.
  const h = fass("schindel"), u = (d, da = 80) => uWert(mitDaemmung(h, d, da), inn("sicht"), kw).U;
  assert.ok(u(60) > u(120) && u(120) > u(240) && u(60, 80) > u(60, 160));
  assert.ok(u(120) > 0.15 && u(120) < 0.3, `U(120) = ${u(120)}`);
});

test("Tauwasserschutz: Taupunkt an der Dampfbremse und Glaser nach DIN 4108-3", () => {
  const kw = A.waerme, f = kw.feuchte;
  // Sättigungsdruck und Taupunkt (DIN 4108-3): 20 °C → 2337 Pa, Taupunkt bei 50 % ≈ 9,3 °C.
  assert.ok(Math.abs(ps(20) - 2337) < 2 && Math.abs(ps(-5) - 401) < 2, `ps ${ps(20)} ${ps(-5)}`);
  assert.ok(Math.abs(taupunkt(20, 0.5) - 9.3) < 0.05);
  const h = fass("schindel");
  // Ohne luftdichte Innenseite ist die Bahn die luftdichte Ebene und muss über dem Taupunkt liegen.
  const offen = feuchteschutz(mitDaemmung(h, 120, 80), inn("lehm"), kw);
  assert.equal(offen.luftdicht, "bahn");
  assert.ok(!offen.bahn.ok && !offen.ok, "120 + 80 mm: Bahn zu kalt");
  const warm = feuchteschutz(mitDaemmung(h, 60, 160), inn("lehm"), kw);
  assert.ok(warm.bahn.ok && warm.ok && warm.bahn.verhaeltnis >= warm.bahn.verhaeltnis_min);
  // Temperatur an der Bahn passt zum Verhältnis R außen / R innen.
  const t = f.tau.theta_i - (f.tau.theta_i - f.tau.theta_e) / (1 + warm.bahn.verhaeltnis);
  assert.ok(Math.abs(t - warm.bahn.theta) < 1e-9);
  // Verputzt: luftdichte Ebene innen, Glaser entscheidet; Tauwasser an der Bahn höchstens 0,5 kg/m² und es trocknet aus.
  const putz = feuchteschutz(mitDaemmung(h, 200, 60), inn("lehm_putz"), kw);
  assert.equal(putz.luftdicht, "innen");
  assert.ok(putz.glaser.tauwasser_kg_m2 > 0 && putz.glaser.grenze_kg_m2 === f.grenzen.nicht_saugend_kg_m2);
  assert.equal(putz.ok, putz.glaser.tauwasser_kg_m2 <= 0.5 && putz.glaser.verdunstung_kg_m2 >= putz.glaser.tauwasser_kg_m2);
  // Glaser-Bilanz: ohne Bahn und mit diffusionsoffener Dämmung kein Tauwasser; Alu-UK ohne Putz ohne luftdichte Ebene.
  const alu = feuchteschutz(mitDaemmung(fass("terrakotta"), 160), inn("trockenbau"), kw);
  assert.equal(alu.luftdicht, null);
  assert.equal(alu.glaser.tauwasser_kg_m2, 0);
  // Der Dampfdruck bleibt überall unter dem Sättigungsdruck.
  const g = putz.glaser;
  const p = (x) => { for (let k = 1; k < g.huelle.length; k++) { const a = g.huelle[k - 1], b = g.huelle[k]; if (x <= b.x) return a.y + (b.y - a.y) * (x - a.x) / Math.max(b.x - a.x, 1e-12); } return g.pe; };
  g.knoten.slice(1, -1).forEach((k) => assert.ok(p(k.x) <= k.ps + 1e-6, `p > ps bei x = ${k.x}`));
});

test("Wärmeschutz in berechne: ein Wandhalter je FA-Verbinder geht in den U-Wert ein", () => {
  const kw = A.waerme;
  for (const id of ["terrakotta", "schindel"]) for (const o of [[], [T, F]]) for (const z of kw.ziele) {
    const r = berechne({ laenge_mm: 6000, raumhoehe_mm: 2850, oeffnungen: o, fassade: fass(id), innen: inn("lehm"), waerme: { kennwerte: kw, ziel_U: z.U } });
    const dichte = r.fa.punkte.length / r.kennzahlen.flaeche_m2;
    if (fass(id).uk === "alu") assert.ok(Math.abs(r.waerme.zuschlag - kw.halter.chi_W_K * dichte) < 1e-9, "Zuschlag");
    else assert.equal(r.waerme.zuschlag, 0);
    assert.equal(r.fassade.daemmung_mm, r.waerme.daemmung_mm);
    if (z.id !== "eh40") assert.ok(r.waerme.erfuellt, `${id}/${z.id}: U = ${r.waerme.U}`);
  }
});

test("Steingeometrie: i2/i3 im Raster, 200 mm hoch, 125 mm tief", () => {
  const S = JSON.parse(readFileSync(new URL("../data/steine.json", import.meta.url), "utf8"));
  for (const [typ, laenge] of [["i3", 375], ["i2", 250]]) {
    const v = S[typ].v, xs = v.filter((_, i) => i % 3 === 0), ys = v.filter((_, i) => i % 3 === 1), zs = v.filter((_, i) => i % 3 === 2);
    assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= laenge, typ + " Länge");
    assert.ok(Math.min(...ys) >= 0 && Math.max(...ys) <= 200, typ + " Höhe");
    assert.ok(Math.min(...zs) >= -125 && Math.max(...zs) <= 0, typ + " Tiefe");
    assert.ok(S[typ].f.length % 3 === 0 && Math.max(...S[typ].f) < v.length / 3, typ + " Indizes");
  }
});

test("Gewindestangen: kein Zuschnitt unter 200 mm ohne Hinweis, immer mit Spannstück", () => {
  for (const L of [2000, 6000, 12000]) for (const o of [[], [T], [F], [T, F]]) for (let h = 2500; h <= 5000; h += 50) {
    const r = berechne({ laenge_mm: L, raumhoehe_mm: h, oeffnungen: o });
    const konflikte = (r.w.validation.zuschnitt_konflikte || []).map((k) => k.grund);
    assert.ok(!konflikte.includes("kein_reststueck"), `${L}/${h}: Spannstück fehlt`);
    const kurz = stueckliste(r, fass("sicht"), inn("sicht")).flatMap((g) => g.teile)
      .filter((t) => /Gewindestange/.test(t.name) && t.art !== "rest" && t.laenge < 200);
    if (kurz.length) assert.ok(r.hinweise.some((x) => x.includes("unter 20 cm")), `${L}/${h}: kurzes Stück ohne Hinweis`);
  }
  // Ab der Mindesthöhe passt die Tür in eine 6-m-Wand.
  assert.ok(berechne({ laenge_mm: 6000, raumhoehe_mm: 2500, oeffnungen: [T] }).oeffnungen[0]);
});

test("URL: Voreinstellung, unbekannte Varianten, strenge Öffnungen, Datenblatt-Link mit Rechenstand", () => {
  const z = zustandAusUrl(new URLSearchParams(""));
  assert.deepEqual([z.fassade, z.innen, z.ziel], [STANDARD.fassade, STANDARD.innen, STANDARD.ziel]);
  assert.equal(z.ziel, "beg");
  const alt = zustandAusUrl(new URLSearchParams("f=gibtsnicht&i=lehm&o=t5,zz,T3,f1e5,f9"));
  const w = aufbauWahl(A, alt);
  assert.equal(w.roh.id, STANDARD.fassade);
  assert.deepEqual(alt.ersetzt, ["fassade"]);
  assert.deepEqual(alt.oeffnungen, [{ art: "tuer", pos: 5 }, { art: "fenster", pos: 9 }]);
  // Datenblatt-Link: Rechenstand und Dämmstärken; mit ihnen wird nicht neu ausgelegt.
  const z2 = zustandAusUrl(new URLSearchParams("f=schindel&i=lehm"));
  const a2 = aufbauWahl(A, z2);
  const r2 = berechne({ ...z2, fassade: a2.roh, innen: a2.innen, waerme: a2.waerme });
  const p = datenblattParameter(z2, r2);
  assert.equal(p.v, RECHENSTAND);
  assert.equal(p.dd, r2.fassade.daemmung_mm);
  const z3 = zustandAusUrl(new URLSearchParams("f=schindel&i=lehm&v=1&dd=120&da=80"));
  const a3 = aufbauWahl(A, z3);
  const r3 = berechne({ ...z3, fassade: a3.roh, innen: a3.innen, waerme: a3.waerme });
  assert.deepEqual([r3.fassade.daemmung_mm, r3.fassade.daemmung_aussen_mm], [120, 80]);
  // Nicht passende Stärken werden ignoriert.
  assert.ok(!aufbauWahl(A, zustandAusUrl(new URLSearchParams("f=schindel&dd=7"))).waerme.fest);
});

test("Exporte: IFC4, DXF und Ausschreibungstext für jede Fassade und Innenseite", () => {
  for (const f of A.fassaden) for (const i of A.innen) {
    const z = zustandAusUrl(new URLSearchParams(`f=${f.id}&i=${i.id}&o=t21,f5`)); const a = aufbauWahl(A, z);
    const r = berechne({ ...z, fassade: a.roh, innen: a.innen, waerme: a.waerme });
    const ifc = wandAlsIfc(r, r.fassade, a.innen, { link: "https://example.org/?a=1&b=ä" });
    assert.ok(ifc.startsWith("ISO-10303-21;") && ifc.trimEnd().endsWith("END-ISO-10303-21;"), "IFC-Rahmen");
    assert.ok(ifc.includes("FILE_SCHEMA(('IFC4'))") && ifc.includes("IFCWALL(") && ifc.includes("IFCMATERIALLAYERSETUSAGE("));
    assert.equal((ifc.match(/IFCOPENINGELEMENT\(/g) || []).length, r.w.openings.length, "Öffnungen");
    assert.ok(!/[^\x00-\x7F]/.test(ifc), "IFC nur ASCII");
    const ids = new Set([...ifc.matchAll(/^#(\d+)=/gm)].map((m) => m[1]));
    for (const [, ref] of ifc.matchAll(/#(\d+)(?!=)/g)) assert.ok(ids.has(ref), `IFC-Verweis #${ref}`);
    // Schichtdicken ergeben die Wanddicke aus dem Rechenkern.
    const dicken = [...ifc.matchAll(/IFCMATERIALLAYER\(#\d+,([\d.]+),/g)].reduce((s2, m) => s2 + +m[1], 0);
    assert.ok(Math.abs(dicken - r.kennzahlen.dicke_gesamt_mm) < 0.01, `${f.id}/${i.id}: ${dicken} ≠ ${r.kennzahlen.dicke_gesamt_mm}`);
    const dxf = wandAlsDxf(r, r.fassade, a.innen);
    assert.ok(dxf.includes("AC1009") && dxf.trimEnd().endsWith("EOF") && !/[^\x00-\x7F]/.test(dxf), "DXF");
    const steine = r.w.courses.reduce((s2, c) => s2 + c.stones.length, 0);
    assert.ok((dxf.match(/\r\nPOLYLINE\r\n/g) || []).length >= steine, "ein Rechteck je Stein");
    const lv = wandAlsLv(r, r.fassade, a.innen);
    assert.ok(/01\.01 {2}Trockenmauerwerk SEMBLA/.test(lv) && !/NaN|undefined|null/.test(lv), `${f.id}/${i.id}: LV`);
    assert.ok(!/tragende Wand aus/.test(lv.replace("Nichttragende Wand aus", "")), `${f.id}/${i.id}: LV verspricht keine tragende Wand`);
    assert.ok(f.schichten?.length ? /Zustimmung im Einzelfall/.test(lv) : /DIN 4103-1/.test(lv), `${f.id}/${i.id}: Verwendbarkeit`);
      const lvd = lvDaten(r, r.fassade, a.innen, {});
      const alle = lvd.titel.flatMap((t) => t.positionen);
      assert.ok(alle.every((p) => p.kurz.length <= 70 && p.menge > 0 && !/undefined|NaN/.test(p.kurz + p.lang)), `${f.id}/${i.id}: LV-Positionen vollständig`);
      assert.equal(lvd.titel.some((t) => /Zustimmung im Einzelfall/.test(t.name)), !!f.schichten?.length, `${f.id}/${i.id}: ZiE-Titel nur mit Fassade`);
      assert.ok(!alle.some((p) => /^Bekleidung/.test(p.kurz) && p.einheit !== "m²"), `${f.id}/${i.id}: Bekleidung nach Fläche`);
      // GAEB X83 (gegen das XSD 3.3 geprüft, siehe README): je Position ein Item, IDs eindeutig.
      const x83 = wandAlsGaeb(r, r.fassade, a.innen, { titel: "Test & <Wand>" });
      assert.ok(x83.includes('xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.3"') && x83.includes("<DP>83</DP>"), `${f.id}/${i.id}: X83-Kopf`);
      assert.equal((x83.match(/<Item /g) || []).length, alle.length, `${f.id}/${i.id}: X83-Positionen`);
      assert.equal((x83.match(/<BoQCtgy /g) || []).length, lvd.titel.length, `${f.id}/${i.id}: X83-Titel`);
      const xids = [...x83.matchAll(/ ID="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(new Set(xids).size, xids.length, `${f.id}/${i.id}: X83-IDs eindeutig`);
      assert.ok(x83.includes("Test &amp; &lt;Wand&gt;") && !/Test & </.test(x83), `${f.id}/${i.id}: X83 maskiert`);
  }
});

test("Holz-UK: Latten bis zum Rand, Traglatte an der Krone, Fassadenachsen ohne Restfeld", () => {
  const f = fass("schindel");
  for (const L of [2000, 3875, 6000, 12000]) for (const o of [[], [T], [T, F]]) for (const h of [2500, 2850, 3350]) {
    const r = berechne({ laenge_mm: L, raumhoehe_mm: h, oeffnungen: o, fassade: f, innen: inn("trockenbau_putz") });
    const H = r.w.height_mm;
    const kanten = new Set([0, H, ...r.w.openings.flatMap((op) => [r.w.courses[op.l0].unterkante_mm, r.w.courses[op.l1 - 1].oberkante_mm])]);
    for (const s of [...r.fa.segmente, ...r.ia.segmente]) assert.ok(kanten.has(s.y0) && kanten.has(s.y1), `${L}/${h}: Latte ${s.x} ${s.y0}–${s.y1}`);
    // Außen: kein Feld schmaler als 25 cm zwischen Achsen, außer an Öffnungskanten.
    const ax = r.fa.achsen;
    if (!o.length) for (let i = 1; i < ax.length; i++) assert.ok(ax[i] - ax[i - 1] >= 375, `${L}: Achsabstand ${ax[i] - ax[i - 1]}`);
  }
  const reihen = traglattenReihen(2800, f.schichten.find((s) => s.id === "traglatte"));
  assert.ok(2800 - (reihen.at(-1) + 50) <= 20 && reihen[0] === 60);
});

test("Auswahl: nur freigegebene Varianten, Voreinstellung freigegeben", () => {
  const frei = (l) => l.filter((x) => x.freigegeben !== false).map((x) => x.id);
  assert.deepEqual(frei(A.fassaden), ["sicht", "schindel", "schindel_einlagig", "holzleiste_einlagig"]);
  assert.deepEqual(frei(A.innen), ["sicht", "trockenbau_putz"]);
  const z = zustandAusUrl(new URLSearchParams("f=terrakotta&i=lehm"));
  const a = aufbauWahl(A, z, { nurFreigegeben: true });
  assert.deepEqual([a.roh.id, a.innen.id], [STANDARD.fassade, STANDARD.innen]);
  assert.deepEqual(z.ersetzt, ["fassade", "innen"]);
  // Ältere Datenblatt-Links mit nicht freigegebenen Varianten bleiben rechenbar.
  assert.equal(aufbauWahl(A, zustandAusUrl(new URLSearchParams("f=terrakotta&i=lehm"))).roh.id, "terrakotta");
});

test("Zweilagige Holzleiste: im Konfigurator auf die einlagige umgestellt, im Datenblatt unverändert", () => {
  const z = zustandAusUrl(new URLSearchParams("f=holzleiste"));
  assert.equal(aufbauWahl(A, z, { nurFreigegeben: true }).roh.id, "holzleiste_einlagig");
  assert.deepEqual(z.umgestellt.map(([a, n]) => [a.id, n.id]), [["holzleiste", "holzleiste_einlagig"]]);
  assert.deepEqual(z.ersetzt, []);
  assert.equal(aufbauWahl(A, zustandAusUrl(new URLSearchParams("f=holzleiste"))).roh.id, "holzleiste");
});

test("Holz-UK: jede Dämmkombination hat eine Schraube; verputzt ohne Dampfbremse, Installationsebene gedämmt", () => {
  for (const id of ["schindel", "holzleiste"]) {
    const f = fass(id);
    for (const d of f.daemmstufen.dicken) for (const da of f.daemmstufen.aussen.dicken)
      assert.ok(schraubenlaenge(mitDaemmung(f, d, da)).laenge_mm, `${id} ${d}+${da}`);
    const cfg = { laenge_mm: 6000, raumhoehe_mm: 2850, oeffnungen: [], fassade: f, waerme: { kennwerte: A.waerme, ziel_U: 0.2 } };
    const putz = berechne({ ...cfg, innen: inn("trockenbau_putz") }), sicht = berechne({ ...cfg, innen: inn("sicht") });
    const bahn = (r) => r.fassade.schichten.some((s) => s.material === "bahn");
    assert.equal(bahn(putz), false, id);
    assert.equal(bahn(sicht), true, id);
    assert.ok(putz.waerme.feuchte.ok && putz.waerme.erfuellt, id);
    assert.ok(sicht.waerme.feuchte.ok && sicht.waerme.feuchte.bahn.ok, id);
    // Stückliste innen: Dämmung der Installationsebene ohne den Lattenanteil
    const teil = stueckliste(putz, putz.fassade, inn("trockenbau_putz")).find((g) => g.id === "innen").teile.find((t) => t.symbol === "feld");
    assert.ok(teil && Math.abs(teil.menge - putz.kennzahlen.flaeche_m2 * (1 - 58 / 625)) < 0.01, id);
  }
  const standard = berechne({ laenge_mm: 6000, raumhoehe_mm: 2850, oeffnungen: [], fassade: fass("schindel"), innen: inn("trockenbau_putz"), waerme: { kennwerte: A.waerme, ziel_U: 0.2 } });
  assert.equal(standard.kennzahlen.dicke_gesamt_mm, 437.5);
});

test("Verbinder: Vorbemessung, Ergänzung nur in freien Nuten, alle halten", () => {
  const kv = A.verbinder;
  assert.deepEqual([kv.rd_kN.zug, kv.rd_kN.quer_parallel], [0.6, 0.3]);
  for (const f of ["schindel", "holzleiste"]) for (const o of [[], [T], [T, F, F]]) for (const [l, h] of [[6000, 2850], [3000, 4500], [12000, 5000]]) {
    const cfg = { laenge_mm: l, raumhoehe_mm: h, oeffnungen: o, fassade: fass(f), innen: inn("trockenbau_putz"),
      waerme: { kennwerte: A.waerme, ziel_U: 0.2 }, verbinder: kv };
    const r = berechne(cfg), ohne = berechne({ ...cfg, verbinder: undefined });
    const name = `${f} ${l}×${h} ${o.length}`;
    for (const [k, ver] of [["fa", r.fa], ["ia", r.ia]]) {
      assert.ok(r.bemessung[k].max <= 1 + 1e-9 && r.bemessung[k].offen === 0, `${name} ${k} ${r.bemessung[k].max}`);
      // Ergänzte Verbinder: Steinmitte, in einem Stein (nicht in der Fuge), auf einer Latte
      for (const p of ver.punkte.filter((p) => p.ergaenzt)) {
        assert.ok(freieHoehen(r.w, p.x).includes(p.y), `${name} ${p.x}/${p.y}`);
        assert.ok(ver.segmente.some((s) => s.x === p.x && s.y0 < p.y && p.y < s.y1), `${name} Latte ${p.x}/${p.y}`);
      }
    }
    assert.equal(r.kennzahlen.verbinder_fa, r.fa.punkte.length);
    assert.ok(r.fa.punkte.length >= ohne.fa.punkte.length);
    assert.ok(r.bemessung.fa.qp_grenze >= kv.last.qp_kN_m2 - 1e-9, name);
  }
  // Ohne Fußauflager trägt der Verbinder das Eigengewicht der Schindel nicht (Mock-up: 126 %).
  const r = berechne({ laenge_mm: 6000, raumhoehe_mm: 2850, oeffnungen: [], fassade: fass("schindel"), innen: inn("sicht"),
    waerme: { kennwerte: A.waerme, ziel_U: 0.2 } });
  const ohneFuss = nachweis(r.w, r.fa, r.fa.punkte, r.fassade, "FA", { ...kv, fussauflager: false });
  assert.ok(Math.max(...ohneFuss.map((x) => x.eta)) > 1);
  // Stückliste: Fußauflager je Achse, Lüftungsprofil unten und oben
  const g = stueckliste(r, r.fassade, inn("sicht")).find((x) => x.id === "fassade").teile;
  assert.equal(g.find((t) => t.name === "Fußauflager").menge, r.fa.achsen.length);
  assert.equal(g.find((t) => t.symbol === "lueftung").menge, 12);
});

test("Feedback Felix: Sechskantschraube, Vergussmasse, Texte nach Gutachten", () => {
  const r = berechne({ laenge_mm: 6000, raumhoehe_mm: 2850, oeffnungen: [T, F], fassade: fass("schindel"), innen: inn("trockenbau_putz"),
    waerme: { kennwerte: A.waerme, ziel_U: 0.2 } });
  const roh = stueckliste(r, r.fassade, inn("trockenbau_putz")).find((x) => x.id === "spann").teile;
  const sk = roh.find((t) => t.symbol === "sechskant");
  assert.ok(sk && /Sechskant/.test(sk.name) && sk.menge === r.w.bom.senkkopfschrauben);
  assert.ok(!roh.some((t) => /Senkkopf/.test(t.name)));
  const v = stueckliste(r, r.fassade, inn("trockenbau_putz")).find((x) => x.id === "untergrund").teile.find((t) => t.symbol === "verguss");
  assert.ok(v && v.einheit === "lfm" && Math.abs(v.menge - Math.round(r.w.base_plate.laenge_mm / 100) / 10) < 1e-9 && v.menge < 6);
  const html = feuchteHtml(r.waerme.feuchte, A.waerme) + regelnHtml(r, inn("trockenbau_putz"));
  assert.ok(!/bremst der Stein|kalte Bahn/.test(html));
  assert.ok(!/ins KVH|in die Latte/.test(html));
  assert.ok(A.waerme.ziele.find((z) => z.id === "eh40").richtwert);
});

test("Bodenblech unter Türen ausgespart (B4), Fenster ändern nichts", () => {
  for (const pos of [2, 20, 38]) {
    const r = berechne({ laenge_mm: 6000, raumhoehe_mm: 2820, oeffnungen: [{ art: "tuer", pos }, F], fassade: fass("schindel"), innen: inn("sicht"),
      waerme: { kennwerte: A.waerme, ziel_U: 0.2 } });
    const t = r.w.openings.find((o) => o.art === "tuer"), x0 = t.g0 * 125, x1 = t.g1 * 125;
    const bp = r.w.base_plate;
    assert.ok(bp.teile.every((b) => b.x0_mm + b.raster_mm <= x0 || b.x0_mm >= x1), `Blech unter Tür bei ${pos}`);
    assert.equal(bp.laenge_mm, 6000 - (x1 - x0));
    assert.equal(bp.teile.reduce((a, b) => a + b.raster_mm, 0), bp.laenge_mm);
    assert.ok(r.w.ausgleichspunkte.every((p) => p.x_mm <= x0 || p.x_mm >= x1));   // Bereichsenden sind Pflichtauflager ([A-31])
    const v = stueckliste(r, r.fassade, inn("sicht")).find((g) => g.id === "untergrund").teile[0];
    assert.ok(Math.abs(v.menge - bp.laenge_mm / 1000) < 0.051);
  }
  const ohneTuer = berechne({ laenge_mm: 6000, raumhoehe_mm: 2820, oeffnungen: [F], fassade: fass("sicht"), innen: inn("sicht"), waerme: { kennwerte: A.waerme, ziel_U: 0.2 } });
  assert.equal(ohneTuer.w.base_plate.laenge_mm, 6000);
});

test("Wiederverwendbarkeit (B15): mindestens 90 %, nie „alle Steine“", () => {
  const r = berechne({ laenge_mm: 6000, raumhoehe_mm: 2820, oeffnungen: [T], fassade: fass("schindel"), innen: inn("sicht"), waerme: { kennwerte: A.waerme, ziel_U: 0.2 } });
  const html = regelnHtml(r, inn("sicht")) + regelnHtml(r, inn("sicht"), true, { kurz: true }) + wandAlsLv(r, r.fassade, inn("sicht"));
  assert.ok(/mindestens 90 %/.test(html));
  assert.ok(!/alle \d+ Steine|Alle \d+ Steine|100 %/.test(html));
});

test("Wandschnitt (1.4): Gesamtdicke wie Kennwert, jede Zone in der Liste", () => {
  for (const [f, i] of [["schindel", "trockenbau_putz"], ["holzleiste_einlagig", "sicht"], ["sicht", "sicht"]]) {
    const r = berechne({ laenge_mm: 6000, raumhoehe_mm: 2820, oeffnungen: [T], fassade: fass(f), innen: inn(i), waerme: { kennwerte: A.waerme, ziel_U: 0.2 } });
    const el = {};
    const info = zeichneSchnitt(el, r, inn(i), A.materialien);
    assert.ok(Math.abs(info.gesamt_mm - r.kennzahlen.dicke_gesamt_mm) < 0.01, `${f}/${i}`);
    assert.equal((el.innerHTML.match(/<li>/g) || []).length, info.schichten);
    assert.ok(/SEMBLA-Stein/.test(el.innerHTML) && !/NaN|undefined/.test(el.innerHTML), `${f}/${i}`);
  }
});

test("B11/B19: Verbinder kurz für Kunden, Annahmen für Planende, Einlegebleche erklärt", () => {
  const r = berechne({ laenge_mm: 6000, raumhoehe_mm: 2820, oeffnungen: [T, F], fassade: fass("schindel"), innen: inn("trockenbau_putz"),
    waerme: { kennwerte: A.waerme, ziel_U: 0.2 }, verbinder: A.verbinder });
  const kunde = regelnHtml(r, inn("trockenbau_putz"), false);
  assert.ok(/Verbinder bemessen:<\/b> Jeder Verbinder hält den Windsog/.test(kunde));
  assert.ok(!/Windzone|Ausnutzung|Schrauben:/.test(kunde));
  assert.ok(/Einlegeblech mit Mutter \(\d+ Stück\)/.test(kunde));
  const planer = planungHtml(r, inn("trockenbau_putz"));
  assert.ok(/Windzone 2/.test(planer) && /außen höchstens \d+ %/.test(planer) && /Fußauflager/.test(planer) && /Holzbauschraube/.test(planer));
  const eb = stueckliste(r, r.fassade, inn("trockenbau_putz")).flatMap((g) => g.teile).find((t) => t.symbol === "einlegeblech");
  assert.ok(eb && /mittig/.test(eb.detail));
});

test("Anschlüsse (Robert, B20): Text für Kunden und Datenblatt, bauseitige Anschlussteile in der Stückliste", () => {
  const r = berechne({ laenge_mm: 6000, raumhoehe_mm: 2820, oeffnungen: [T], fassade: fass("sicht"), innen: inn("sicht"), waerme: { kennwerte: A.waerme, ziel_U: 0.2 } });
  assert.ok(/Angeschlossen, nicht eingespannt/.test(regelnHtml(r, inn("sicht"), true, { kurz: true })));
  const voll = regelnHtml(r, inn("sicht"), false);
  assert.ok(/<b>Anschlüsse:<\/b>/.test(voll) && /Deckenwinkel-Set \(\d+ Stück\)/.test(voll) && /Trennstreifen/.test(voll));
  assert.ok(!/\[…/.test(voll));   // Platzhalter nur im LV
  const g = stueckliste(r, r.fassade, inn("sicht"));
  assert.ok(g.find((x) => x.id === "anschluss").teile.some((t) => t.name === "Deckenwinkel-Set"));
  const bau = g.find((x) => x.id === "untergrund").teile;
  assert.equal(bau.find((t) => /Rohdecke/.test(t.name)).menge, r.w.deckenanschlusspunkte.length);
  assert.ok(Math.abs(bau.find((t) => t.symbol === "trennstreifen").menge - 2 * r.w.height_mm / 1000) < 0.051);
});

test("Review 12.11.: Längen im Raster mit drei Stellen, LV-Abrechnung, Wandaufbau-Export", () => {
  const r = berechne({ laenge_mm: 8625, raumhoehe_mm: 2820, oeffnungen: [F], fassade: fass("schindel"), innen: inn("trockenbau_putz"), waerme: { kennwerte: A.waerme, ziel_U: 0.2 } });
  assert.ok(/^Wand 8,625 × 2,80 m/.test(zusammenfassung({ fassade: r.fassade, innen: inn("trockenbau_putz") }, r)));
  assert.ok(!/über 2,5 m²/.test(wandAlsLv(r, r.fassade, inn("trockenbau_putz"))));
  const wa = wandaufbau(A, { fassade: "schindel", innen: "trockenbau_putz" });
  assert.equal(typeof wa.glaser_ok, "boolean");
  assert.equal(typeof wa.feuchteschutz_ok, "boolean");
});

test("Lieferumfang (B23): Polycare liefert Steine, Spannsystem, Anschlüsse und Verbinder, der Rest ist bauseits", () => {
  const r = berechne({ laenge_mm: 6000, raumhoehe_mm: 2820, oeffnungen: [T, F], fassade: fass("schindel"), innen: inn("trockenbau_putz"),
    waerme: { kennwerte: A.waerme, ziel_U: 0.2 } });
  const g = stueckliste(r, r.fassade, inn("trockenbau_putz"));
  assert.deepEqual(g.map((x) => `${x.id}:${x.lieferung}`), ["wand:polycare", "spann:polycare", "anschluss:polycare", "verbinder:polycare",
    "untergrund:bauseits", "fassade:bauseits", "innen:bauseits"]);
  const polycare = new Set(g.filter((x) => x.lieferung === "polycare").flatMap((x) => x.teile.map((t) => t.symbol)));
  for (const sym of ["i3", "stange", "spannplatte", "bodenblech", "ausgleichsblech", "deckenanschluss", "verbinder", "schraube"]) assert.ok(polycare.has(sym), sym);
  const bauseits = g.filter((x) => x.lieferung === "bauseits").flatMap((x) => x.teile);
  assert.ok(!bauseits.some((t) => t.symbol === "verbinder" || /Verbinderschraube/.test(t.name)));
  assert.ok(bauseits.some((t) => t.symbol === "verguss") && bauseits.some((t) => t.name === "Fußauflager"));
  // Das LV führt die Verbinder weiter bei Fassade und Innenseite.
  const lv = lvDaten(r, r.fassade, inn("trockenbau_putz"));
  assert.ok(lv.titel.filter((t) => /^(Fassade|Innenseite)/.test(t.name)).every((t) => /Verbinder/.test(t.positionen[0].kurz)));
  assert.ok(lv.titel[0].positionen.some((p) => /Deckenwinkel-Set/.test(p.kurz) && /Rohdecke mit Dübeln/.test(p.lang)));
});

test("Feuchteschutz: Stein nicht als Dampfbremse angesetzt, verputzte Innenseite ohne Dampfbremse", () => {
  const stein = glaserSchichten(fass("schindel"), inn("trockenbau_putz"), A.waerme).find((l) => /Stein/.test(l.name));
  assert.equal(stein.sd, 0);
  for (const f of ["schindel", "holzleiste"]) for (const i of ["trockenbau_putz", "lehm_putz", "sicht", "trockenbau"]) {
    const x = auslegen(fass(f), inn(i), A.waerme, 0.2);
    assert.ok(x.feuchte.tauwasserOk && x.erfuellt, `${f}/${i}`);
    assert.equal(x.aufbau.schichten.some((s) => s.id === "dampfbremse"), !inn(i).luftdicht, `${f}/${i}`);  // zweilagige Varianten
  }
});

test("Einlagig gedämmte Holz-UK: eine Dämmlage, Dampfbremse nur ohne Innenputz, auf dem Stein", () => {
  for (const id of ["schindel_einlagig", "holzleiste_einlagig"]) {
    for (const i of ["trockenbau_putz", "sicht"]) {
      const r = berechne({ laenge_mm: 6000, raumhoehe_mm: 2850, oeffnungen: [T, F], fassade: fass(id), innen: inn(i),
        waerme: { kennwerte: A.waerme, ziel_U: 0.2 } });
      const x = auslegen(fass(id), inn(i), A.waerme, 0.2);
      assert.ok(x.erfuellt && x.feuchte.tauwasserOk && x.feuchte.ok, `${id}/${i}`);
      const daemm = x.aufbau.schichten.filter((s) => s.lambda && s.art !== "staender");
      assert.ok(daemm.length <= 2 && daemm.every((s) => s.art === "feld" || s.dicke <= 22), `${id}: eine Dämmlage, höchstens 22 mm Platte`);
      // Dampfbremse immer auf dem Stein, auch mit Innenputz: robust gegen μ der Platte und die Fassadenbahn.
      assert.equal(x.aufbau.schichten[0].id, "dampfbremse", `${id}/${i}`);
      assert.ok(x.feuchte.bahn.ok && x.feuchte.bahn.verhaeltnis > 3 && x.feuchte.bahn.einbau, `${id}/${i}`);
      assert.ok(r.schraube?.laenge_mm, `${id}: Schraubenlänge`);
      const lv = lvDaten(r, r.fassade, inn(i)).titel.flatMap((t) => t.positionen);
      assert.ok(!lv.some((p) => /nach der Gefachdämmung/.test(p.lang)), id);
      if (id === "holzleiste_einlagig") assert.ok(lv.some((p) => /UV-stabil/.test(p.kurz)) && lv.some((p) => /über der Fassadenbahn/.test(p.lang)));
    }
  }
  // Die Fassadenbahn außen zählt nicht als Dampfbremse.
  const fe = auslegen(fass("holzleiste_einlagig"), inn("trockenbau_putz"), A.waerme, 0.2).feuchte;
  assert.ok(/Dampfbremse/.test(fe.bahn && fe.glaser.lagen.find((l) => l.bahn).name));
});

test("Konfigurator-Höhen (Wandhöhe 2,40–4,80 m in 20-cm-Schritten): nur volle Steine, keine Ausgleichslage", () => {
  for (let H = 2400; H <= 4800; H += 200) {
    const r = berechne({ laenge_mm: 6000, raumhoehe_mm: H + DECKENFUGE_MM, oeffnungen: [T], fassade: fass("schindel"), innen: inn("trockenbau_putz") });
    assert.equal(r.kennzahlen.wandhoehe_mm, H);
    assert.equal(r.kennzahlen.ausgleich_mm, 0);
    assert.equal(r.kennzahlen.lagen, H / 200);
  }
});

test("Wandaufbau-Export: Gefachschnitt von innen nach außen, Ende an der Belüftungsebene", () => {
  // V1 der Aufgabe Holz-UK: zweilagig mit Innenputz, die Dampfbremse entfällt.
  const v1 = wandaufbauAusLink(A, "https://konfigurator.sembla.de/datenblatt.html?f=schindel&i=trockenbau_putz&dd=120&da=60&v=6");
  assert.equal(v1.format, FORMAT);
  assert.deepEqual(v1.schichten.map((s) => [s.material, s.dicke_mm]),
    [["gipsputz", 10], ["gipsfaser", 12.5], ["mineralwolle", 27], ["stein", 125], ["mineralwolle", 120], ["holzfaser_dunkel", 60]]);
  assert.deepEqual(v1.entfallen, ["dampfbremse"]);
  assert.equal(v1.aussen, "hinterlueftet");
  assert.equal(v1.schichten[4].rolle, "gefach");
  assert.equal(v1.schichten[2].rolle, "installationsebene");
  // Ohne Innenputz bleibt die Dampfbremse zwischen den Dämmlagen.
  const ohne = wandaufbau(A, { fassade: "schindel", innen: "trockenbau", d: 120, da: 60 });
  assert.deepEqual(ohne.schichten.map((s) => s.material).slice(-3), ["mineralwolle", "bahn", "holzfaser_dunkel"]);
  assert.equal(ohne.schichten.at(-2).sd, 2);
  // Lattenebene ohne Dämmung ist ruhende Luft.
  assert.equal(ohne.schichten[1].material, "luft");
  // Offene Fugen der Holzleisten: offene Schalung, Fassadenbahn als letzte Schicht.
  const v3 = wandaufbau(A, { fassade: "holzleiste_einlagig", innen: "trockenbau_putz", d: 160 });
  assert.equal(v3.aussen, "offene_schalung");
  assert.deepEqual(v3.schichten.slice(-3).map((s) => s.material), ["bahn", "mineralwolle", "fassadenbahn"]);
  // Ohne d legt der Konfigurator aus wie auf der Seite.
  const aus = wandaufbau(A, { fassade: "schindel_einlagig", innen: "trockenbau_putz" });
  assert.equal(aus.konfiguration.daemmung_mm, auslegen(fass("schindel_einlagig"), inn("trockenbau_putz"), A.waerme, 0.2).daemmung_mm);
  // Alles, was der Konfigurator anbietet, lässt sich übergeben; unpassende Eingaben werden abgelehnt.
  for (const f of A.fassaden.filter((x) => x.freigegeben !== false))
    for (const i of A.innen.filter((x) => x.freigegeben !== false)) {
      const w = wandaufbau(A, { fassade: f.id, innen: i.id });
      assert.ok(w.schichten.some((s) => s.material === "stein") && w.schichten.every((s) => s.dicke_mm > 0), `${f.id}/${i.id}`);
    }
  assert.throws(() => wandaufbau(A, { fassade: "gibtsnicht", innen: "trockenbau_putz" }), /unbekannte Auswahl/);
  assert.throws(() => wandaufbau(A, { fassade: "schindel", innen: "trockenbau_putz", d: 123 }), /passt nicht/);
});

console.log(`\n${n} Tests bestanden`);
