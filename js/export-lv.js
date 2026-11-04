// Ausschreibungstext: ein Leistungsverzeichnis-Entwurf aus der Konfiguration, mit Vorbemerkungen,
// Positionen (OZ, Menge, Einheit, Kurz- und Langtext) für Rohwand, Fassade und Innenseite.
// Mengen aus der Stückliste; Fassaden- und Innenprodukte fabrikatsneutral. Reines Modul ohne DOM.

import { stueckliste } from "./stueckliste.js";
import { daemmText } from "./waerme.js";

const de = (x, d = 2) => x.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const umbruch = (t, breite = 92) => {
  const zeilen = [];
  for (const absatz of t.split("\n")) {
    let z = "";
    for (const wort of absatz.split(" ")) {
      if ((z + " " + wort).trim().length > breite) { zeilen.push(z); z = wort; } else z = (z + " " + wort).trim();
    }
    zeilen.push(z);
  }
  return zeilen;
};

// Langtexte je Schichtart; `s` ist das Stücklistenteil, `a` der Aufbau.
function langtext(t, a, r) {
  const n = t.name;
  if (t.symbol === "verbinder") return `${n}, lösbar in die Nut des SEMBLA-Steins gesetzt, immer in Steinmitte, nie in einer Fuge. Ohne Bohren und Dübeln. Lieferung durch den Systemhersteller.`;
  if (t.symbol === "schraube") return `${n}, ${t.detail}. Korrosionsschutz nach Nutzungsklasse.`;
  if (t.symbol === "winkel") return t.name === "Fußauflager"
    ? "Fußauflager aus feuerverzinktem Stahlwinkel unter Konterlatte und KVH je Achse, auf Sockel bzw. Rohdecke befestigt. Trägt das Eigengewicht der Fassade; die Verbinder nehmen nur Zug aus Windsog und der Ausmitte der Bekleidung auf. Die Klemmung der Verbinder entlang der Nut wird nicht angesetzt, weil sie beim Schwinden des Holzes nachlässt. Statischer Nachweis durch den Tragwerksplaner."
    : "Auflager der Unterkonstruktion über Fenster- und Türöffnungen als Winkel am Sturz oder als Wechsel bzw. Riegel zu den Nachbarachsen. Trägt das Eigengewicht der Bekleidung über der Öffnung; die Verbinder nehmen nur Zug auf.";
  if (t.art === "schwelle") return `${n}, Nadelholz, am Rohboden befestigt. Die Latten der Installationsebene stehen darauf und geben ihr Eigengewicht an den Boden ab; die Verbinder nehmen nur Zug auf.`;
  if (t.symbol === "lueftung") return `${n}, Aluminium gelocht, als Zu- und Abluftöffnung der Hinterlüftung am Wandfuß, an der Wandkrone sowie unter und über Fenstern und über Türen. Lüftungsquerschnitt mindestens 50 cm² je m Wandlänge nach DIN 18516-1, Insektenschutz.`;
  switch (t.art) {
    case "staender": return `Unterkonstruktion aus Konstruktionsvollholz, technisch getrocknet, auf den FA-Verbindern befestigt. Abmessungen: ${n.replace(" auf FA-Verbindern", "")}. Achsabstand ${a.achsraster_mm} mm.`;
    case "feld": return `${a.uk ? "Gefachdämmung" : "Dämmung der Installationsebene"} ${n}, zwischen ${a.uk ? "der Unterkonstruktion" : "den Latten"} passgenau und fugenfrei eingebaut. Wärmeleitfähigkeit als Bemessungswert nach DIN 4108-4 (WLS ${String(Math.round((a.schichten.find((s) => s.art === "feld")?.lambda || 0) * 1000)).padStart(3, "0")}) oder besser.`;
    case "platte":
      if (t.material === "bahn") return `${n}. Dampfbremse sd ≥ 2 m, nach der Gefachdämmung auf die Holz-UK getackert, Stöße, Ränder, Anschlüsse und Durchdringungen luftdicht nach DIN 4108-7 verklebt. Sie ist die luftdichte Ebene; bei verputzter Innenseite entfällt sie.`;
      if (/putz/.test(t.material)) return `${n}, vollflächig auf die Bekleidung, Plattenstöße überputzt. Der Putz ist die luftdichte Ebene nach DIN 4108-7; Dosen und Durchführungen luftdicht ausführen.`;
      if (t.material === "mineralwolle") return `${n}, nichtbrennbar, zwischen den Wandhaltern dicht gestoßen und mechanisch befestigt. Wärmeleitfähigkeit als Bemessungswert nach DIN 4108-4.`;
      return `${n}, auf der Unterkonstruktion befestigt. Wärmeleitfähigkeit als Bemessungswert nach DIN 4108-4.`;
    case "latte_v":
      if (t.material === "alu") return `${n}, Aluminium, an den Wandhaltern befestigt (Fest- und Gleitpunkte), bildet mit der Hinterlüftung die Tragebene der Bekleidung.`;
      return a.uk ? `Konterlattung, ${n}, Nadelholz, über der Unterkonstruktion verschraubt; bildet die Hinterlüftungsebene.` : `${n}, Installationsebene auf den IA-Verbindern; Leitungen laufen hinter der Bekleidung.`;
    case "latte_h": return `Traglattung, ${n}, Nadelholz, auf der Konterlattung.`;
    case "halter": return `${n}, mit Thermostopp, je FA-Verbinder einer. Statischer Nachweis der Unterkonstruktion durch den Systemlieferanten.`;
    case "schindel": case "leiste_h": case "paneel": return `Bekleidung, ${n}${t.detail && !n.includes(t.detail.replace(" mm", "")) ? `, ${t.detail}` : ""}, nach Verlegeanleitung des Herstellers. Farbe und Oberfläche nach Bemusterung.`;
    default: return `${n}${t.detail ? `, ${t.detail}` : ""}.`;
  }
}

