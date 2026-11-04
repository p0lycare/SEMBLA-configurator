// Kommunikation mit der einbettenden Seite (sembla.de) per postMessage:
//   sembla-konfigurator:hoehe     { hoehe }                       → iframe-Höhe anpassen
//   sembla-konfigurator:formular  { anlass, zusammenfassung }     → Projektformular öffnen
//   sembla-konfigurator:ereignis  { name, daten }                 → an das Tracking von sembla.de
// Der Konfigurator selbst setzt keine Cookies und trackt nichts.

const ERLAUBT = [
  "https://www.sembla.de", "https://sembla.de",
  "http://localhost:8000", "http://127.0.0.1:8000",
];

export const eingebettet = window.parent !== window;

function elternOrigin() {
  const kandidaten = [window.location.ancestorOrigins?.[0], document.referrer];
  for (const k of kandidaten) {
    try { const o = new URL(k).origin; if (ERLAUBT.includes(o)) return o; } catch { /* nächster Kandidat */ }
  }
  return null;
}
const ziel = eingebettet ? elternOrigin() : null;

function senden(typ, daten) {
  if (ziel) window.parent.postMessage({ typ: `sembla-konfigurator:${typ}`, ...daten }, ziel);
}

export function hoeheMelden() {
  if (!eingebettet) return;
  let letzte = 0;
  const melden = () => {
    const h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (h !== letzte) { letzte = h; senden("hoehe", { hoehe: h }); }
  };
  new ResizeObserver(melden).observe(document.documentElement);
  melden();
}

/** Öffnet das Projektformular auf sembla.de; ohne Einbettung als Link in neuem Tab. */
export function formularOeffnen(anlass, zusammenfassung) {
  ereignis("cta", { anlass });
  if (ziel) { senden("formular", { anlass, zusammenfassung }); return; }
  window.open("https://www.sembla.de/produkt/", "_blank", "noopener");
}

export function ereignis(name, daten = {}) { senden("ereignis", { name, daten }); }

/** Adresse der einbettenden Seite (bei fremdem Ursprung meist nur der Ursprung), sonst null. */
export function elternSeite() { return ziel ? document.referrer || ziel : null; }
