// Datenblatt: dieselbe Konfiguration wie im Konfigurator (aus der URL), druckfertig für „Als PDF
// speichern“. Der Link kommt per E-Mail aus HubSpot (siehe js/anfrage.js).

import { berechne, zusammenfassung } from "./wand.js";
import { zeichne } from "./ansicht2d.js";
import { zeichneSchnitt } from "./schnitt2d.js";
import { stueckliste } from "./stueckliste.js";
import { m, zustandAusUrl, urlParameter, aufbauWahl, kachelnHtml, stuecklisteHtml, regelnHtml, hinweiseHtml, waermeHtml, RECHENSTAND, LIEFERUMFANG_TEXT, planungHtml } from "./inhalte.js";
import { ereignis } from "./einbettung.js";

const $ = (id) => document.getElementById(id);
const A = await fetch(new URL("../data/aufbauten.json", import.meta.url))
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .catch(() => null);
if (!A) {
  document.querySelector(".blatt").innerHTML = '<p class="hinweis" role="alert">Das Datenblatt konnte nicht geladen werden. Bitte laden Sie die Seite neu.</p>';
  throw new Error("aufbauten.json nicht geladen");
}

const zustand = zustandAusUrl(new URLSearchParams(location.search));
const { roh, innen, ziel, waerme, verbinder } = aufbauWahl(A, zustand);
const r = berechne({ ...zustand, fassade: roh, innen, waerme, verbinder });

$("datum").textContent = new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
// Einheit in eigenem span: die Überschrift steht in Versalien, die Einheit bleibt „m“.
const mTitel = (mm) => m(mm).replace(/ m$/, ' <span class="einheit">m</span>');
$("titel").innerHTML = `Wand ${mTitel(r.kennzahlen.laenge_mm)} × ${mTitel(r.kennzahlen.wandhoehe_mm)}`;
$("untertitel").textContent = zusammenfassung({ ...zustand, fassade: r.fassade, innen }, r);
zeichne($("zeichnung"), r);
zeichneSchnitt($("schnitt"), r, innen, A.materialien);
$("kacheln").innerHTML = kachelnHtml(r);
$("lieferumfang").textContent = LIEFERUMFANG_TEXT;
if (zustand.ersetzt.length) r.hinweise.unshift("Dieser Link enthielt eine Variante, die es nicht mehr gibt. Sie wurde durch die Voreinstellung ersetzt.");
if (zustand.stand && zustand.stand !== RECHENSTAND)
  r.hinweise.unshift("Seit Ihrer Anfrage wurde die Rechnung des Konfigurators aktualisiert. Die Dämmstärken sind wie damals gewählt, U-Wert und Tauwasserschutz nach aktuellem Stand gerechnet.");
else if (!zustand.stand && r.waerme?.daemmung_mm)
  r.hinweise.unshift("Dieser Link stammt aus einer früheren Version des Konfigurators. Die Dämmstärken sind nach aktuellem Stand neu ausgelegt.");
$("hinweise").innerHTML = hinweiseHtml(r);
$("regeln").innerHTML = regelnHtml(r, innen, false);
$("planung").innerHTML = planungHtml(r, innen);
$("planungBlock").hidden = !$("planung").innerHTML;
$("waerme").innerHTML = waermeHtml(r, innen, A, ziel.id);
$("stueckliste").innerHTML = stuecklisteHtml(stueckliste(r, r.fassade, innen), A.materialien);
$("zurueck").search = new URLSearchParams(urlParameter(zustand, r)).toString();
$("drucken").onclick = () => window.print();

// Downloads für die Planung: BIM (IFC4), CAD (DXF) und Ausschreibungstext. Die Exporte werden erst
// beim Klick geladen, damit das Datenblatt schnell erscheint.
const dateiname = `SEMBLA-Wand_${(r.kennzahlen.laenge_mm / 1000).toFixed(2).replace(".", ",")}x${(r.kennzahlen.wandhoehe_mm / 1000).toFixed(2).replace(".", ",")}m`;
const info = { link: location.href, titel: `SEMBLA-Wand ${m(r.kennzahlen.laenge_mm)} × ${m(r.kennzahlen.wandhoehe_mm)}`, windlast: verbinder?.last?.text };
function herunterladen(inhalt, name, typ) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const EXPORTE = {
  ifc: async () => herunterladen((await import("./export-ifc.js")).wandAlsIfc(r, r.fassade, innen, info), `${dateiname}.ifc`, "application/x-step"),
  dxf: async () => herunterladen((await import("./export-dxf.js")).wandAlsDxf(r, r.fassade, innen, info), `${dateiname}.dxf`, "application/dxf"),
  lv: async () => herunterladen("\ufeff" + (await import("./export-lv.js")).wandAlsLv(r, r.fassade, innen, info), `${dateiname}_Ausschreibung.txt`, "text/plain;charset=utf-8"),
  gaeb: async () => herunterladen((await import("./export-gaeb.js")).wandAlsGaeb(r, r.fassade, innen, info), `${dateiname}_LV.x83`, "application/xml"),
};
document.querySelectorAll("[data-export]").forEach((b) => (b.onclick = async () => {
  b.disabled = true;
  try { await EXPORTE[b.dataset.export](); ereignis("export", { art: b.dataset.export }); }
  finally { b.disabled = false; }
}));