// Verwendbarkeitsnachweis: Das abP (in Vorbereitung) deckt SEMBLA nur als nichttragende Innenwand. Eine Wand mit
// Fassade nimmt Windlast auf und trägt die Bekleidung über die Verbinder; dafür braucht es eine
// Zustimmung im Einzelfall bzw. eine vorhabenbezogene Bauartgenehmigung (vBG).
function verwendbarkeit(fassade) {
  const innen = !fassade.schichten?.length;
  return innen
    ? ["Verwendbarkeit: nichttragende innere Trennwand nach DIN 4103-1; Nachweis über das allgemeine bauaufsichtliche Prüfzeugnis (abP) des Systemherstellers; es ist in Vorbereitung und liegt spätestens vor Ausführungsbeginn vor. Einbaubereich und Grenzabmessungen nach abP; tragende Verwendung ist nicht Gegenstand dieser Leistung."]
    : ["Verwendbarkeit: Das abP des Systemherstellers (in Vorbereitung) deckt SEMBLA als nichttragende Innenwand. Für diese Wand mit vorgehängter Fassade (Windlast, Befestigung der Unterkonstruktion über die Verbinder) ist eine Zustimmung im Einzelfall (ZiE) bzw. eine vorhabenbezogene Bauartgenehmigung der obersten Bauaufsichtsbehörde erforderlich. Die Leistung steht unter diesem Vorbehalt.",
       "Antrag, Nachweise und Gebühren für die ZiE werden gesondert vereinbart; Ausführung erst nach Erteilung."];
}

