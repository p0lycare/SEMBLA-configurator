#!/usr/bin/env node
// MCP-Server des SEMBLA-Konfigurators (stdio, JSON-RPC 2.0, ohne Fremdpakete).
// Erzeugt, variiert und legt Konfigurationen aus – mit denselben Modulen wie die Seite – und gibt
// Kennwerte, Links (mit den ausgelegten Dämmstärken dd/da) und den Wandaufbau im Format
// „sembla-wandaufbau“ v1 (js/export-hygro.js) zurück.
//
// Einbinden, z. B. in Claude Code:
//   claude mcp add sembla-konfigurator -- node /pfad/zu/SEMBLA-configurator/tools/mcp/konfigurator-mcp.mjs
// Umgebungsvariable SEMBLA_BASIS_URL: Adresse des Konfigurators für die Links
// (Voreinstellung https://konfigurator.sembla.de/).

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { zustandAusUrl, aufbauWahl, datenblattParameter, RECHENSTAND } from "../../js/inhalte.js";
import { berechne, GRENZEN, DECKENFUGE_MM, OEFFNUNGEN } from "../../js/wand.js";
import { stueckliste } from "../../js/stueckliste.js";
import { wandaufbauAusLink, FORMAT, VERSION } from "../../js/export-hygro.js";

const A = JSON.parse(readFileSync(new URL("../../data/aufbauten.json", import.meta.url), "utf8"));
const BASIS = (process.env.SEMBLA_BASIS_URL || "https://konfigurator.sembla.de/").replace(/\/?$/, "/");
const NAME = "sembla-konfigurator", SERVER_VERSION = "1.0.0";
const GRID = 125, LAGE = 200, WAND = { min: 2400, max: 4800 };
const frei = (x) => x.freigegeben !== false;
const r3 = (x) => Math.round(x * 1000) / 1000;

// ---------- Fachlogik ----------

function varianten({ alle = false } = {}) {
  const auswahl = (liste) => liste.filter((x) => alle || frei(x));
  return {
    rechenstand: RECHENSTAND,
    fassaden: auswahl(A.fassaden).map((f) => ({
      id: f.id, name: f.name, kurz: f.kurz, freigegeben: frei(f), ...(f.ersatz ? { ersatz: f.ersatz } : {}),
      unterkonstruktion: f.schichten.length ? (f.uk === "holz" ? "Holz" : "Alu") : null,
      flaechengewicht_kg_m2: f.flaechengewicht_kg_m2 ?? null,
      daemmstufen_mm: f.daemmstufen ? { innen: f.daemmstufen.dicken, ...(f.daemmstufen.aussen ? { aussen: f.daemmstufen.aussen.dicken } : {}) } : null,
    })),
    innen: auswahl(A.innen).map((i) => ({ id: i.id, name: i.name, kurz: i.kurz, freigegeben: frei(i) })),
    ziele: A.waerme.ziele.map((z) => ({ id: z.id, name: z.name, U_max: z.U })),
    hinweis_ziel: "Die Seite legt fest auf das Ziel „beg“ (U ≤ 0,20) aus; die anderen Ziele sind über den Parameter w wählbar.",
    grenzen: { laenge_m: [GRENZEN.laengeMin / 1000, GRENZEN.laengeMax / 1000, 0.125], wandhoehe_m: [WAND.min / 1000, WAND.max / 1000, 0.2] },
    oeffnungen: Object.fromEntries(Object.entries(OEFFNUNGEN).map(([art, o]) => [art, {
      max_anzahl: o.max,
      breite_m: [o.bereich.b[0] * GRID / 1000, o.bereich.b[1] * GRID / 1000, 0.125, o.breite_grid * GRID / 1000],
      hoehe_m: [o.bereich.h[0] * LAGE / 1000, o.bereich.h[1] * LAGE / 1000, 0.2, o.lagen * LAGE / 1000],
      bruestung_m: [o.bereich.u[0] * LAGE / 1000, o.bereich.u[1] * LAGE / 1000, 0.2, o.l0 * LAGE / 1000],
    }])),
    hinweis_bereiche: "Bereiche als [min, max, Schritt, Voreinstellung].",
  };
}

