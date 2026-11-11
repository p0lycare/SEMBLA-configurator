// Ausschreibungstext: LV-Entwurf aus der Konfiguration, gegliedert wie die Muster-LVs (Teil A):
// Vorbemerkungen, Rohwand, bei Fassade Antrag und Nachweise (ZiE), Fassade, Innenseite. Mengen
// aus der Stückliste; Fassaden- und Innenprodukte fabrikatsneutral. `lvDaten` liefert die
// Struktur (auch für einen späteren GAEB-Export), `wandAlsLv` den Text. Reines Modul ohne DOM.

import { stueckliste } from "./stueckliste.js";
import { daemmText } from "./waerme.js";
import { wirksameZwischenpunkte } from "./sembla-core.js";

const de = (x, d = 2) => x.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
// Maß im 12,5-cm-Raster: drei Nachkommastellen nur, wo nötig (1,125 m, aber 1,00 m).
const rm = (m) => de(m, Math.round(m * 1000) % 10 ? 3 : 2);
const KURZ_MAX = 70;   // Kurztext nach GAEB höchstens 70 Zeichen
const kurz = (t) => (t.length > KURZ_MAX ? t.slice(0, KURZ_MAX - 1).trimEnd() + "…" : t);

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

/** Produktname ohne Konfigurator-Zusätze („auf FA-Verbindern“, „, Hinterlüftung 24 mm“ …). */
const produkt = (name) => name.split(", ")[0].replace(/ auf (FA|IA)-Verbindern$/, "").trim();
const wls = (a) => String(Math.round((a.schichten.find((s) => s.art === "feld")?.lambda || 0) * 1000)).padStart(3, "0");

/**
 * Eine Stücklistenposition als LV-Position {kurz, menge, einheit, lang} oder null (geht in eine
 * andere Position ein). seite: "aussen" | "innen"; a: Aufbau; flaeche: Wandfläche ohne Öffnungen.
 */
