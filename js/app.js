// Oberfläche: Zustand, Bedienelemente, Kennzahlen, Regeln. Die Konfiguration steht in der URL
// (?l=…&h=…), damit sich ein Stand teilen lässt.

import { berechne, zusammenfassung, GRENZEN, OEFFNUNGEN } from "./wand.js";
import { zeichne } from "./ansicht2d.js";
import { eingebettet, hoeheMelden, formularOeffnen, ereignis } from "./einbettung.js";
import { stueckliste, alsCsv } from "./stueckliste.js";
import { daemmText } from "./waerme.js";
import { de, m, esc, zustandAusUrl, urlParameter, datenblattParameter, aufbauWahl, kachelnHtml, stuecklisteHtml, regelnHtml, hinweiseHtml, waermeHtml } from "./inhalte.js";
import { datenblattAnfrage } from "./anfrage.js";

const $ = (id) => document.getElementById(id);
const A = await fetch(new URL("../data/aufbauten.json", import.meta.url))
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .catch(() => null);
if (!A) {
  document.querySelector(".layout").innerHTML = '<p class="hinweis" role="alert">Die Daten des Konfigurators konnten nicht geladen werden. Bitte laden Sie die Seite neu.</p>';
  throw new Error("aufbauten.json nicht geladen");
}

const url = new URLSearchParams(location.search);
if (url.get("compact") === "1" || eingebettet) document.documentElement.classList.add("kompakt");

const zustand = { ...zustandAusUrl(url), ansicht: "3d" };
delete zustand.fest;   // gespeicherte Dämmstärken gelten nur im Datenblatt; hier wird neu ausgelegt
let ergebnis = null;

// ---------- 3D (verzögert geladen; ohne WebGL bleibt die 2D-Ansicht) ----------
let modell = null;
import("./modell3d.js").then((mod) => {
  modell = mod.erstelle($("canvas3d"));
  if (!modell) { $("glFehler").hidden = false; ansicht("2d"); }
  else { modell.setze({ ebenen }); aktualisieren(); }
}).catch(() => { $("glFehler").hidden = false; ansicht("2d"); });

// ---------- Eingaben ----------
function pills(el, aktiv, beiKlick) {
  el.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.wert === aktiv));
    b.onclick = () => beiKlick(b.dataset.wert);
  });
}

$("laenge").value = zustand.laenge_mm;
$("hoehe").value = zustand.raumhoehe_mm;
$("laenge").min = GRENZEN.laengeMin; $("laenge").max = GRENZEN.laengeMax;
$("hoehe").min = GRENZEN.hoeheMin; $("hoehe").max = GRENZEN.hoeheMax;
$("laenge").oninput = (e) => { zustand.laenge_mm = +e.target.value; planen(); };
$("hoehe").oninput = (e) => { zustand.raumhoehe_mm = +e.target.value; planen(); };
const meter = (mm) => `${de(mm / 1000)} Meter`;