/** Öffnungen aus [{art, ab_m?, breite_m?, hoehe_m?, bruestung_m?}] als URL-Teil „o“. */
function oeffnungenText(liste) {
  if (!Array.isArray(liste) || !liste.length) return "keine";
  return liste.map((x, k) => {
    if (!OEFFNUNGEN[x?.art]) throw new Error(`Öffnung ${k + 1}: art muss „tuer“ oder „fenster“ sein.`);
    const zahl = (v, schritt) => (Number.isFinite(v) ? Math.round(v * 1000 / schritt) : null);
    const pos = zahl(x.ab_m, GRID), b = zahl(x.breite_m, GRID), h = zahl(x.hoehe_m, LAGE), u = zahl(x.bruestung_m, LAGE);
    return (x.art === "tuer" ? "t" : "f") + (pos ?? "") + (b != null ? `b${b}` : "") + (h != null ? `h${h}` : "") + (u != null ? `u${u}` : "");
  }).join(",");
}

/** Abfrage wie ein Konfigurator-Link aus den Werkzeug-Argumenten. */
function abfrage(a) {
  const L = Math.round(Math.min(Math.max((a.laenge_m ?? 6) * 1000, GRENZEN.laengeMin), GRENZEN.laengeMax) / GRID) * GRID;
  const H = Math.min(Math.max(Math.round((a.wandhoehe_m ?? 2.8) * 1000 / LAGE) * LAGE, WAND.min), WAND.max);
  const p = new URLSearchParams({ l: L, h: H + DECKENFUGE_MM, o: oeffnungenText(a.oeffnungen), f: a.fassade, i: a.innen, w: a.ziel || "beg" });
  if (a.dd != null) { p.set("dd", Math.round(a.dd)); if (a.da != null) p.set("da", Math.round(a.da)); p.set("v", RECHENSTAND); }
  return p;
}

function rechne(a, { mitWandaufbau = true } = {}) {
  if (!a.fassade || !a.innen) throw new Error("fassade und innen sind Pflicht (Kennungen aus „varianten“).");
  const q = abfrage(a);
  const zustand = zustandAusUrl(q);
  const gewaehlt = { fassade: zustand.fassade, innen: zustand.innen, ziel: zustand.ziel };
  const { roh, innen, ziel, waerme, verbinder } = aufbauWahl(A, zustand, { nurFreigegeben: !a.alle });
  if (zustand.ersetzt.length)
    throw new Error(`Unbekannt oder nicht freigegeben: ${zustand.ersetzt.map((k) => `${k}=${gewaehlt[k]}`).join(", ")}. Gültige Kennungen liefert „varianten“.`);
  if (a.dd != null && !waerme.fest) {
    const st = roh.daemmstufen;
    throw new Error(st ? `Dämmstärke dd=${a.dd}${a.da != null ? `/da=${a.da}` : ""} passt nicht zu ${roh.id}. Stufen innen: ${st.dicken.join(", ")}${st.aussen ? `; außen: ${st.aussen.dicken.join(", ")}` : ""} mm.`
      : `${roh.id} hat keine Dämmung; dd/da weglassen.`);
  }
  const r = berechne({ ...zustand, fassade: roh, innen, waerme, verbinder });
  const k = r.kennzahlen, w = r.waerme;
  const params = new URLSearchParams(Object.entries(datenblattParameter(zustand, r)).map(([x, y]) => [x, String(y)]));
  const gruppen = stueckliste(r, r.fassade, innen);
  const stk = (g) => g.teile.filter((t) => t.einheit === "Stk").reduce((s, t) => s + t.menge, 0);
  const ergebnis = {
    konfiguration: { fassade: roh.id, innen: innen.id, ziel: ziel.id, ziel_U_max: ziel.U,
      ...(zustand.umgestellt.length ? { umgestellt: zustand.umgestellt.map(([x, y]) => `${x.id} → ${y.id}`) } : {}) },
    links: { konfigurator: `${BASIS}?${params}`, datenblatt: `${BASIS}datenblatt.html?${params}` },
    kennwerte: {
      wand_m: { laenge: k.laenge_mm / 1000, hoehe: k.wandhoehe_mm / 1000, raumhoehe: k.raumhoehe_mm / 1000 },
      flaeche_m2: r3(k.flaeche_m2), wanddicke_mm: k.dicke_gesamt_mm, lagen: k.lagen,
      steine: { gesamt: k.steine, i3: k.i3, i2: k.i2 }, spannachsen: k.spannachsen,
      verbinder: { fassade: k.verbinder_fa, innen: k.verbinder_ia },
      gewicht_rohwand_t: r3(k.gewicht_rohwand_kg / 1000),
      ...(w ? {
        U: r3(w.U), ziel_erfuellt: !!w.erfuellt,
        daemmung_mm: w.daemmung_mm ?? null, daemmung_aussen_mm: w.daemmung_aussen_mm ?? null,
        feuchteschutz: { ok: !!w.feuchte?.ok, glaser_ok: !!w.feuchte?.glaser?.ok,
          tauwasser_kg_m2: r3(w.feuchte?.glaser?.tauwasser_kg_m2 ?? 0), luftdichte_ebene: w.feuchte?.luftdicht ?? null },
      } : { U: null, hinweis: "Ohne Fassade keine Wärmeschutzrechnung." }),
    },
    oeffnungen: r.oeffnungen.map((o, j) => o
      ? { art: o.art, ab_m: o.g0 * GRID / 1000, breite_m: (o.g1 - o.g0) * GRID / 1000, hoehe_m: (o.l1 - o.l0) * LAGE / 1000, bruestung_m: o.l0 * LAGE / 1000 }
      : { art: zustand.oeffnungen[j].art, passt_nicht: true }),
    stueckliste_kurz: gruppen.map((g) => ({ gruppe: g.titel, lieferung: g.lieferung, positionen: g.teile.length, stueck: stk(g) })),
    hinweise: r.hinweise,
  };
  if (mitWandaufbau) ergebnis.wandaufbau = wandaufbauAusLink(A, ergebnis.links.konfigurator);
  return ergebnis;
}