/** LV-Entwurf als Text. info: { titel, link }. */
export function wandAlsLv(r, fassade, innen, info = {}) {
  const k = r.kennzahlen;
  const gruppen = stueckliste(r, fassade, innen);
  const positionen = [];
  let titel = 0;
  const neuerTitel = (name) => { titel++; positionen.push({ titel: `${String(titel).padStart(2, "0")}  ${name}`, nr: 0 }); };
  const pos = (menge, einheit, kurz, lang) => {
    const t = positionen.filter((p) => p.titel).at(-1);
    t.nr++;
    positionen.push({ oz: `${String(titel).padStart(2, "0")}.${String(t.nr).padStart(2, "0")}`, menge, einheit, kurz, lang });
  };

  neuerTitel("Rohwand SEMBLA");
  pos(k.flaeche_m2, "m²", "Trockenmauerwerk SEMBLA, 12,5 cm, vorgespannt",
    `Nichttragende Wand aus SEMBLA-Betonsteinen (keine Lasten aus Decken oder Dach), 125 mm dick, im 12,5-cm-Raster und in 20-cm-Lagen, trocken und ohne Mörtel gefügt, Stoßfugen versetzt. `
    + `Steine: ${k.i3} × i3 (375 × 125 × 200 mm), ${k.i2} × i2 (250 × 125 × 200 mm). `
    + `Vorspannung über ${k.spannachsen} Spannachsen mit Gewindestangen M10 in den Kammern, zwischen Bodenblech und Spannplatte, Achsabstand höchstens 37,5 cm; Zwischenspannpunkte nach Systemplanung. `
    + `Einschließlich Bodenbleche, Gewindestangen, Kopplungs- und Spannmuttern, Spannplatten${k.ausgleich_mm ? `, oberste Lage als Ausgleichslage ${k.ausgleich_mm} mm` : ""}. `
    + `Wandlänge ${de(k.laenge_mm / 1000, 3)} m, lichte Raumhöhe ${de(k.raumhoehe_mm / 1000)} m, Fuge zur Rohdecke ${k.deckenfuge_mm} mm. Abrechnung nach Fläche ohne Öffnungen. `
    + `Alle Bauteile zerstörungsfrei rückbaubar und wiederverwendbar.`);
  for (const op of r.oeffnungen.filter(Boolean)) {
    pos(1, "Stk", `Öffnung ${op.art === "tuer" ? "Tür" : "Fenster"} im SEMBLA-Raster`,
      `Öffnung für ${op.art === "tuer" ? "eine Tür" : "ein Fenster"}, Rohbaumaß ${de((op.g1 - op.g0) * 0.125, 3)} × ${de((op.l1 - op.l0) * 0.2)} m (B × H)${op.l0 ? `, Brüstung ${de(op.l0 * 0.2)} m` : ""}, maßgenau nach Systemplanung, Laibungen und Sturz im SEMBLA-System ausgebildet (Spannplatten am Segmentende). Lage ab ${de(op.g0 * 0.125, 3)} m vom Wandanfang.`);
  }
  const decke = gruppen.find((g) => g.id === "spann")?.teile.find((t) => t.symbol === "deckenanschluss");
  if (decke) pos(decke.menge, "Stk", "Deckenanschluss auf Spannachse", "Deckenanschluss als Winkel auf der Spannachse, an der Rohdecke befestigt, Fuge elastisch und schalltechnisch entkoppelt geschlossen.");

  for (const id of ["fassade", "innen"]) {
    const g = gruppen.find((x) => x.id === id);
    if (!g) continue;
    const aufbau = id === "fassade" ? fassade : innen;
    neuerTitel(id === "fassade" ? `Fassade: ${fassade.name}` : `Innenseite: ${innen.name}`);
    for (const t of g.teile) pos(t.menge, t.einheit, `${t.name}${t.detail && t.einheit !== "m²" && !t.name.includes(t.detail.replace(" mm", "")) ? `, ${t.detail}` : ""}`, langtext(t, aufbau, r));
  }

  const vorbemerkung = [
    "Entwurf eines Leistungsverzeichnisses aus dem SEMBLA Konfigurator. Mengen und Texte sind vom Planer zu prüfen und an das Projekt anzupassen.",
    "Leitfabrikat Wandsystem: SEMBLA (Polycare Research Technology GmbH). Fassaden- und Innenprodukte fabrikatsneutral, oder gleichwertig.",
    ...verwendbarkeit(fassade),
    r.waerme && fassade.daemmstufen
      ? `Wärmeschutz: Wand mit ${daemmText(fassade)} Dämmung ausgelegt auf U = ${de(r.waerme.U, 3)} W/(m²K) (DIN EN ISO 6946, Vorbemessung). Tauwasserschutz nach DIN 4108-3. Gefordert sind die genannten Bemessungswerte der Wärmeleitfähigkeit.`
      : "Wärmeschutz: ungedämmte Wand (Innenwand oder unbeheizter Bereich).",
    "Planungsgrundlagen: SEMBLA-Planungshandbuch, Ausführungsplanung und Statik sind nicht Teil dieses Entwurfs.",
    ...(info.link ? [`Datenblatt zur Konfiguration: ${info.link}`] : []),
  ];

  const aus = [
    info.titel || "SEMBLA-Wand · Leistungsverzeichnis (Entwurf)",
    "=".repeat(60),
    `Stand: ${new Date().toLocaleDateString("de-DE")}`,
    "",
    "Vorbemerkungen",
    "-".repeat(60),
    ...vorbemerkung.flatMap((v) => umbruch(`- ${v}`).map((z, i) => (i ? "  " + z : z))),
    "",
  ];
  for (const p of positionen) {
    if (p.titel) { aus.push("", p.titel, "-".repeat(60)); continue; }
    const menge = p.einheit === "Stk" ? String(Math.round(p.menge)) : de(p.menge);
    aus.push("", `${p.oz}  ${p.kurz}`, `       Menge: ${menge} ${p.einheit}`);
    for (const z of umbruch(p.lang, 85)) aus.push(`       ${z}`);
    aus.push(`       EP: ______________   GP: ______________`);
  }
  aus.push("", "Vorplanung zur Orientierung. Ersetzt keine Ausführungsplanung und keine Statik.", "");
  return aus.join("\r\n");
}