function position(t, a, seite, flaeche, teile) {
  const n = t.name, p = produkt(n), aussen = seite === "aussen";
  const holzUk = a.uk !== "alu";
  if (t.symbol === "schraube") return null;   // in Verbinder bzw. senkrechter Lattung enthalten
  if (t.symbol === "verbinder") {
    const schraube = teile.find((x) => x.symbol === "schraube" && x.name.startsWith("Verbinderschraube"));
    return { kurz: `${n}, lösbar, in der Verbindernut`, menge: t.menge, einheit: "Stk",
      lang: `Verbinder des Systemherstellers, in die Verbindernut des SEMBLA-Steins gesetzt, immer in Steinmitte und nie in einer Fuge${aussen ? ", Anordnung nach Bemessung" : ""}. Ohne Bohren und Dübeln. `
        + (schraube ? `Mit Verbinderschraube ${schraube.detail.replace(/^M6 × /, "M6 × ")}${/Länge prüfen/.test(schraube.detail) ? "" : " und Unterlegscheibe ≥ 20 mm"}.` : "") };
  }
  if (t.symbol === "winkel") {
    if (t.name === "Fußauflager") return { kurz: "Fußauflager je Achse, Stahlwinkel", menge: t.menge, einheit: "Stk",
      lang: "Stahlwinkel, feuerverzinkt, unter KVH und senkrechter Latte je Achse, auf Sockel bzw. Rohdecke befestigt. Trägt das Eigengewicht der Fassade; die Verbinder nehmen nur Zug aus Windsog und der Ausmitte der Bekleidung auf. Statischer Nachweis durch den Tragwerksplaner." };
    return aussen
      ? { kurz: "Auflager der Unterkonstruktion über Öffnungen", menge: t.menge, einheit: "Stk",
        lang: "Winkel am Sturz oder Wechsel bzw. Riegel zu den Nachbarachsen; trägt das Eigengewicht der Bekleidung über Fenstern und Türen." }
      : { kurz: "Riegel der Installationsebene über Öffnungen", menge: t.menge, einheit: "Stk",
        lang: "Riegel bzw. Wechsel aus Nadelholz zu den Nachbarlatten über Fenstern und Türen; trägt das Eigengewicht der Bekleidung über der Öffnung." };
  }
  if (t.art === "schwelle") return { kurz: `Schwelle ${p.replace("Schwelle ", "")}, Nadelholz`, menge: t.menge, einheit: "lfm",
    lang: "Nadelholz, am Rohboden befestigt, an Türöffnungen unterbrochen. Die Latten der Installationsebene stehen darauf und geben ihr Eigengewicht an den Boden ab; die Verbinder nehmen nur Zug auf." };
  if (t.symbol === "lueftung") return { kurz: "Lüftungsprofil mit Insektenschutz", menge: t.menge, einheit: "lfm",
    lang: "Aluminium gelocht, als Zu- und Abluftöffnung der Hinterlüftung am Wandfuß, an der Wandkrone sowie unter und über Fenstern und über Türen. Lüftungsquerschnitt ≥ 50 cm² je m nach DIN 18516-1." };
  switch (t.art) {
    case "staender":
      return { kurz: `Unterkonstruktion ${p}`, menge: t.menge, einheit: "lfm",
        lang: `Konstruktionsvollholz ${p.replace("KVH ", "")} mm, Nadelholz, technisch getrocknet, senkrecht auf den FA-Verbindern, Achsabstand ${a.achsraster_mm} mm.` };
    case "halter":
      return { kurz: `${p}, mit Thermostopp`, menge: t.menge, einheit: "Stk",
        lang: `${p}, mit Thermostopp, je FA-Verbinder einer, Fest- und Gleitpunkte nach Systemstatik. Statischer Nachweis der Unterkonstruktion durch den Systemlieferanten.` };
    case "feld":
      return aussen || a.uk
        ? { kurz: `Gefachdämmung ${p}`, menge: t.menge, einheit: "m²",
          lang: `Zwischen der Unterkonstruktion passgenau und fugenfrei eingebaut, nichtbrennbar A1. Bemessungswert der Wärmeleitfähigkeit nach DIN 4108-4 λ ≤ 0,${wls(a)} W/(mK).` }
        : { kurz: `Dämmung Installationsebene, ${p}`, menge: t.menge, einheit: "m²",
          lang: `${n}, zwischen den Latten passgenau eingebaut. Bemessungswert der Wärmeleitfähigkeit nach DIN 4108-4 λ ≤ 0,${wls(a)} W/(mK).` };
    case "platte":
      if (t.material === "bahn") return { kurz: "Dampfbremse sd ≥ 2 m, luftdicht verklebt", menge: t.menge, einheit: "m²",
        lang: t.einbau
          ? "Dampfbremse sd ≥ 2 m, vollflächig auf den Steinen unter der Unterkonstruktion; Stöße, Ränder, Anschlüsse und Durchdringungen der Verbinder luftdicht nach DIN 4108-7 verklebt bzw. mit Manschetten abgedichtet. Sie ist die luftdichte Ebene."
          : "Dampfbremse sd ≥ 2 m, nach der Gefachdämmung auf die Unterkonstruktion getackert; Stöße, Ränder, Anschlüsse und Durchdringungen luftdicht nach DIN 4108-7 verklebt. Sie ist die luftdichte Ebene." };
      if (t.material === "fassadenbahn") return { kurz: "Fassadenbahn UV-stabil, diffusionsoffen", menge: t.menge, einheit: "m²",
        lang: "Fassadenbahn diffusionsoffen sd ≤ 0,10 m, dauerhaft UV-stabil für Fassaden mit offenen Fugen, auf der Unterkonstruktion befestigt, Stöße überlappt und verklebt, winddicht. Wind- und Wetterschutz der Dämmung." };
      if (/putz/.test(t.material)) {
        const gips = t.material === "gipsputz";
        return { kurz: `${p}, vollflächig`, menge: t.menge, einheit: "m²",
          lang: `${p} vollflächig auf die Bekleidung, Plattenstöße überputzt, Oberfläche ${gips ? "Q[2/3]" : "[gefilzt / geglättet]"} nach DIN 18350. Der Putz ist die luftdichte Ebene nach DIN 4108-7; Dosen und Durchführungen luftdicht ausführen.` };
      }
      if (t.material === "mineralwolle") return { kurz: `Dämmung ${p}`, menge: t.menge, einheit: "m²",
        lang: `${p}, nichtbrennbar A1, zwischen den Wandhaltern dicht gestoßen und mechanisch befestigt. Bemessungswert der Wärmeleitfähigkeit nach DIN 4108-4.` };
      return { kurz: p + (/winddicht/.test(n) ? ", winddicht" : ""), menge: t.menge, einheit: "m²",
        lang: `${p}, auf der Unterkonstruktion befestigt, Stöße mit Nut und Feder, regensichernd. Bemessungswert der Wärmeleitfähigkeit nach DIN 4108-4.` };
    case "latte_v": {
      if (t.material === "alu") return { kurz: p, menge: t.menge, einheit: "lfm",
        lang: `${p}, Aluminium, an den Wandhaltern befestigt (Fest- und Gleitpunkte); Tragebene der Bekleidung mit Hinterlüftung.` };
      if (!aussen) return { kurz: `Installationsebene, Lattung ${p.replace("Latte ", "")}`, menge: t.menge, einheit: "lfm",
        lang: `Lattung aus Nadelholz ${p.replace("Latte ", "")} mm, senkrecht auf den IA-Verbindern, Achsabstand ${a.achsraster_mm} mm, stehend auf der Schwelle. Leitungen laufen in der Installationsebene, ohne Eingriff in die Steine.` };
      const schraube = teile.find((x) => x.symbol === "schraube" && x.name.startsWith("Holzbauschraube"));
      const luft = /Hinterlüftung (\d+) mm/.exec(n);
      // Senkrechte Latte auf den KVH-Achsen: Traglatte, wenn die Bekleidung direkt daran hängt (Holzleisten),
      // sonst Lattung unter der waagerechten Traglatte (Schindel). Keine „Konterlatte“: Sie kreuzt nichts.
      const mass = /\d+ × \d+/.exec(p)?.[0] || p;
      return { kurz: `${/^Traglatte/.test(n) ? "Traglattung" : "Lattung"} ${mass}, senkrecht`, menge: t.menge, einheit: "lfm",
        lang: `Nadelholz, technisch getrocknet, über der ${a.schichten.some((s) => s.material === "fassadenbahn") ? "Fassadenbahn" : "Holzfaserplatte"} ins KVH verschraubt${schraube ? ` (${schraube.name}, etwa alle 30 cm, Spitze mindestens 4 mm vor dem Stein)` : ""}; bildet die Hinterlüftungsebene${luft ? ` ${luft[1]} mm` : ""}.` };
    }
    case "latte_h": {
      const abstand = /Abstand (\d+)/.exec(n);
      return { kurz: `Traglattung ${p.replace("Traglatte ", "")}, waagerecht`, menge: t.menge, einheit: "lfm",
        lang: `Nadelholz, technisch getrocknet, waagerecht auf der senkrechten Lattung, Abstand nach Deckung der Bekleidung${abstand ? ` [${abstand[1]} mm]` : ""}.` };
    }
    case "schindel": case "leiste_h": case "paneel": {
      // Abgerechnet wird die Fläche; die Stückzahl der Stückliste steht als Orientierung im Text.
      const stueck = t.einheit === "Stk" ? `, ca. ${t.menge} Stück` : t.einheit === "lfm" ? `, ca. ${de(t.menge, 0)} lfm` : "";
      if (!aussen) return { kurz: `Bekleidung ${p}`, menge: flaeche, einheit: "m²",
        lang: `${n}${stueck}, auf der Lattung verschraubt, Stoßfugen versetzt. `
          + (a.schichten.some((s) => /putz/.test(s.material)) ? "Oberfläche nach der Putzposition."
            : t.material === "gipsfaser" ? "Fugen gespachtelt, Oberfläche Q[2/3] nach DIN 18340."
            : "Oberfläche nach Herstellerangabe [gespachtelt / gestrichen].") };
      return { kurz: `Bekleidung ${p}`, menge: flaeche, einheit: "m²",
        lang: `${n}${stueck}, nach Verlegeanleitung des Herstellers, Farbe und Oberfläche nach Bemusterung. Abrechnung nach Fläche, Öffnungen über 2,5 m² abgezogen.` };
    }
    default:
      return { kurz: p, menge: t.menge, einheit: t.einheit, lang: `${n}${t.detail ? `, ${t.detail}` : ""}.` };
  }
}

