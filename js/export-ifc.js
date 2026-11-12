// BIM-Export: die konfigurierte Wand als IFC4-Datei (STEP). Eine Wand mit Schichtaufbau
// (IfcMaterialLayerSet), Achse und Volumenkörper, die Öffnungen als IfcOpeningElement, dazu
// Pset_WallCommon und die SEMBLA-Kennwerte. Einheiten in mm. Reines Modul ohne DOM.

import { schichtFolge } from "./aufbau-geometrie.js";

// IFC-GUID: 128 Bit in 22 Zeichen des IFC-Base64-Alphabets.
const ZEICHEN = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
function guid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  let s = "";
  for (let i = 0; i < 22; i++) { s = ZEICHEN[Number(n & 63n)] + s; n >>= 6n; }
  return s;
}

// STEP-Zeichenketten: Apostroph und Backslash maskiert, alles außerhalb ASCII als \X2\…\X0\.
function text(t) {
  if (t == null) return "$";
  let s = "";
  for (const c of String(t)) {
    const code = c.codePointAt(0);
    if (c === "'") s += "''";
    else if (c === "\\") s += "\\\\";
    else if (code >= 32 && code < 127) s += c;
    else if (code <= 0xffff) s += `\\X2\\${code.toString(16).toUpperCase().padStart(4, "0")}\\X0\\`;
  }
  return `'${s}'`;
}
const zahl = (x) => { const s = Number(x).toFixed(4).replace(/0+$/, ""); return s.endsWith(".") ? s : s.includes(".") ? s : s + "."; };

/**
 * IFC-Datei als Text. r: Ergebnis von berechne(); fassade/innen: Aufbauten; info: { name, link }.
 */