function auslegen(a) {
  const ziele = a.ziele?.length ? a.ziele : A.waerme.ziele.map((z) => z.id);
  return {
    hinweis: "Dünnste Dämmstufe je Ziel, die U und den Feuchteschutz erfüllt – wie auf der Seite, für die angegebene Wand.",
    auslegungen: ziele.map((z) => {
      const e = rechne({ ...a, ziel: z, dd: undefined, da: undefined }, { mitWandaufbau: false });
      return { ziel: z, U_max: e.konfiguration.ziel_U_max, U: e.kennwerte.U, ziel_erfuellt: e.kennwerte.ziel_erfuellt,
        daemmung_mm: e.kennwerte.daemmung_mm, daemmung_aussen_mm: e.kennwerte.daemmung_aussen_mm,
        feuchteschutz_ok: e.kennwerte.feuchteschutz?.ok ?? null, wanddicke_mm: e.kennwerte.wanddicke_mm, link: e.links.konfigurator };
    }),
  };
}

// ---------- Werkzeuge ----------

const WAND_EIGENSCHAFTEN = {
  fassade: { type: "string", description: "Kennung der Fassade (siehe varianten), z. B. schindel" },
  innen: { type: "string", description: "Kennung der Innenseite, z. B. trockenbau_putz" },
  laenge_m: { type: "number", description: "Wandlänge 1–12 m, wird auf 12,5 cm gerundet (Voreinstellung 6)" },
  wandhoehe_m: { type: "number", description: "Wandhöhe 2,4–4,8 m in vollen 20-cm-Lagen (Voreinstellung 2,8)" },
  oeffnungen: { type: "array", description: "Türen und Fenster; ohne Angabe keine. Positionen und Maße rasten wie auf der Seite.",
    items: { type: "object", required: ["art"], properties: {
      art: { type: "string", enum: ["tuer", "fenster"] },
      ab_m: { type: "number", description: "Abstand vom linken Wandende; ohne Angabe Mitte der größten Lücke" },
      breite_m: { type: "number" }, hoehe_m: { type: "number" }, bruestung_m: { type: "number", description: "nur Fenster" } } } },
  alle: { type: "boolean", description: "auch nicht freigegebene Varianten zulassen (nur zur Prüfung alter Links)" },
};

