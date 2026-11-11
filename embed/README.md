# SEMBLA-Konfigurator auf sembla.de einbinden (für die Agentur)

Stand: 03.11.2026

Der Konfigurator ist eine eigenständige Seite. Auf www.sembla.de/produkt wird er per iframe eingebettet. Insgesamt sind vier Dinge zu tun.

## 1. Einbettungscode einfügen

Den Block aus [`sembla-einbettung.html`](sembla-einbettung.html) an der gewünschten Stelle auf /produkt einfügen. Er erledigt drei Dinge:

- Er bettet den Konfigurator ein und passt die Höhe automatisch an. Es gibt keinen zweiten Scrollbalken.
- Er öffnet beim Knopf „Ihr Fassadensystem fehlt? Jetzt anfragen“ das Projektformular von sembla.de.
  - Bitte in `formularOeffnen()` den Text aus `zusammenfassung` in ein verstecktes Feld des Formulars schreiben.
  - Vorläufig wird der vorhandene Knopf „Jetzt Projekt starten“ ausgelöst.
- Er reicht Nutzungsereignisse an den Google Tag Manager weiter (`dataLayer`, Ereignis `sembla_konfigurator`).

Adresse im `src`: `https://konfigurator.sembla.de/?compact=1`. Sie gilt seit 03.11.2026; die alte Adresse unter p0lycare.github.io leitet dorthin weiter.

Getestet am 03.11.2026 mit einer nachgebauten Elternseite: Höhe und Ereignisse kommen an, auch über die Ursprungsgrenze hinweg.

## 2. Cookiebot

- Der iframe und das Skript tragen `data-cookieconsent="ignore"`. Ohne das blockiert das automatische Blockieren von Cookiebot den Konfigurator.
- Der Konfigurator selbst setzt keine Cookies und hat kein eigenes Tracking.
- Ereignisse gehen nur an den `dataLayer` von sembla.de. Ob daraus Tracking wird, regelt der Consent im Tag Manager.
- Terminbuchung (HubSpot Meetings) und Datenblatt-Anfrage (HubSpot Forms) laufen nur, wenn jemand sie aktiv nutzt. Beides gehört in die Datenschutzerklärung.

## 3. DNS für konfigurator.sembla.de (erledigt am 03.11.2026)

Beim Domain-Anbieter von sembla.de einen CNAME-Eintrag anlegen:

| Name | Typ | Ziel |
|---|---|---|
| `konfigurator` | CNAME | `p0lycare.github.io.` |

Empfohlen zusätzlich: die Domain in der GitHub-Organisation p0lycare verifizieren (Settings → Pages → Add a domain). GitHub nennt dann einen TXT-Eintrag `_github-pages-challenge-p0lycare.sembla.de` mit einem Code, der ebenfalls angelegt wird. Das verhindert, dass ein fremdes GitHub-Konto die Adresse übernimmt.

Danach übernimmt Polycare die restlichen Schritte:

- die Domain in GitHub Pages eintragen, HTTPS aktivieren;
- die Domain in HubSpot als Website-Domain eintragen;
- `src` in der Einbettung umstellen.

## 4. Schriften (CORS)

Der Konfigurator lädt die Hausschriften von sembla.de:

- `/fonts/TT_Interphases_Pro_Regular.woff2`
- `/fonts/TT_Interphases_Pro_Bold.woff2`
- `/fonts/Maison-Neue-Mono.woff`

Der Browser blockt sie heute, weil der Server keinen CORS-Kopf schickt. Bitte für den Ordner `/fonts/` diesen Kopf setzen:

```
Access-Control-Allow-Origin: https://konfigurator.sembla.de
```

Alternativ `*`, dann aber nur für den Ordner `/fonts/`. Die Schriftlizenz bleibt davon unberührt, die Dateien liegen weiterhin nur auf sembla.de.

www.sembla.de läuft auf Netlify. Dort genügt ein Eintrag in der Datei `_headers` im veröffentlichten Ordner:

```
/fonts/*
  Access-Control-Allow-Origin: *
```

## Nachrichten des Konfigurators

Der Konfigurator schickt `window.postMessage` an die Elternseite. Der Einbettungscode nimmt nur Nachrichten von der Konfigurator-Adresse an.

| typ | Inhalt |
|---|---|
| `sembla-konfigurator:hoehe` | `hoehe` in Pixeln |
| `sembla-konfigurator:formular` | `anlass` (`fassadensystem`), `zusammenfassung` |
| `sembla-konfigurator:ereignis` | `name`, `daten` |

Diese Ereignisnamen gibt es:

| Name | Bedeutung |
|---|---|
| `fassade_gewaehlt` | Fassade gewählt |
| `innen_gewaehlt` | Innenseite gewählt |
| `oeffnung` | Tür oder Fenster hinzugefügt |
| `oeffnung_position` | Position einer Öffnung als Zahl eingegeben |
| `info` | Reiter geöffnet (So funktioniert's, Stückliste, Wärmeschutz) |
| `ansicht` | Vorschau gewechselt, `daten.ansicht`: `3d`, `aussen` oder `innen` |
| `vollbild` | Vorschau im Vollbild geöffnet |
| `stueckliste_csv` | Stückliste als CSV geladen |
| `rueckbau_angesehen` | Rückbau-Regler bis zum Ende geschoben |
| `cta` | Knopf gedrückt, `daten.anlass`: `termin` oder `fassadensystem` |
| `datenblatt_angefordert` | Datenblatt-Anfrage erfolgreich abgeschickt |

Das Attribut `allow="fullscreen"` am iframe nicht entfernen: Ohne es füllt der Knopf „Vollbild“ nur den iframe statt des Bildschirms.

Zum Ausprobieren gibt es die Testseite `embed/test.html`. Sie wird lokal mit `npx serve` oder einem anderen Webserver auf Port 8000 geöffnet.