// ---------- Öffnungen ----------
let listenSchluessel = "";
function oeffnungenZeichnen(r) {
  const N = r.w.length_mm / 125;
  const schluessel = zustand.oeffnungen.map((o) => o.art).join() + "|" + N;
  const liste = $("oeffnungsliste");
  if (schluessel !== listenSchluessel) {
    listenSchluessel = schluessel;
    let fenster = 0;
    liste.innerHTML = zustand.oeffnungen.map((o, i) => {
      const def = OEFFNUNGEN[o.art];
      const titel = o.art === "tuer" ? def.name : `${def.name} ${++fenster}`;
      return `<div class="oeffnung-zeile" data-i="${i}">
        <span class="zeile"><b>${titel}</b><span class="klein mono" data-info></span>
          <button type="button" class="entfernen" data-weg="${i}" aria-label="${titel} entfernen">×</button></span>
        <input type="range" min="0" max="${N - def.breite_grid}" step="1" data-pos="${i}" aria-label="Position ${titel}, Abstand vom linken Wandende">
      </div>`;
    }).join("");
    liste.querySelectorAll("[data-pos]").forEach((el) => (el.oninput = () => {
      const i = +el.dataset.pos;
      zustand.oeffnungen[i].pos = +el.value; zustand.aktiv = i; planen();
    }));
    liste.querySelectorAll("[data-weg]").forEach((el) => (el.onclick = () => {
      zustand.oeffnungen.splice(+el.dataset.weg, 1); zustand.aktiv = -1; planen();
    }));
  }
  zustand.oeffnungen.forEach((o, i) => {
    const zeile = liste.querySelector(`[data-i="${i}"]`);
    const res = r.oeffnungen[i];
    zeile.classList.toggle("passt-nicht", !res);
    zeile.querySelector("[data-info]").textContent = res
      ? `${OEFFNUNGEN[o.art].masse} · ab ${m(res.g0 * 125)}` : "passt nicht in die Wand";
    if (res) {
      o.pos = res.g0;
      const regler = zeile.querySelector("[data-pos]");
      regler.value = res.g0;
      regler.setAttribute("aria-valuetext", `ab ${meter(res.g0 * 125)}`);
    }
  });
  for (const art of ["tuer", "fenster"])
    $(art === "tuer" ? "plusTuer" : "plusFenster").disabled = zustand.oeffnungen.filter((o) => o.art === art).length >= OEFFNUNGEN[art].max;
}
function hinzufuegen(art) {
  if (zustand.oeffnungen.filter((o) => o.art === art).length >= OEFFNUNGEN[art].max) return;
  zustand.oeffnungen.push({ art, pos: null });
  zustand.aktiv = zustand.oeffnungen.length - 1;
  ereignis("oeffnung", { art });
  const r = berechne(cfgAktuell());
  if (!r.oeffnungen[zustand.aktiv]) {
    zustand.oeffnungen.pop(); zustand.aktiv = -1;
    $("oeffnungHinweis").textContent = `Für ${art === "tuer" ? "eine Tür" : "ein weiteres Fenster"} ist kein Platz mehr. Verlängern Sie die Wand oder verschieben Sie die anderen Öffnungen.`;
    $("oeffnungHinweis").hidden = false;
    return;
  }
  planen();
}
$("plusTuer").onclick = () => hinzufuegen("tuer");
$("plusFenster").onclick = () => hinzufuegen("fenster");

// Zur Auswahl stehen nur freigegebene Varianten; die übrigen bleiben für ältere Links rechenbar.
const FREI = (x) => x.freigegeben !== false;
$("fassaden").innerHTML = A.fassaden.filter(FREI).map((f) => `
  <button type="button" class="karte" data-wert="${f.id}">
    <span class="titel">${esc(f.name)}</span>
    <span class="daten">${f.schichten.length ? `<span>${f.uk === "holz" ? "Holz-UK" : "Alu-UK"}</span><span>≈ ${f.flaechengewicht_kg_m2} kg/m²</span>` : "<span>Sichtmauerwerk</span>"}</span>
  </button>`).join("");
$("innen").innerHTML = A.innen.filter(FREI).map((f) => `<button type="button" data-wert="${f.id}">${esc(f.name)}</button>`).join("");

// ---------- Ansicht ----------
const ebenen = { steine: true, spann: true, verbinder: true, fassade: true, innen: true };
const EBENEN_NAMEN = { steine: "Steine", spann: "Spannsystem", verbinder: "Verbinder", fassade: "Fassade", innen: "Innen" };
function ebenenZeichnen() {
  $("ebenen").innerHTML = Object.keys(ebenen).map((k) => `<button type="button" data-wert="${k}" aria-pressed="${ebenen[k]}">${EBENEN_NAMEN[k]}</button>`).join("");
  $("ebenen").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    ebenen[b.dataset.wert] = !ebenen[b.dataset.wert]; ebenenZeichnen(); modell?.setze({ ebenen });
  }));
}
ebenenZeichnen();