const WERKZEUGE = [
  { name: "varianten", description: "Freigegebene Fassaden, Innenseiten und Wärmeschutz-Ziele mit Kurzbeschreibung, Dämmstufen und zulässigen Bereichen.",
    inputSchema: { type: "object", properties: { alle: { type: "boolean", description: "auch zurückgezogene bzw. ausgeblendete Varianten" } } },
    run: varianten },
  { name: "konfiguration_erstellen", description: "Rechnet eine Konfiguration wie der Konfigurator: Kennwerte (U, Dämmstärke, Feuchteschutz nach Glaser), Stückliste kurz, Links zu Konfigurator und Datenblatt (mit dd/da) und den Wandaufbau im Format sembla-wandaufbau v1. Ohne dd/da wird die Dämmung auf das Ziel ausgelegt.",
    inputSchema: { type: "object", required: ["fassade", "innen"], properties: { ...WAND_EIGENSCHAFTEN,
      ziel: { type: "string", description: "Wärmeschutz-Ziel (geg, beg, eh40), Voreinstellung beg wie auf der Seite" },
      dd: { type: "number", description: "feste Dämmstärke innen (Gefach), mm; muss eine Stufe der Fassade sein" },
      da: { type: "number", description: "feste Dämmstärke außen (Platte), mm, nur bei zweilagigen Fassaden" },
      mit_wandaufbau: { type: "boolean", description: "Wandaufbau mitliefern (Voreinstellung ja)" } } },
    run: (a) => rechne(a, { mitWandaufbau: a.mit_wandaufbau !== false }) },
  { name: "konfiguration_auslegen", description: "Legt die dünnste zulässige Dämmstufe je Wärmeschutz-Ziel aus (wie auf der Seite) und gibt je Ziel U, Dämmstärken und einen Link mit dd/da zurück.",
    inputSchema: { type: "object", required: ["fassade", "innen"], properties: { ...WAND_EIGENSCHAFTEN,
      ziele: { type: "array", items: { type: "string" }, description: "Ziele, Voreinstellung alle (geg, beg, eh40)" } } },
    run: auslegen },
  { name: "wandaufbau", description: `Wandaufbau einer Konfiguration im Format „${FORMAT}“ Version ${VERSION} aus einem Konfigurator- oder Datenblatt-Link (oder nur dem Teil nach „?“). Ohne dd/da im Link wird die Dämmung ausgelegt.`,
    inputSchema: { type: "object", required: ["link"], properties: { link: { type: "string" } } },
    run: ({ link }) => {
      if (!link) throw new Error("link fehlt.");
      return wandaufbauAusLink(A, link);
    } },
];

// ---------- JSON-RPC über stdio ----------

const senden = (nachricht) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...nachricht }) + "\n");

function behandeln(m) {
  const { id, method, params = {} } = m;
  const antwort = (result) => id !== undefined && senden({ id, result });
  const fehler = (code, message) => id !== undefined && senden({ id, error: { code, message } });
  switch (method) {
    case "initialize":
      return antwort({ protocolVersion: params.protocolVersion || "2025-06-18", capabilities: { tools: {} },
        serverInfo: { name: NAME, version: SERVER_VERSION },
        instructions: "SEMBLA-Konfigurator: varianten → konfiguration_erstellen bzw. konfiguration_auslegen. Links enthalten die ausgelegten Dämmstärken (dd/da); wandaufbau liefert das Format sembla-wandaufbau v1. Vorplanung, ersetzt keine Statik und keinen Nachweis." });
    case "ping": return antwort({});
    case "tools/list":
      return antwort({ tools: WERKZEUGE.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const w = WERKZEUGE.find((x) => x.name === params.name);
      if (!w) return fehler(-32602, `Unbekanntes Werkzeug: ${params.name}`);
      try {
        const ergebnis = w.run(params.arguments || {});
        return antwort({ content: [{ type: "text", text: JSON.stringify(ergebnis, null, 2) }], structuredContent: ergebnis });
      } catch (e) {
        return antwort({ content: [{ type: "text", text: String(e.message || e) }], isError: true });
      }
    }
    default:
      if (method?.startsWith("notifications/")) return;
      return fehler(-32601, `Methode nicht unterstützt: ${method}`);
  }
}

createInterface({ input: process.stdin }).on("line", (zeile) => {
  if (!zeile.trim()) return;
  let m;
  try { m = JSON.parse(zeile); } catch { return senden({ id: null, error: { code: -32700, message: "Ungültiges JSON" } }); }
  for (const x of Array.isArray(m) ? m : [m]) behandeln(x);
});