/** Vorbemerkungen: allgemein, bei Fassade ergänzt um Lastannahmen, Hinterlüftung und Holz. */
function vorbemerkungen(r, fassade, innen, info) {
  const k = r.kennzahlen, mitFassade = !!fassade.schichten?.length;
  const holz = fassade.uk === "holz" || innen.schichten?.some((s) => s.material === "holz");
  const v = [
    ["Entwurf", "Leistungsverzeichnis aus dem SEMBLA Konfigurator. Mengen und Texte sind vom Planer zu prüfen und an das Projekt anzupassen; Angaben in eckigen Klammern sind Platzhalter."],
    ["Leitfabrikat", "Wandsystem SEMBLA, Polycare Research Technology GmbH, oder gleichwertig. Gleichwertig ist ein System, das die Anforderungen an Verwendbarkeit, Bauweise und Bauphysik dieser Vorbemerkungen erfüllt; der Nachweis liegt beim Bieter und ist mit dem Angebot vorzulegen. Fassaden- und Innenprodukte fabrikatsneutral."],
    mitFassade
      ? ["Verwendbarkeit", "Das allgemeine bauaufsichtliche Prüfzeugnis (abP) des Systemherstellers ist in Vorbereitung und deckt SEMBLA als nichttragende Innenwand. Für diese Außenwand mit vorgehängter Fassade (Windlast, Befestigung der Unterkonstruktion über die Verbinder) ist eine Zustimmung im Einzelfall (ZiE) bzw. eine vorhabenbezogene Bauartgenehmigung (vBG) der obersten Bauaufsichtsbehörde [Bundesland] erforderlich. Ausführung erst nach Erteilung; Auflagen der ZiE gehen diesem LV vor."]
      : ["Verwendbarkeit", "nichttragende innere Trennwand nach DIN 4103-1, Einbaubereich [1 / 2]. Nachweis über das allgemeine bauaufsichtliche Prüfzeugnis (abP) des Systemherstellers [Nr. P-…, Prüfstelle, gültig bis …]; das abP ist in Vorbereitung und liegt spätestens vor Ausführungsbeginn vor. Grenzabmessungen nach abP. Tragende Verwendung ist nicht Gegenstand dieser Leistung."],
    ["Bauweise", "Mauerwerk aus Betonformsteinen, trocken ohne Mörtel oder Kleber gefügt und über Gewindestangen vertikal vorgespannt. Alle Bauteile zerstörungsfrei rückbaubar, Steine sortenrein wiedergewinnbar und zu mindestens 90 % wiederverwendbar (Ausschuss beim Rückbau höchstens 10 %)."],
    ["Bauphysik", "Brandverhalten der Steine A1 nach DIN EN 13501-1. Feuerwiderstand [EI … nach abP / nicht gefordert]. Luftschalldämmung [R_w … dB nach Prüfbericht / nicht gefordert]."],
    ["Anschlüsse", `Deckenanschluss gleitend, damit Deckendurchbiegung keine Last in die Wand einträgt; Fuge zur Rohdecke laut Konfiguration ${k.deckenfuge_mm} mm, Maß nach abP prüfen, elastisch und schalltechnisch entkoppelt geschlossen. Wandanschlüsse nach Systemplanung.`],
    ["Planung und Abrechnung", "Den Verlegeplan (Steine, Spannachsen, Öffnungen) liefert der Systemhersteller, Freigabe durch die Bauleitung vor Ausführung. Abrechnung nach VOB/C DIN 18330: Wandfläche ohne Öffnungen, Öffnungen gesondert."],
  ];
  if (mitFassade) {
    v.push(["Lastannahmen (Vorbemessung)", `${info.windlast ? info.windlast.replace(/\.$/, "") + "; " : "Windzone [2], Geländekategorie […], Gebäudehöhe bis [10 m]; "}am Standort zu prüfen. Verbinderanordnung und -anzahl nach Bemessung des Systemherstellers; Prüfung durch den Tragwerksplaner.`]);
    if (fassade.uk === "holz") v.push(["Lastabtrag", "Das Eigengewicht der Fassade trägt ein Fußauflager je Achse sowie Auflager über Öffnungen. Die Verbinder nehmen nur Zug aus Windsog und der Ausmitte der Bekleidung auf; die Klemmung der Verbinder entlang der Verbindernut wird nicht angesetzt, weil sie beim Schwinden des Holzes nachlässt."]);
    const luftdicht = innen.schichten?.some((s) => /putz/.test(s.material)) ? "Luftdichte Ebene ist der Innenputz." : fassade.schichten.some((s) => s.material === "bahn") ? "Luftdichte Ebene ist die Dampfbremse." : "";
    v.push(["Wärme- und Feuchteschutz", r.waerme && fassade.daemmstufen
      ? `U-Wert nach DIN EN ISO 6946 ${de(r.waerme.U, 3)} W/(m²K) mit ${daemmText(fassade)} Dämmung (Vorbemessung), mit Bemessungswerten der Wärmeleitfähigkeit nach DIN 4108-4. Tauwasserschutz nach DIN 4108-3 [Nachweis Glaser / hygrothermische Simulation nach DIN EN 15026]. ${luftdicht}`.trim()
      : `Tauwasserschutz nach DIN 4108-3. ${luftdicht}`.trim()]);
    if (fassade.belueftung_ab) v.push(["Hinterlüftung", "nach DIN 18516-1, Spalt ≥ 20 mm, Zu- und Abluftöffnungen je ≥ 50 cm²/m."]);
  }
  if (holz) v.push(["Holz", `${fassade.uk === "holz" ? "Konstruktionsvollholz und Latten" : "Latten"} technisch getrocknet, Einbaufeuchte ≤ [15] %. Verbinderschrauben mit Unterlegscheibe ≥ 20 mm; Anzugsmoment nach Montageanleitung des Systemherstellers.`]);
  v.push(["Planungsgrundlagen", "SEMBLA-Planungshandbuch. Ausführungsplanung und Statik sind nicht Teil dieses Entwurfs."]);
  if (info.link) v.push(["Datenblatt zur Konfiguration", info.link]);
  return v;
}

