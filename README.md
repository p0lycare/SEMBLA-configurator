# SEMBLA® Konfigurator

Spielerischer Online-Konfigurator für Architekt:innen und Planer:innen: Wandmaße, Öffnung, Fassade und Innenausbau wählen, Steinverband, Vorspannung und lösbare Verbinder in 3D sehen, Rückbau durchspielen. Eingebettet per iframe auf [sembla.de/produkt](https://www.sembla.de/produkt), geplant unter `konfigurator.sembla.de`.

Die Anforderungen und Entscheidungen stehen in [`docs/ANFORDERUNGEN.md`](docs/ANFORDERUNGEN.md).

## Lokal starten

Kein Build-Schritt, kein Backend. Wegen der ES-Module genügt ein einfacher HTTP-Server:

```bash
python3 -m http.server 8000
```

Dann <http://localhost:8000/> öffnen. Die Einbettung lässt sich unter <http://localhost:8000/embed/test.html> testen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html`, `css/app.css` | Seite und CI (Grün #1FAA5F, Webfonts von sembla.de) |
| `js/app.js` | Bedienung, Kennzahlen, Regeltexte, Konfiguration in der URL |
| `js/wand.js` | Fachlogik: Rechenkern aufrufen, Öffnungen, UK-Achsen, Verbinder, Schraubenlänge |
| `js/sembla-core.js`, `js/sembla-aufbau.js` | Rechenkern und Modul 2 (Verbinder, Latten) der [Planungs-Suite](https://github.com/p0lycare/SEMBLA-planning-suite), **unverändert** übernommen, nie von Hand ändern |
| `js/rechenkern.version.json` | Herkunft der übernommenen Module (Commit, Prüfsumme, Datum) |
| `data/steine.json` | reduzierte Steingeometrie i2/i3 (aus den reduzierten Bauteil-OBJs) |
| `data/spannteile.json` | Spannteile: Mutter, Kopplungsmutter, Senkkopfschraube, Einlegeblech (aus den Bauteil-OBJs) |
| `tools/obj-zu-json.mjs` | wandelt Bauteil-OBJs in diese Netze: `node tools/obj-zu-json.mjs ziel.json name=teil.obj …` |
| `js/ansicht2d.js`, `js/modell3d.js` | 2D-Wandansicht (SVG) und 3D-Modell (three.js 0.160 vom CDN) |
| `js/einbettung.js` | postMessage an sembla.de: Höhe, Formular, Ereignisse |
| `js/waerme.js` | U-Wert nach DIN EN ISO 6946 und Auslegung der Dämmstärke auf GEG/BEG/EH 40 |
| `js/inhalte.js` | Kennzahlen, Stückliste, Regeln, Wärmeschutz als HTML; gemeinsam für Konfigurator und Datenblatt |
| `datenblatt.html`, `js/datenblatt.js` | druckfertiges Datenblatt („Als PDF speichern“), Link kommt per E-Mail |
| `js/anfrage.js` | Datenblatt-Anfrage an HubSpot, Einrichtung in [`docs/HUBSPOT.md`](docs/HUBSPOT.md) |
| `data/aufbauten.json` | Fassaden- und Innenaufbauten, neue Varianten ohne Programmierung |
| `embed/sembla-einbettung.html` | Snippet für die Agentur |
| `tests/test-konfigurator.mjs` | Regressionstests (`npm test`) |

## Neue Fassade ergänzen

In `data/aufbauten.json` unter `fassaden` einen Eintrag anlegen. Die Schichten laufen von der Steinoberfläche nach außen; `art` ist eine von `staender`, `feld`, `platte`, `latte_v`, `latte_h`, `halter`, `schindel`, `leiste_h`, `paneel`. Danach `npm test` laufen lassen, er prüft die Daten mit.

## Rechenkern aktuell halten

Die Action **Rechenkern abgleichen** (`.github/workflows/rechenkern.yml`) holt täglich die aktuelle `sembla-core.js` und `sembla-aufbau.js` aus der Planungs-Suite. Sind die Tests mit dem neuen Kern grün, wird er übernommen und veröffentlicht. Sonst bleibt der alte Kern live, und es entsteht ein Issue. Auslösen von Hand: Actions → „Rechenkern abgleichen“ → „Run workflow“.

## Veröffentlichung

Jeder Push auf `main` startet **Pages** (`.github/workflows/pages.yml`): erst die Tests, dann die Veröffentlichung. Sind die Tests rot, bleibt der bisherige Stand live.

> Vorplanung zur Orientierung. Ersetzt keine Ausführungsplanung und keine Statik.