export function wandAlsIfc(r, fassade, innen, info = {}) {
  const zeilen = [];
  let n = 0;
  const e = (inhalt) => { zeilen.push(`#${++n}=${inhalt};`); return `#${n}`; };
  const punkt = (...k) => e(`IFCCARTESIANPOINT((${k.map(zahl).join(",")}))`);
  const richtung = (...k) => e(`IFCDIRECTION((${k.map(zahl).join(",")}))`);

  const w = r.w, k = r.kennzahlen;
  const L = w.length_mm, H = w.height_mm;
  const schichten = schichtFolge(fassade, innen, w.thickness_mm).filter((s) => s.dicke > 0);
  const T = schichten.reduce((a, s) => a + s.dicke, 0);

  // Einheiten, Kontext, Projektstruktur
  const einheiten = e(`IFCUNITASSIGNMENT((${[
    e("IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)"),
    e("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)"),
    e("IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)"),
    e("IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)"),
  ].join(",")}))`);
  const ursprung = punkt(0, 0, 0), z = richtung(0, 0, 1), x = richtung(1, 0, 0);
  const welt = e(`IFCAXIS2PLACEMENT3D(${ursprung},${z},${x})`);
  const kontext = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${welt},$)`);
  const koerperKontext = e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${kontext},$,.MODEL_VIEW.,$)`);
  const achsKontext = e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Axis','Model',*,*,*,*,${kontext},$,.GRAPH_VIEW.,$)`);
  const projekt = e(`IFCPROJECT('${guid()}',$,${text(info.name || "SEMBLA-Wand")},${text("Aus dem SEMBLA Konfigurator, Vorplanung")},$,$,$,(${kontext}),${einheiten})`);
  const lage = (bezug) => e(`IFCLOCALPLACEMENT(${bezug},${e(`IFCAXIS2PLACEMENT3D(${ursprung},$,$)`)})`);
  const lageGrund = lage("$"), lageGebaeude = lage(lageGrund), lageGeschoss = lage(lageGebaeude), lageWand = lage(lageGeschoss);
  const grund = e(`IFCSITE('${guid()}',$,${text("Grundstück")},$,$,${lageGrund},$,$,.ELEMENT.,$,$,$,$,$)`);
  const gebaeude = e(`IFCBUILDING('${guid()}',$,${text("Gebäude")},$,$,${lageGebaeude},$,$,.ELEMENT.,$,$,$)`);
  const geschoss = e(`IFCBUILDINGSTOREY('${guid()}',$,'Erdgeschoss',$,$,${lageGeschoss},$,$,.ELEMENT.,0.)`);
  e(`IFCRELAGGREGATES('${guid()}',$,$,$,${projekt},(${grund}))`);
  e(`IFCRELAGGREGATES('${guid()}',$,$,$,${grund},(${gebaeude}))`);
  e(`IFCRELAGGREGATES('${guid()}',$,$,$,${gebaeude},(${geschoss}))`);

  // Wand: Achse auf der Innenseite (y = 0), Schichten nach außen (+y), Volumenkörper L × T × H
  const quader = (x0, y0, b, t, z0, h) => {
    const profil = e(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${e(`IFCAXIS2PLACEMENT2D(${e(`IFCCARTESIANPOINT((${zahl(x0 + b / 2)},${zahl(y0 + t / 2)}))`)},$)`)},${zahl(b)},${zahl(t)})`);
    return e(`IFCEXTRUDEDAREASOLID(${profil},${e(`IFCAXIS2PLACEMENT3D(${punkt(0, 0, z0)},$,$)`)},${z},${zahl(h)})`);
  };
  const achse = e(`IFCSHAPEREPRESENTATION(${achsKontext},'Axis','Curve2D',(${e(`IFCPOLYLINE((${e("IFCCARTESIANPOINT((0.,0.))")},${e(`IFCCARTESIANPOINT((${zahl(L)},0.))`)}))`)}))`);
  const koerper = e(`IFCSHAPEREPRESENTATION(${koerperKontext},'Body','SweptSolid',(${quader(0, 0, L, T, 0, H)}))`);
  const wand = e(`IFCWALL('${guid()}',$,${text(`SEMBLA-Wand ${(L / 1000).toFixed(Math.round(L) % 10 ? 3 : 2).replace(".", ",")} × ${(k.wandhoehe_mm / 1000).toFixed(2).replace(".", ",")} m`)},${text(`${fassade.name} · innen ${innen.name}`)},$,${lageWand},${e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${achse},${koerper}))`)},$,.STANDARD.)`);
  e(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',$,$,$,(${wand}),${geschoss})`);

  // Schichtaufbau
  const lagen = schichten.map((s) => {
    const mat = e(`IFCMATERIAL(${text(s.name)},$,${text({ innen: "Innenausbau", stein: "Mauerwerk", fassade: "Fassade", belueftung: "Hinterlüftung" }[s.art])})`);
    return e(`IFCMATERIALLAYER(${mat},${zahl(s.dicke)},${s.art === "belueftung" ? ".T." : ".F."},${text(s.name)},$,$,$)`);
  });
  const satz = e(`IFCMATERIALLAYERSET((${lagen.join(",")}),${text(`SEMBLA ${fassade.name}`)},$)`);
  e(`IFCRELASSOCIATESMATERIAL('${guid()}',$,$,$,(${wand}),${e(`IFCMATERIALLAYERSETUSAGE(${satz},.AXIS2.,.POSITIVE.,0.,$)`)})`);

  // Öffnungen: durch die ganze Wanddicke
  for (const op of w.openings) {
    const x0 = op.g0 * w.grid_mm, b = (op.g1 - op.g0) * w.grid_mm;
    const z0 = w.courses[op.l0].unterkante_mm, h = w.courses[op.l1 - 1].oberkante_mm - z0;
    const form = e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${e(`IFCSHAPEREPRESENTATION(${koerperKontext},'Body','SweptSolid',(${quader(x0, -10, b, T + 20, z0, h)}))`)}))`);
    const oeffnung = e(`IFCOPENINGELEMENT('${guid()}',$,${text(op.art === "tuer" ? "Türöffnung" : "Fensteröffnung")},$,$,${lage(lageWand)},${form},$,.OPENING.)`);
    e(`IFCRELVOIDSELEMENT('${guid()}',$,$,$,${wand},${oeffnung})`);
  }

  // Eigenschaften
  const wert = (name, typ, v) => e(`IFCPROPERTYSINGLEVALUE(${text(name)},$,${typ}(${v}),$)`);
  const pset = (name, props) => e(`IFCRELDEFINESBYPROPERTIES('${guid()}',$,$,$,(${wand}),${e(`IFCPROPERTYSET('${guid()}',$,${text(name)},$,(${props.join(",")}))`)})`);
  pset("Pset_WallCommon", [
    wert("IsExternal", "IFCBOOLEAN", fassade.schichten.length ? ".T." : ".F."),
    ...(r.waerme ? [wert("ThermalTransmittance", "IFCTHERMALTRANSMITTANCEMEASURE", zahl(r.waerme.U))] : []),
    wert("Reference", "IFCIDENTIFIER", text("SEMBLA")),
  ]);
  pset("SEMBLA_Konfiguration", [
    wert("Steine_i3", "IFCINTEGER", k.i3), wert("Steine_i2", "IFCINTEGER", k.i2),
    wert("Lagen", "IFCINTEGER", k.lagen), wert("Spannachsen", "IFCINTEGER", k.spannachsen),
    wert("Verbinder_Fassade", "IFCINTEGER", k.verbinder_fa), wert("Verbinder_innen", "IFCINTEGER", k.verbinder_ia),
    wert("Fassade", "IFCLABEL", text(fassade.name)), wert("Innenseite", "IFCLABEL", text(innen.name)),
    wert("Wanddicke_gesamt_mm", "IFCLENGTHMEASURE", zahl(T)),
    ...(info.link ? [wert("Datenblatt", "IFCTEXT", text(info.link))] : []),
    wert("Hinweis", "IFCTEXT", text("Vorplanung aus dem SEMBLA Konfigurator. Ersetzt keine Ausführungsplanung und keine Statik.")),
  ]);

  const jetzt = new Date().toISOString().slice(0, 19);
  return [
    "ISO-10303-21;", "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
    `FILE_NAME(${text("SEMBLA-Wand.ifc")},'${jetzt}',(''),('Polycare Research Technology GmbH'),'SEMBLA Konfigurator','SEMBLA Konfigurator','');`,
    "FILE_SCHEMA(('IFC4'));", "ENDSEC;", "DATA;", ...zeilen, "ENDSEC;", "END-ISO-10303-21;", "",
  ].join("\n");
}