/**
 * LV als Struktur: { vorbemerkungen: [[Stichwort, Text]], titel: [{ nr, name, hinweis?,
 * positionen: [{ oz, kurz, menge, einheit, lang, art? }] }] }. art: "psch" | "bedarf".
 */
export function lvDaten(r, fassade, innen, info = {}) {
  const k = r.kennzahlen, w = r.w;
  const gruppen = stueckliste(r, fassade, innen);
  const mitFassade = !!fassade.schichten?.length, mitInnen = !!innen.schichten?.length;
  const titel = [];
  const neuerTitel = (name, hinweis) => titel.push({ nr: String(titel.length + 1).padStart(2, "0"), name, hinweis, positionen: [] });
  const pos = (p) => {
    const t = titel.at(-1);
    t.positionen.push({ oz: `${t.nr}.${String(t.positionen.length + 1).padStart(2, "0")}`, ...p, kurz: kurz(p.kurz) });
  };

  // 01 Rohwand
  neuerTitel("Rohwand SEMBLA");
  const zp = wirksameZwischenpunkte(w).length;
  // Ohne Fassade ist die Wand eine Innenwand: die unbekleidete Seite ist dann die Gegenseite.
  const sicht = !mitFassade && !mitInnen ? "beidseitig" : !mitFassade ? "auf der unbekleideten Seite" : !mitInnen ? "innen" : "";
  pos({ kurz: "Trockenmauerwerk SEMBLA, 12,5 cm, vorgespannt", menge: k.flaeche_m2, einheit: "m²",
    lang: `Nichttragende ${mitFassade ? "Außenwand" : "Innenwand nach DIN 4103-1"} aus SEMBLA-Betonsteinen, 125 mm dick, im 12,5-cm-Raster und in 20-cm-Lagen, trocken und ohne Mörtel gefügt, Stoßfugen versetzt. `
      + `Steinformate i3 (375 × 125 × 200 mm, ${k.i3} Stück) und i2 (250 × 125 × 200 mm, ${k.i2} Stück) nach Verlegeplan. `
      + `Vorspannung über ${k.spannachsen} Spannachsen mit Gewindestangen M10 in den Steinkammern zwischen Bodenblech und Spannplatte, Abstand der Spannachsen höchstens 37,5 cm (drei Raster)${zp ? `, ${zp} Zwischenspannpunkte mit Einlegeblech` : ""}. `
      + `Einschließlich Bodenbleche im Bett aus Vergussmasse${r.w.base_plate.aussparungen ? " (unter Türen ausgespart)" : ""}, Gewindestangen, Kopplungs- und Spannmuttern, Spannplatten${zp ? ", Einlegebleche" : ""}${k.ausgleich_mm ? `, oberste Lage als Ausgleichslage ${k.ausgleich_mm} mm` : ""}. `
      + `Wandlänge ${rm(k.laenge_mm / 1000)} m, Wandhöhe ${de(k.wandhoehe_mm / 1000)} m, lichte Raumhöhe ${de(k.raumhoehe_mm / 1000)} m.`
      + (sicht ? ` Oberfläche Sichtmauerwerk ${sicht}, Steinfarbe [nach Bemusterung].` : "") });
  const nr = { tuer: 0, fenster: 0 };
  for (const op of r.oeffnungen.filter(Boolean)) {
    const tuer = op.art === "tuer", b = rm((op.g1 - op.g0) * 0.125), h = de((op.l1 - op.l0) * 0.2);
    nr[op.art]++;
    pos({ kurz: `${tuer ? "Türöffnung" : "Fensteröffnung"} im SEMBLA-Raster, ${b} × ${h} m`, menge: 1, einheit: "Stk",
      lang: `${tuer ? "Türöffnung" : "Fensteröffnung"}, Rohbaumaß ${b} × ${h} m (B × H)${op.l0 ? `, Brüstung ${de(op.l0 * 0.2)} m` : ""} im 12,5-cm-Raster, Lage ab ${rm(op.g0 * 0.125)} m vom Wandanfang. Laibungen und Sturz im SEMBLA-System nach Verlegeplan, Spannplatten am Segmentende. ${tuer ? "Zarge und Tür" : "Fenster und Fensterbänke"} sind nicht Teil dieser Position.` });
  }
  const decke = gruppen.find((g) => g.id === "anschluss")?.teile.find((t) => t.symbol === "deckenanschluss");
  if (decke) pos({ kurz: "Deckenanschluss gleitend auf Spannachse", menge: decke.menge, einheit: "Stk",
    lang: `Deckenanschluss als Winkel auf jeder Spannachse, an der Rohdecke befestigt, vertikal gleitend für eine Deckendurchbiegung bis [… mm]. Fuge ${k.deckenfuge_mm} mm mit Mineralwolle bzw. Brandschutzband nach abP gefüllt, beidseitig elastisch geschlossen.` });
  pos({ kurz: "Wandanschluss seitlich", menge: 2 * k.raumhoehe_mm / 1000, einheit: "lfm",
    lang: "Anschluss an flankierende Bauteile nach Systemplanung, Trennstreifen aus Mineralwolle, Fuge beidseitig elastisch geschlossen. Menge für Anschlüsse an beiden Wandenden; bei freiem Wandende entfällt sie." });

  // 02 Antrag und Nachweise (nur mit Fassade)
  if (mitFassade) {
    neuerTitel("Antrag und Nachweise (Zustimmung im Einzelfall)");
    pos({ kurz: "Mitwirkung Zustimmung im Einzelfall / vBG", menge: 1, einheit: "psch", art: "psch",
      lang: "Mitwirkung beim Antrag auf Zustimmung im Einzelfall bzw. vorhabenbezogene Bauartgenehmigung: technische Unterlagen, Bemessung der Verbinder, Prüfberichte des Systemherstellers. Gebühren und Gutachten [gesondert / nach Nachweis]." });
    pos({ kurz: "Probewand nach Auflage der ZiE", menge: 1, einheit: "Stk", art: "bedarf",
      lang: "Bedarfsposition: Probewand nach Auflage der ZiE, Größe [… m²], einschließlich Rückbau und Wiederverwendung der Steine." });
  }

  // Fassade und Innenseite
  for (const [id, aufbau, seite, name, hinweis] of [
    ["fassade", fassade, "aussen", `Fassade: ${fassade.name}`, "Ausführbar erst nach Erteilung der ZiE bzw. vBG."],
    ["innen", innen, "innen", `Innenseite: ${innen.name}`],
  ]) {
    const g = gruppen.find((x) => x.id === id);
    if (!g) continue;
    neuerTitel(name, hinweis);
    // Verbinder stehen in der Stückliste unter „Lieferung Polycare“, im LV bei ihrer Seite.
    const alle = [...(gruppen.find((x) => x.id === "verbinder")?.teile.filter((t) => t.seite === seite) || []), ...g.teile];
    // Reihenfolge wie beim Bauen: Verbinder, Auflager, Unterkonstruktion von innen nach außen, Lüftung.
    const rang = (t) => (t.symbol === "verbinder" ? 0 : t.art === "schwelle" || t.symbol === "winkel" ? 1 : t.symbol === "lueftung" ? 3 : 2);
    const teile = [...alle].sort((a, b) => rang(a) - rang(b));
    for (const t of teile) { const p = position(t, aufbau, seite, k.flaeche_m2, alle); if (p) pos(p); }
  }

  return { vorbemerkungen: vorbemerkungen(r, fassade, innen, info), titel };
}

