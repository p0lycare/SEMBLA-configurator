// GAEB DA XML 3.3, Phase X83 (Angebotsaufforderung): dasselbe LV wie der Ausschreibungstext
// (lvDaten), mit Mengen und ohne Preise. Vorbemerkungen als AddText der Vergabe, je Titel ein
// BoQCtgy, je Position ein Item mit Kurz- und Langtext. Elementreihenfolge nach
// GAEB_DA_XML_83_3.3_2021-05.xsd. Reines Modul ohne DOM.

import { lvDaten } from "./export-lv.js";

const NS = "http://www.gaeb.de/GAEB_DA_XML/DA83/3.3";
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hex = () => (globalThis.crypto?.randomUUID?.() || Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(""))
  .replace(/-/g, "").toUpperCase();
const id = () => "_" + hex();
// Mengeneinheiten wie in AVA-Programmen üblich (QU, höchstens 4 Zeichen).
const QU = { "m²": "m2", lfm: "m", Stk: "St", psch: "psch" };
const span = (t) => `<span>${xml(t)}</span>`;
const absaetze = (t) => t.split("\n").map((z) => `<p>${span(z)}</p>`).join("");

/** LV als GAEB-DA-XML-Datei (X83). info: { titel, link, windlast, datum? } */
export function wandAlsGaeb(r, fassade, innen, info = {}) {
  const lv = lvDaten(r, fassade, innen, info);
  const datum = (info.datum || new Date()).toISOString().slice(0, 10);
  const name = info.titel || "SEMBLA-Wand";
  const z = [];
  z.push('<?xml version="1.0" encoding="UTF-8"?>');
  z.push(`<GAEB xmlns="${NS}">`);
  z.push(`<GAEBInfo><Version>3.3</Version><VersDate>2021-05</VersDate><Date>${datum}</Date><ProgSystem>SEMBLA Konfigurator</ProgSystem><ProgName>konfigurator.sembla.de</ProgName></GAEBInfo>`);
  z.push(`<PrjInfo><NamePrj>${xml(name)}</NamePrj><LblPrj>${xml(name)}</LblPrj><Cur>EUR</Cur><CurLbl>Euro</CurLbl></PrjInfo>`);
  z.push("<Award><DP>83</DP><AwardInfo><Cur>EUR</Cur><CurLbl>Euro</CurLbl></AwardInfo>");
  z.push(`<AddText><OutlineAddText>${span("Vorbemerkungen")}</OutlineAddText><DetailAddText>`
    + lv.vorbemerkungen.map(([stich, text], i) => `<p>${span(`${i + 1}. ${stich}: ${text}`)}</p>`).join("")
    + "</DetailAddText></AddText>");
  z.push(`<BoQ ID="${id()}"><BoQInfo><Name>SEMBLA</Name><LblBoQ>${xml(`${name} · Leistungsverzeichnis (Entwurf)`)}</LblBoQ><OutlCompl>AllTxt</OutlCompl>`
    + "<BoQBkdn><Type>BoQLevel</Type><Length>2</Length><Num>Yes</Num></BoQBkdn>"
    + "<BoQBkdn><Type>Item</Type><Length>2</Length><Num>Yes</Num></BoQBkdn></BoQInfo><BoQBody>");
  for (const t of lv.titel) {
    z.push(`<BoQCtgy ID="${id()}" RNoPart="${t.nr}"><LblTx><p>${span(t.name)}</p></LblTx><BoQBody><Itemlist>`);
    for (const p of t.positionen) {
      const lang = t.hinweis && p === t.positionen[0] ? `${t.hinweis}\n${p.lang}` : p.lang;
      z.push(`<Item ID="${id()}" RNoPart="${p.oz.split(".")[1]}">`
        + (p.art === "bedarf" ? "<Provis>WithoutTotal</Provis>" : "")
        + (p.art === "psch" ? "<LumpSumItem>Yes</LumpSumItem>" : "")
        + `<Qty>${(Math.round(p.menge * 1000) / 1000).toFixed(3)}</Qty><QU>${QU[p.einheit] || xml(p.einheit)}</QU>`
        + `<Description ID="${hex()}"><CompleteText><DetailTxt><Text>${absaetze(lang)}</Text></DetailTxt>`
        + `<OutlineText><OutlTxt><TextOutlTxt>${span(p.kurz)}</TextOutlTxt></OutlTxt></OutlineText></CompleteText></Description></Item>`);
    }
    z.push("</Itemlist></BoQBody></BoQCtgy>");
  }
  z.push("</BoQBody></BoQ></Award></GAEB>");
  return z.join("\n");
}