function ansicht(a) {
  zustand.ansicht = a;
  for (const [id, wert] of [["tab3d", "3d"], ["tab2d", "2d"]]) {
    $(id).setAttribute("aria-selected", String(a === wert));
    $(id).tabIndex = a === wert ? 0 : -1;
  }
  $("ansicht3d").hidden = a !== "3d";
  $("ansicht2d").hidden = a !== "2d";
}
function infoTab(b) {
  document.querySelectorAll("#infoTabs [data-tab]").forEach((x) => { x.setAttribute("aria-selected", String(x === b)); x.tabIndex = x === b ? 0 : -1; });
  document.querySelectorAll(".info[data-panel]").forEach((el) => (el.hidden = el.dataset.panel !== b.dataset.tab));
  ereignis("info", { tab: b.dataset.tab });
}
document.querySelectorAll("#infoTabs [data-tab]").forEach((b) => (b.onclick = () => infoTab(b)));
// Pfeiltasten, Pos1 und Ende wechseln in Tablisten den Reiter (WAI-ARIA Tabs).
document.querySelectorAll("[role=tablist]").forEach((liste) => liste.addEventListener("keydown", (e) => {
  const tabs = [...liste.querySelectorAll("[role=tab]")];
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (j === undefined) return;
  e.preventDefault();
  const ziel = tabs[(j + tabs.length) % tabs.length];
  ziel.focus(); ziel.click();
}));
$("tab3d").onclick = () => ansicht("3d");
$("tab2d").onclick = () => ansicht("2d");
document.querySelectorAll("[data-blick]").forEach((b) => (b.onclick = () => modell?.blick(b.dataset.blick)));

$("faechern").oninput = (e) => modell?.setze({ faechern: +e.target.value / 100 });
let rueckbauGemeldet = false;
$("rueckbau").oninput = (e) => {
  const t = +e.target.value / 100;
  modell?.setze({ rueckbau: t });
  rueckbauText(t);
  if (t > 0.95 && !rueckbauGemeldet) { rueckbauGemeldet = true; ereignis("rueckbau_angesehen"); }
};
function rueckbauText(t) {
  const k = ergebnis?.kennzahlen;
  const fass = A.fassaden.find((f) => f.id === zustand.fassade) || A.fassaden[0];
  let schritt, text;
  if (t === 0) { schritt = ""; text = "Schieben Sie den Regler: So wird die Wand zerstörungsfrei zurückgebaut."; }
  else if (t < 0.36) { schritt = "Schritt 1 von 3"; text = `Ausbau lösen: ${fass.rueckbau || "Innenausbau an den Verbindern lösen."} Die Verbinder kommen aus den Nuten, die Steine bleiben unbeschädigt.`; }
  else if (t < 0.6) { schritt = "Schritt 2 von 3"; text = `Vorspannung lösen: Die Muttern werden geöffnet, ${k?.gewindestangen ?? ""} Gewindestangen werden aus den Kammern gezogen.`; }
  else { schritt = "Schritt 3 von 3"; text = `Lage für Lage abheben: Alle ${k?.steine ?? ""} Steine lassen sich wieder einsetzen. Das Gebäude wird zum Bauteillager.`; }
  $("rueckbauSchritt").textContent = schritt;
  $("rueckbauText").textContent = text;
}

// ---------- Rechnen und Darstellen ----------
let geplant = 0;
function planen() { if (!geplant) geplant = requestAnimationFrame(() => { geplant = 0; aktualisieren(); }); }
// Das 3D-Modell wird beim Ziehen eines Reglers erst nach einer kurzen Pause neu aufgebaut.
let modellTimer = 0;
function modellAktualisieren(r, fassade, innen) {
  clearTimeout(modellTimer);
  modellTimer = setTimeout(() => modell?.aktualisiere(r, fassade, innen, A.materialien), 120);
}

