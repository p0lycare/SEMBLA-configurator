// Datenblatt gegen Kontaktdaten: Das Formular schickt die Angaben direkt an die Formular-Schnittstelle
// von HubSpot (ohne Schlüssel, ohne Server). Ein HubSpot-Workflow verschickt dann die E-Mail mit dem
// Link zum Datenblatt; erst dadurch kommt es beim Kontakt an. Einrichtung: docs/HUBSPOT.md.

import { formularOeffnen, ereignis, elternSeite } from "./einbettung.js";

export const HUBSPOT = {
  portalId: "19508245",
  formGuid: "d3ebe3db-0ff2-48e4-902a-d1fcdba6b39b",   // Formular „Konfigurator Datenblatt“; leer = Anfrage über das Projektformular
  endpunkt: "https://api.hsforms.com/submissions/v3/integration/submit",
  // Abo-Typ der Datenblatt-Mail („Auto-Reply | Eingangsbestätigung Kundenanfrage“). Das Portal läuft im
  // DSGVO-Modus: Ohne Zustimmung zu genau diesem Abo-Typ blockt HubSpot die Mail.
  aboTyp: 2003065224,
  felder: { link: "konfigurator_datenblatt_link", zusammenfassung: "konfigurator_zusammenfassung" },
};

// Seitenadresse für HubSpot nur mit Ursprung und Pfad: ohne UTM-Parameter, Klick-Kennungen und
// Konfiguration in der Adresse (die steht als Datenblatt-Link im eigenen Feld).
const seitenadresse = (u) => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return ""; } };
const cookie = (name) => document.cookie.split("; ").find((c) => c.startsWith(name + "="))?.split("=")[1];

/**
 * formular: <form> mit Feldern firstname, lastname, email, company, einwilligung (Pflicht) und
 * kontakt (freiwillig, eigener Zweck);
 * knopf: öffnet das Formular; daten(): { zusammenfassung, link } der aktuellen Konfiguration;
 * beimOeffnen(): aktualisiert die Vorschau im Formular.
 */
export function datenblattAnfrage({ formular, knopf, daten, beimOeffnen = () => {} }) {
  const status = formular.querySelector("[data-status]");
  knopf.onclick = () => {
    if (!HUBSPOT.formGuid) {
      const d = daten();
      formularOeffnen("datenblatt", `Datenblatt anfordern · ${d.zusammenfassung} · ${d.link}`);
      return;
    }
    formular.hidden = !formular.hidden;
    knopf.setAttribute("aria-expanded", String(!formular.hidden));
    if (!formular.hidden) { beimOeffnen(); formular.querySelector("input").focus(); }
  };

  formular.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(formular), d = daten();
    const feld = (name, value) => ({ objectTypeId: "0-1", name, value });
    // Zwei getrennte Zwecke: Das Datenblatt zu schicken ist Pflicht, der Kontaktwunsch freiwillig.
    // HubSpot bekommt den Text genau der Häkchen, die gesetzt sind; der Vertrieb sieht den Kontaktwunsch
    // in der Zusammenfassung.
    const text = (name) => formular.querySelector(`[name=${name}]`).closest(".einwilligung").querySelector("span").textContent.replace(/\s+/g, " ").trim();
    const kontakt = f.get("kontakt") === "on";
    const einwilligung = kontakt ? `${text("einwilligung")} ${text("kontakt")}` : text("einwilligung");
    const zusammenfassung = `${d.zusammenfassung}\nKontaktwunsch: ${kontakt ? "ja" : "nein, nur Datenblatt"}`;
    const body = {
      fields: [
        feld("firstname", f.get("firstname")), feld("lastname", f.get("lastname")),
        feld("email", f.get("email")), feld("company", f.get("company")),
        feld(HUBSPOT.felder.link, d.link), feld(HUBSPOT.felder.zusammenfassung, zusammenfassung),
      ].filter((x) => x.value),
      context: { pageUri: seitenadresse(elternSeite() || location.href), pageName: "SEMBLA Konfigurator", ...(cookie("hubspotutk") ? { hutk: cookie("hubspotutk") } : {}) },
      legalConsentOptions: { consent: {
        consentToProcess: true, text: einwilligung,
        communications: [{ value: true, subscriptionTypeId: HUBSPOT.aboTyp, text: einwilligung }],
      } },
    };
    const senden = formular.querySelector("button[type=submit]");
    senden.disabled = true;
    status.textContent = "Wird gesendet …";
    try {
      const antwort = await fetch(`${HUBSPOT.endpunkt}/${HUBSPOT.portalId}/${HUBSPOT.formGuid}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!antwort.ok) throw new Error(String(antwort.status));
      const danke = Object.assign(document.createElement("p"), {
        className: "danke", tabIndex: -1,
        textContent: `Danke! Das Datenblatt ist unterwegs an ${f.get("email")}. Bitte schauen Sie auch im Spam-Ordner nach.`,
      });
      danke.setAttribute("role", "status");
      formular.querySelector(".anfrage-formular").replaceChildren(danke);
      danke.focus();
      ereignis("datenblatt_angefordert", { kontakt });
    } catch {
      senden.disabled = false;
      status.textContent = "Das hat nicht geklappt. Bitte versuchen Sie es noch einmal oder nutzen Sie das Projektformular.";
    }
  };
}