/** LV-Entwurf als Text. info: { titel, link, windlast }. */
export function wandAlsLv(r, fassade, innen, info = {}) {
  const lv = lvDaten(r, fassade, innen, info);
  const aus = [
    info.titel || "SEMBLA-Wand · Leistungsverzeichnis (Entwurf)",
    "=".repeat(60),
    `Stand: ${new Date().toLocaleDateString("de-DE")}`,
    "",
    "Vorbemerkungen",
    "-".repeat(60),
    ...lv.vorbemerkungen.flatMap(([stich, text], i) => umbruch(`${i + 1}. ${stich}: ${text}`).map((z, j) => (j ? "   " + z : z))),
    "",
  ];
  for (const t of lv.titel) {
    aus.push("", `${t.nr}  ${t.name}`, "-".repeat(60));
    if (t.hinweis) aus.push(...umbruch(t.hinweis));
    for (const p of t.positionen) {
      const menge = p.einheit === "Stk" || p.einheit === "psch" ? String(Math.round(p.menge)) : de(p.menge);
      aus.push("", `${p.oz}  ${p.kurz}`, `       Menge: ${menge} ${p.einheit}${p.art === "bedarf" ? "  (Bedarfsposition, nur EP)" : ""}`);
      for (const z of umbruch(p.lang, 85)) aus.push(`       ${z}`);
      aus.push(p.art === "bedarf" ? "       EP: ______________" : "       EP: ______________   GP: ______________");
    }
  }
  aus.push("", "Vorplanung zur Orientierung. Ersetzt keine Ausführungsplanung und keine Statik.", "");
  return aus.join("\r\n");
}