function aktualisieren() {
  const { roh, innen, ziel, verbinder, waerme: wcfg } = aufbauWahl(A, zustand, { nurFreigegeben: true });
  ergebnis = berechne({ ...zustand, fassade: roh, innen, waerme: wcfg, verbinder });
  const r = ergebnis, k = r.kennzahlen, fassade = r.fassade, waerme = r.waerme;

  $("laengeWert").textContent = m(k.laenge_mm, 3).replace(/0 m$/, " m");
  $("hoeheWert").textContent = m(k.raumhoehe_mm);
  $("laenge").setAttribute("aria-valuetext", meter(k.laenge_mm));
  $("hoehe").setAttribute("aria-valuetext", meter(k.raumhoehe_mm));
  pills($("fassaden"), fassade.id, (v) => { zustand.fassade = v; ereignis("fassade_gewaehlt", { fassade: v }); planen(); });
  pills($("innen"), innen.id, (v) => { zustand.innen = v; ereignis("innen_gewaehlt", { innen: v }); planen(); });
  $("fassadeText").textContent = fassade.kurz;
  $("innenText").textContent = innen.kurz;
  $("uKurz").innerHTML = uKurz(waerme, ziel, fassade);

  oeffnungenZeichnen(r);
  if (zustand.aktiv === -1) $("oeffnungHinweis").hidden = true;

  $("masse").textContent = `${m(k.laenge_mm)} × ${m(k.raumhoehe_mm)} · ${k.steine} Steine`;

  $("kacheln").innerHTML = kachelnHtml(r);
  $("waerme").innerHTML = waermeHtml(r, innen, A, ziel.id);
  teile = stueckliste(r, fassade, innen);
  $("stueckliste").innerHTML = stuecklisteHtml(teile, A.materialien);
  $("regeln").innerHTML = regelnHtml(r, innen);
  if (zustand.ersetzt.length) r.hinweise.unshift("Der Link enthielt eine Variante, die der Konfigurator derzeit nicht anbietet. Sie wurde durch die Voreinstellung ersetzt.");
  $("hinweise").innerHTML = hinweiseHtml(r);

  zeichne($("zeichnung"), r);
  if (!$("anfrage").hidden && $("anfrageBild")) anfrageVorschau();
  modellAktualisieren(r, fassade, innen);
  rueckbauText(+$("rueckbau").value / 100);

  const p = new URLSearchParams(location.search);
  Object.entries(urlParameter(zustand, r)).forEach(([a, b]) => p.set(a, b));
  p.delete("p");
  history.replaceState(null, "", `?${p}`);
}

let teile = [];
$("csv").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + alsCsv(teile)], { type: "text/csv;charset=utf-8" }));
  a.download = "SEMBLA-Stueckliste.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  ereignis("stueckliste_csv");
};

// ---------- Wärmeschutz ----------
function uKurz(w, ziel, fassade) {
  if (!fassade.daemmstufen) return `Ohne Dämmung U ≈ ${de(w.U, 1)} W/(m²K): für Innenwände oder unbeheizte Bereiche.`;
  const fe = w.feuchte;
  const tau = fe ? (fe.ok ? " · Tauwasserschutz DIN 4108-3 ✓" : " · <span class=\"u-nein\">Tauwasserschutz prüfen</span>") : "";
  return w.erfuellt
    ? `<span class="u-ok"><b>U = ${de(w.U, 3)} W/(m²K)</b> (Ziel ${ziel.name}, U ≤ ${de(ziel.U)}) mit ${daemmText(fassade)} Dämmung${tau}</span>`
    : `<span class="u-nein"><b>U = ${de(w.U, 3)} W/(m²K)</b>: ${ziel.name} mit diesem Aufbau nicht erreicht, auch nicht mit ${daemmText(fassade)}.</span>`;
}

// ---------- Formular ----------
// Terminbuchung: HubSpot-Terminseite (30 Min., Teams) im neuen Tab.
$("ctaTermin").onclick = () => ereignis("cta", { anlass: "termin" });
$("fassadeAnfragen").onclick = () => formularOeffnen("fassadensystem", `Fassadensystem anfragen · ${zusammenfassung(cfgAktuell(), ergebnis)}`);
datenblattAnfrage({
  formular: $("anfrage"),
  knopf: $("ctaDatenblatt"),
  daten: () => ({ zusammenfassung: zusammenfassung(cfgAktuell(), ergebnis), link: datenblattLink() }),
  beimOeffnen: anfrageVorschau,
});
function anfrageVorschau() {
  zeichne($("anfrageBild"), ergebnis);
  $("anfrageZusammenfassung").textContent = zusammenfassung(cfgAktuell(), ergebnis);
}
function datenblattLink() {
  const u = new URL("datenblatt.html", location.href);
  Object.entries(datenblattParameter(zustand, ergebnis)).forEach(([a, b]) => u.searchParams.set(a, b));
  return u.href;
}
function cfgAktuell() {
  return { ...zustand, fassade: ergebnis.fassade, innen: A.innen.find((f) => f.id === zustand.innen) };
}

aktualisieren();
hoeheMelden();
