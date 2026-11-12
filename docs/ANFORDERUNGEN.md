# SEMBLA-Konfigurator – Anforderungen

Stand: 02.11.2026 · Entwurf zur Abstimmung

## 1 · Ziel und Zielgruppe

Ein spielerischer Online-Konfigurator, mit dem **Architekt:innen und Planer:innen** das SEMBLA-Mauerwerksystem in wenigen Minuten verstehen und davon überzeugt werden. Es ist kein Planungswerkzeug; dafür gibt es die [SEMBLA Planungs-Suite](https://p0lycare.github.io/SEMBLA-planning-suite/).

Nach etwa zwei Minuten soll die Person verstanden haben:

1. **Raster:** alles im 12,5-cm-Raster und in 20-cm-Lagen, nur zwei Steine (i3 und i2).
2. **Trocken und vorgespannt:** kein Mörtel; Gewindestangen in den Kammern spannen die Wand.
3. **Anschlussfähig:** Fassade und Innenausbau werden über lösbare Verbinder in den Verbindernuten befestigt.
4. **Zirkulär:** alles lässt sich zerstörungsfrei zurückbauen und wiederverwenden.
5. **Schlank:** 12,5 cm Wand bringen gegenüber dicken Wänden Nutzfläche.

Am Ende steht ein klarer Call to Action: „Projekt starten“ bzw. „Wand vom Planungsteam prüfen lassen“.

## 2 · Technischer Rahmen („so einfach wie möglich“)

| Thema | Entscheidung |
|---|---|
| Hosting | GitHub Pages aus diesem Repo (`p0lycare/SEMBLA-configurator`) |
| Aufbau | statische Seite, **kein Build-Schritt**, kein Backend, wie bei der Planning-Suite |
| Code | Vanilla-JS (ES-Module), ein `index.html` plus wenige Dateien |
| 3D | three.js, mit fester Version eingebunden (CDN oder als Kopie im Repo) |
| Einbettung | per `<iframe>` auf www.sembla.de/produkt |
| Sprache | Deutsch (Englisch später optional) |
| Daten | keine Speicherung, keine Cookies, kein Tracking im Konfigurator selbst |

**Anforderungen aus der iframe-Einbettung**

- Das Layout ist responsiv ab 320 px Breite. Die Bedienung muss mit Touch funktionieren.
- Die Seite meldet ihre Höhe per `postMessage` an die Elternseite, damit der iframe ohne eigenen Scrollbalken mitwächst. Dafür braucht es ein kleines Snippet auf sembla.de.
- Der Hintergrund ist neutral (#FDFDFD), ohne eigenen Header oder Footer. Eine kompakte Variante wird über einen URL-Parameter gesteuert (z. B. `?compact=1`).
- Der CTA-Link öffnet das Projektformular von sembla.de im Elternfenster (`target="_top"`).
- Ohne WebGL gibt es eine 2D-Ansicht als Rückfall.
- Die Ladezeit bleibt klein: three.js plus eigener Code unter etwa 1 MB, keine großen Modelle.

## 3 · Corporate Identity (aus sembla.de/produkt)

| Element | Wert |
|---|---|
| Akzent / CTA | Grün **#1FAA5F**, Pill-Buttons (border-radius 999 px), Text dunkel |
| Text | #1E1E1E (Hauptfarbe), #929292 / #5E5E5E (sekundär) |
| Hintergrund | #FDFDFD, Flächen #F4F4F2, Linien #D6D6D5 |
| Schriften | Fließtext **TT Interphases Pro** („TTRegular“), Display-Überschriften **Rational**, kleine Labels in Monospace **Maison** |
| Stil | viel Weißraum, große Headlines in Versalien, kleine Mono-Labels als Kicker („Revolutionär“, „Modular“) |

**Logo:** Polycare-Wortmarke mit Dach-Symbol (Dach über Balken), einfarbig #1E1E1E. **Offen:** Wir brauchen die Datei als SVG im Repo (`assets/polycare-logo.svg`).

Die Schriften sind lizenzpflichtig und dürfen nicht ohne Weiteres ins öffentliche Repo. **Offen:** Dürfen wir sie aus dem Webfont-Paket von sembla.de nutzen? Sonst nehmen wir einen Systemschrift-Fallback.

Botschaften von der Website, die der Konfigurator aufgreifen kann: 12,5-cm-Raster und Baurichtmaß, „Bauen ohne Mörtel“, Rw 47 dB, EI 60 (Website-Text nennt auch F60), 167 kg/m², 12,5 cm Wandstärke, Trennwände bis 5 m Höhe, bis Gebäudeklasse 4, Geopolymerbeton mit bis zu 70 % weniger CO₂, Fassade „Ökologisch: Holz & Holzfaser“ oder „Klassisch: Metall & Steinwolle“.

## 4 · Fachliche Regeln (Quelle: Planning-Suite, Handbuch Kap. 2 und 16)

Der Konfigurator vereinfacht, darf aber **keiner Systemregel widersprechen**. Die verbindliche Quelle ist das Regelwerk der Planning-Suite (`doku/SEMBLA_Handbuch.docx`, Kap. 16).

**Raster und Steine**

- Längsraster `GRID` = 125 mm, Lagenhöhe `COURSE` = 200 mm, Wandstärke 125 mm.
- **i3** = 375 mm (3 Raster, 3 Kammern, 2 Nuten), der Regelstein, wird maximiert. **i2** = 250 mm (2 Raster), nur zum Auffüllen an den Wandenden.
- Die Wandlänge ist ein Vielfaches von 125 mm. Segmentbreiten von 1 und 4 Raster sind nicht baubar (`FORBIDDEN_N`).
- Die Stoßfugen benachbarter Lagen sind um mindestens 1 Raster versetzt.
- Die Höhe wird in 200-mm-Lagen zerlegt, optional mit **einer** oberen Ausgleichslage für die Resthöhe ([G-2], [G-13], [G-14]). Der Konfigurator nutzt seit 06.11.2026 nur volle Lagen (Kap. 19).
- Öffnungen (Tür, Fenster, Durchbruch) lassen Steine aus; der Sturz darüber wird aufgefüllt.

**Vorspannung**

- Spannachsen liegen in den Kammern bei x = 62,5 + 125·k mm, höchstens alle 3 Raster (375 mm).
- Die Verteilung folgt [V-1] bis [V-12]: Grundachsen aus der obersten Lage, jeder Stein jeder Lage wird von einer Achse durchlaufen, Zusatzachsen an Öffnungs- und Stufenkanten, Symmetrie der i3 in der obersten Lage.
- Gewindestangen M10 (Standard 1100 mm) mit Kopplungsmuttern. Am Fuß liegen ein Bodenblech (125 × 10 mm, aus Standardlängen) und Ausgleichsbleche. Oben sitzt ein Kopfblech oder je Strang eine Spannplatte mit Spannmutter.

**Verbinder und Unterkonstruktion ([U])**

- Verbinder sitzen nur auf innenliegenden Nuten (12,5·k cm) und in Steinmitte (10 + 20·k cm), nie in Stoß- oder Lagerfugen ([U-3], [U-4], [U-11]).
- Typen: **FA** für die Fassade, **IA** für den Innenausbau. Katalogwerte: FA-1 R_k 0,50 kN, FA-2 schwer 0,80, IA-1 leicht 0,25, Universal 0,50, jeweils γ_M = 2,0.
- Latten verlaufen vertikal auf den Verbinderachsen. Das Standard-Panelraster ist 62,5 × 150 cm. Jedes Lattensegment bekommt oben und unten einen Verbinder ([U-12]).

**Technischer Hinweis:** `docs/shared/sembla-core.js` der Planning-Suite ist ein eigenständiges ES-Modul ohne Abhängigkeiten (`buildWall(...)` liefert Verband, Spannachsen und Stückliste). Wir sollten es **übernehmen statt nachbauen**. Dann rechnet der Konfigurator exakt wie die Suite. Noch zu klären: kopieren mit Versionsvermerk oder direkt von der Suite-URL laden.

## 5 · Musteraufbau Fassade und Innen (aus dem Demowand-Mock-up v17)

Schichtaufbau „Variante 2c“, von außen nach innen:

| # | Schicht | Maß |
|---|---|---|
| 1 | Keramik-Schindel 445 × 215 × 35, Deckung 150 mm, 2 Spenglerschrauben V2A 4,5 × 55 je Platte | ≈ 70 |
| 2 | Traglattung 30 × 50, Abstand 150 | 30 |
| 3 | Konterlatte 30 × 50 auf den KVH-Achsen (625er-Raster) | 30 |
| 4 | Holzfaserplatte 80 mm (winddicht, wasserableitend, ohne Fassadenbahn) | 80 |
| 5 | Dampfbremse s_d ≥ 2 m | – |
| 6 | Holzfaser-Dämmmatte WLS 036 zwischen den KVH | 60 |
| 7 | KVH 60 × 60 auf FA-Verbindern, Achsen im 625er-Raster | 60 |
| 8 | SEMBLA i2/i3, vorgespannt | 125 |
| 9 | Latte 38 × 58 flach auf IA-Verbindern (Installationsebene) | 38 |
| 10 | Lehmbauplatte 22 mm | 22 |

Gesamtdicke ≈ 460 mm, U ≈ 0,27 W/(m²K). Mit 100 mm Außendämmung (Referenz-Variante 2c) wären es U ≈ 0,22, und die 1,33-Regel wäre erfüllt.

**Im Mock-up neu festgelegte Regeln**

- **Schraubenlänge Konterlatte → KVH** = Latte + Dämmplatte + mindestens 50 mm Einbindung im KVH, wobei die Spitze ≥ 8 mm Abstand zum Stein hält (seit 03.11.2026: ≥ 4 mm, Kapitel 16). Beispiel: 30 + 80 + 50 → **Holzbauschraube 6 × 160**. Mit 6 × 180 käme die Spitze an den Stein. Nicht auf Höhe der Verbinder schrauben.
- **Verbinderschrauben:** Maschinenschrauben **M6 × 75** für FA durch das KVH, **M6 × 45** für IA durch die Latte (nicht ins Holz geschraubt).
- Traglatten auf Konterlatten mit Holzbauschrauben 5 × 80. Lehmbauplatten mit Schnellbauschrauben 3,9 × 55 und Unterlegscheibe.
- Ein **Fußauflager** unter den Konterlatten wird empfohlen. Ohne Fußauflager reicht die Verbinder-Tragfähigkeit draußen nicht (126 % Ausnutzung).
- Größter Lattenabstand innen ≤ 625 mm. Der Stoß der Lehmplatten liegt auf einer Latte (≥ 29 mm Auflage je Rand).
- Offen: Passt der IA-Verbinder an die breite Seite der flach gelegten Latte?

Für den Konfigurator heißt das: Die Schraubenlängen werden **aus dem gewählten Schichtaufbau berechnet** und angezeigt. Das ist ein gutes Beispiel für „regelbasiert“.

## 6 · Bewertung des Prototyps (Kollege, „SEMBLA® Wandplaner · Arbeitsmodell“)

**Was gut ist und übernommen werden sollte**

- Eine Seite, links die Eingaben (Länge, lichte Raumhöhe, Tür ja/nein und Position), rechts die Vorschau.
- Umschalter **3D-Modell / Ansicht (2D)**, Kameraknöpfe Vorne / Schräg / Rückseite.
- **„Rückbau“-Regler**: Die Wand fällt Schritt für Schritt auseinander (Fassade lösen → Vorspannung lösen → Steine abheben). Das ist der stärkste Moment für die zirkuläre Botschaft.
- Schicht-Chips (Bausteine, Spannsystem, Fassade, Innenausbau) und ein Regler zum Auffächern.
- Ergebniskacheln: Lagen, Steine i2/i3, Fläche, **Nutzflächengewinn gegenüber 17,5 / 24 / 30 cm**, Spannachsen, Restfuge zur Decke.
- CI ist bereits gut getroffen (Grün #1FAA5F, Pills, TT Interphases).

**Was fehlt oder korrigiert werden muss**

- Der Steinverband und die Spannachsen sind **eigene Vereinfachungen** (Achse „jede 3. Rasterachse“, eigene Füllregel) und weichen von [V-*] und [G-*] ab. → Rechenkern der Suite verwenden.
- Es gibt nur eine Tür in fester Größe, kein Fenster, keine Ausgleichslage.
- Es gibt nur **einen** Fassadenaufbau (Demowand). Auswahl verschiedener Fassaden und UK-Systeme fehlt.
- Verbinder sitzen pauschal alle 400 mm, nicht nach [U-3], [U-4] und [U-11].
- Die 3D-Steine kommen aus einer Bauteildatei der Demowand. → Prüfen, ob die Geometrie öffentlich sein darf. Sonst vereinfachte Körper verwenden.
- Es gibt keine iframe-Höhenanpassung und keine Kompaktvariante.

## 7 · Funktionsumfang

### MVP (Version 1)

1. **Wand:** Länge (1–12 m im 12,5-cm-Raster), Höhe (2,40–5,00 m), Öffnung: keine / Tür / Fenster mit Position.
2. **Live-Vorschau** 3D und 2D: Steinverband i2/i3, Spannachsen, Boden- und Kopfanschluss.
3. **Aufbau wählen:**
   - Innen: roh (Sichtmauerwerk mit Nut-Raster) / Trockenbau / Lehmbauplatte
   - Außen: ohne / 2–4 Fassadenvarianten (siehe Kap. 8), jeweils mit passender UK (Holz oder Alu)
4. **Rückbau-Animation** mit erklärenden Schritten.
5. **Kennzahlen:** Steine, Lagen, Spannachsen, Verbinder FA/IA, Fläche, Nutzflächengewinn, Wanddicke gesamt, Gewicht der Wand, Schallschutz und Brandschutz der Rohwand.
6. **Regeln sichtbar machen:** kleine „Warum?“-Hinweise, z. B. „Verbinder nur in Nuten, nie in Fugen“ oder „Schraube 6 × 160, weil 30 + 80 + 50 mm“.
7. **CTA** zum Projektformular, dazu der Hinweis „Vorplanung zur Orientierung, ersetzt keine Statik“.

### Später (optional)

- Schichtaufbau mit U-Wert-Schätzung
- Teilen-Link mit der Konfiguration in der URL
- PDF/PNG-Zusammenfassung
- Übergabe an die Planning-Suite (Wandelement-JSON exportieren)
- Englische Fassung

### Nicht im Umfang

Statik, Kosten und Preise, Bestellung, Benutzerkonten.

## 8 · Fassaden- und UK-Systeme

Stand der Desk-Recherche vom 02.11.2026. Herstellerangaben vor der Veröffentlichung prüfen. **[A]** markiert eine Einschätzung ohne Quelle.

**Grundprinzip:** Wir zeigen die vorgehängte hinterlüftete Fassade (VHF), weil sie sortenrein trennbar und mechanisch lösbar ist. Geklebte Systeme kommen nicht in Frage. Genietete Platten sind nur eingeschränkt rückbaubar.

**Kritischer Punkt für alle Systeme:** Für Geopolymerbeton gibt es keine Dübelzulassung [A]. Bei SEMBLA übernehmen die **FA-Verbinder in den Nuten** diese Rolle. Jede UK muss deshalb auf die Verbinderpunkte (125er-Nutraster, Steinmitte) gesetzt werden. Das ist ein starkes Verkaufsargument: Es wird nicht gebohrt, und die Wand bleibt unbeschädigt.

### Unterkonstruktion

| UK | Hersteller / Linie | Eignung |
|---|---|---|
| **Holz-UK** (KVH + Konterlattung) | wie im Mock-up | ökologisch, günstig, für leichte bis mittlere Bekleidungen; passt zur Website-Variante „Holz & Holzfaser“ |
| **Alu-UK** | Systemhersteller mit verdeckter Befestigung, Klammersystem für Terrakotta und Wandhaltern mit Thermostopp | für alle Bekleidungen; passt zur Website-Variante „Metall & Steinwolle“ |
| Alternativen | weitere Alu-UK-Systeme mit allgemeiner bauaufsichtlicher Zulassung | herstellerneutral ausschreiben |

### Bekleidungen (Kandidaten)

| System | Material | Gewicht | Befestigung | Rückbau |
|---|---|---|---|---|
| **Keramik-Schindel** | Keramik-Schindel 445 × 215 × 35 | ≈ 36 kg/m² (aus Mock-up: 18 Stk ≈ 96 kg) [A] | 2 Edelstahlschrauben je Platte auf Traglatte | sehr gut, schon im Mock-up gebaut |
| **Holz-Rhombusleiste** (Lärche / Thermoholz) | Holz | ≈ 8–12 kg/m² [A] | verdeckte Clips oder geschraubt | sehr gut |
| **Terrakotta-Paneel** | Ziegel | 31–42 kg/m² | Klammern auf Alu-UK | sehr gut, einzeln tauschbar |
| **Faserzement-Großformatplatte** | Faserzement | 15–19 kg/m² | verdeckt mit Hinterschnittanker oder genietet | gut, sortenrein |
| **Aluminium-Paneel** | Aluminium | 2,5–4,3 kg/m² | verdeckt, Falz und Haften | sehr gut, voll recycelbar |
| **HPL-Platte** | HPL | 8–18 kg/m² | verdeckt mit Agraffen | gut |
| Keramik-Paneel | Keramik | ≈ 32 kg/m² | Klammern | sehr gut |
| Titanzink-Stulppaneel | Zink | ≈ 7 kg/m² [A] | verdeckt | sehr gut |

### Vorschlag für den Konfigurator (4 Varianten, optisch klar unterscheidbar)

1. **Keramik-Schindel auf Holz-UK + Holzfaser**: Referenz aus der Demowand, ökologisch.
2. **Holzleiste (Rhombus) auf Holz-UK + Holzfaser**: das Kreislauf-Leitbild, leicht.
3. **Terrakotta-Paneel auf Alu-UK + Mineralwolle**: hochwertig, mineralisch, klassisch.
4. **Faserzement- oder Metallpaneel auf Alu-UK + Mineralwolle**: großformatig und ruhig.

Je Variante zeigen wir: Schichtfolge, Gesamtdicke, Flächengewicht, Verbinder je m², Schraubenlänge und den Hinweis „lösbar verbunden“. Herstellernamen erscheinen nur nach Freigabe; sonst nennen wir allgemeine Materialbezeichnungen.

Quellen: Herstellerunterlagen und Zulassungen der jeweiligen Systeme (Liste intern).

## 9 · Entscheidungen (02.11.2026)

- **Steingeometrie:** Eine vereinfachte Geometrie (geglättetes OBJ) darf öffentlich ins Repo.
- **Herstellernamen:** werden vorerst nicht genannt. Wir zeigen nur Materialbezeichnungen, z. B. „Keramik-Schindel“ oder „Alu-UK“.
- **Fassaden-Anfrage:** Planer:innen können ihr Fassadensystem bei Polycare anfragen. Nach der Prüfung wird es als neue Variante eingebunden. Die Varianten liegen deshalb als **Datendatei** vor (`data/fassaden.json`), damit eine neue Variante ohne Programmierung ergänzt werden kann.
- **Brandschutz:** Angezeigt wird vorerst **F60**.
- **Schriften:** sind lizenziert. Offen ist noch, ob die Lizenz die Nutzung auf der Domain des Konfigurators abdeckt (siehe Fragen).
- **Rechenkern:** `sembla-core.js` wird ins Repo kopiert und automatisch aktuell gehalten:
  - Eine GitHub Action läuft täglich und auf Knopfdruck. Sie holt die aktuelle Fassung von der Suite und vergleicht sie mit der Kopie.
  - Gibt es eine Änderung, laufen die Tests des Konfigurators (Referenzwände: Steinzahl, Achsen, Verbinder).
  - Sind die Tests grün, wird die neue Fassung automatisch übernommen und veröffentlicht. Sind sie rot, bleibt die alte Fassung live, und es wird ein Issue mit dem Unterschied angelegt.
  - Die Datei trägt einen Vermerk mit Quelle, Datum und Prüfsumme.
  - Ein Live-Import von der Suite wäre technisch möglich (CORS ist offen), aber eine inkompatible Änderung dort würde den Konfigurator auf sembla.de sofort und unbemerkt kaputt machen.

### Annahmen im ersten Stand (mit dem Planungsteam prüfen)

- **Deckenfuge** 20 mm zwischen Wandkrone und Rohdecke.
- **Ausgleichslage** erst ab 60 mm Resthöhe. Darunter wird die Deckenfuge entsprechend größer (höchstens 79 mm), statt einen sehr flachen Sonderzuschnitt zu zeigen.
- **Öffnungen:** höchstens eine Tür (1,00 × 2,20 m) und bis zu acht Fenster (1,00 × 1,20 m, Brüstung 0,80 m). Neben und zwischen Öffnungen bleiben mindestens 25 cm Wand.
- **Verbinder und Latten** rechnet Modul 2 der Suite (`sembla-aufbau.js`, übernommen wie der Kern) mit seinen Standardwerten: Panel 62,5 × 150 cm, Achsabstand höchstens 62,5 cm, Reihenabstand höchstens 75 cm, Randüberstand 12,5 cm, Lattenlänge 3 m. Der Wert 62,5 cm kommt aus dem Achsraster der Fassadenvariante.
- **Alu-UK:** Die Wandhalter sitzen auf den FA-Verbindern. Ob der FA-Verbinder dafür geeignet ist, muss noch geprüft werden.

### Befund aus dem Rechenkern

Bei manchen Türpositionen meldet `buildWall` einen Versatzkonflikt in der Lage über dem Sturz, z. B. bei 6,00 m Wand und Tür ab Raster 20 (`versatz_violations` zwischen Lage 10 und 11). Der Konfigurator bietet diese Positionen nicht an. Für die Planungs-Suite ist das vermutlich ein eigenes Issue.

## 10 · Offene Fragen

1. ~~Schriften~~ **Geklärt:** Die Lizenz deckt eine Subdomain ab. Der Konfigurator wird unter **`konfigurator.sembla.de`** veröffentlicht. Dafür braucht es einen DNS-Eintrag `CNAME konfigurator → p0lycare.github.io` und die Custom Domain in den Pages-Einstellungen. Die Fonts lädt die Seite von sembla.de; die Agentur erlaubt dafür CORS für diese Subdomain.
   Ursprüngliche Frage: Deckt die Webfont-Lizenz eine weitere Domain ab? Viele Lizenzen sind an Domains gebunden, und Dateien in einem öffentlichen Repo kann jeder herunterladen. Vorschlag: eine eigene Subdomain wie `konfigurator.sembla.de`, die auf GitHub Pages zeigt. Die Fontdateien liegen dann nicht im Repo, sondern werden von sembla.de geladen (dafür braucht es dort CORS für die Fonts).
2. ~~iframe~~ **Geklärt:** sembla.de läuft auf Sanity und wird von einer Agentur gepflegt. Das Skript kann eingebaut werden. Wir liefern der Agentur ein fertiges Snippet: das iframe plus einen Listener, der die Höhe übernimmt und auf eine CTA-Nachricht reagiert.
3. **CTA:** Geklärt ist, dass der Button direkt zum Projektformular führt. „Jetzt Projekt starten“ auf sembla.de ist aber ein Button ohne eigene URL; vermutlich öffnet er ein Overlay. **Vorschlag:** Der Konfigurator schickt per `postMessage` die Nachricht „Formular öffnen“ samt Kurzfassung der Konfiguration, und das Snippet der Agentur öffnet damit das Formular. Die Agentur muss klären, ob die Kurzfassung in ein (verstecktes) Feld des Formulars übernommen werden kann.
4. ~~Fassaden-Anfrage~~ **Geklärt:** Die Anfrage läuft über dasselbe Projektformular wie der CTA. Der Konfigurator öffnet es per `postMessage` mit dem Vermerk „Fassadensystem anfragen“.
5. **Logo:** Wir brauchen die Polycare-Logodatei als SVG.
6. ~~Messung~~ **Geklärt:** Ja. Der Konfigurator meldet wenige Ereignisse per `postMessage` an sembla.de, z. B. Fassade gewählt, Rückbau angesehen, CTA geklickt. Das Snippet reicht sie an das bestehende Tracking weiter, sofern der Cookie-Consent es erlaubt. Der Konfigurator selbst bleibt cookiefrei.

## 11 · Wärmeschutz (ergänzt 02.11.2026)

- **Ziele (wählbar; seit 06.11.2026 ohne Bezug auf GEG/BEG im Konfigurator, Kap. 19):**
  - GEG/GModG Anlage 7: U ≤ 0,24 W/(m²K). Voreinstellung; im Neubau rechnet das Referenzgebäude mit 0,28.
  - BEG-Einzelmaßnahme Außenwand: U ≤ 0,20.
  - Effizienzhaus-40-Niveau: U ≤ 0,14. Das ist keine Bauteilanforderung, im Neubau gilt der Nachweis für das ganze Gebäude.
- **Rechnung:** DIN EN ISO 6946 als Mittel aus oberem und unterem Grenzwert. Hinterlüftete Fassade mit Rse = 0,13; Schichten vor der Hinterlüftung werden nicht angesetzt. Wandhalter gehen als punktförmige Wärmebrücken ein (χ je Halter × tatsächliche Halter je m²).
- **Auslegung:** Je Fassade wird die dünnste Dämmstufe gewählt, die das Ziel und den Tauwasserschutz erfüllt (`daemmstufen` in `data/aufbauten.json`, bei Holz-UK mit `aussen` für die Holzfaserplatte).
  - Holz-UK: KVH-Tiefe gleich Gefachdämmung.
  - Alu-UK: Mineralwolle; Halter sind 40 mm länger als die Dämmung.
- **Annahmen, zu ersetzen durch Messwerte:**
  - Stein: R = 0,10 m²K/W (Geopolymerbeton λ ≈ 1,25 W/(m·K), Kammern vernachlässigt).
  - Alu-Halter mit Thermostopp: χ = 0,015 W/K, ein Halter je FA-Verbinder.
  - λ-Werte: Holzfaser flexibel 0,038, Holzfaser-Unterdeckplatte 0,042, Mineralwolle 0,035, KVH 0,13, Lehmbauplatte 0,35, Gipsfaser 0,32.
- **Befund:** Bei Alu-UK bestimmen die Halter den U-Wert. Ein Halter je FA-Verbinder ergibt 2,7 bis 6,7 Halter je m², und mit Öffnungen werden GEG und BEG dann nur mit sehr dicker Dämmung oder gar nicht erreicht. Eine Alu-UK braucht ein eigenes, weiteres Halterraster.
- **Tauwasserschutz nach DIN 4108-3 (ergänzt 02.11.2026):**
  - **Luftdichte Ebene:** Die Steinfugen sind nicht luftdicht.
    - Bei Holz-UK liegt die Dampfbremse zwischen Gefachdämmung und Holzfaserplatte (Einbau nach der Gefachdämmung, die Nuten für die Verbinder bleiben frei).
    - Ohne luftdichte Innenseite ist sie die luftdichte Ebene und muss im Tauperiodenklima wärmer als der Taupunkt der Raumluft bleiben (20 °C / 50 % → 9,3 °C). Daraus folgt R außen / R innen ≥ 1,33 bei −5 °C; die bisherige Faustregel 1,5 enthält etwa 0,7 K Reserve.
    - Mit verputzter Innenseite (Lehm- oder Gipsputz, Stöße überputzt) ist der Putz die luftdichte Ebene. Dann entscheidet allein der Glaser-Nachweis.
  - **Glaser-Verfahren:** Periodenbilanz im Gefachschnitt bis zur Hinterlüftung.
    - Klima: Tauperiode 20 °C / 50 % innen, −5 °C / 80 % außen, Verdunstung 1200 Pa beidseitig, 1700 Pa in der Tauwasserebene, je 2160 h.
    - Grenzwerte: 1,0 kg/m², an nicht saugfähigen Schichten 0,5 kg/m², vollständige Verdunstung.
    - Die Werte stehen in `waerme.feuchte` und sind gegen DIN 4108-3:2018-10 zu prüfen.
  - **Auslegung:** Gefachdämmung und Holzfaserplatte werden gemeinsam gewählt: die dünnste Kombination, die U-Ziel und Tauwasserschutz erfüllt und eine Handelslänge der Fassadenschraube zulässt. Beispiel Schindel, Lehmbauplatte, GEG: 60 + 120 mm statt bisher 120 + 80 mm. Der alte Aufbau hätte 3,6 °C an der Bahn gehabt.
  - **Annahmen:**
    - μ-Werte: Stein 15 (Fugen berücksichtigt, Messwert fehlt), Holzfaser 5, Mineralwolle 1, Lehm 8, Gipsfaser 13, Gipsputz 10.
    - Dampfbremse sd = 5 m (feuchtevariable Bahnen im Winter).
  - **Befund:** Alu-UK ohne verputzte Innenseite hat keine luftdichte Ebene. Bei verputzter Innenseite führt die Dampfbremse (sd 5 m) zu etwas Tauwasser an der Bahn, das wieder austrocknet; eine diffusionsoffenere Bahn wäre dort günstiger.

## 12 · Nachschärfung (03.11.2026)

- **Wärmeschutz-Ziel:** fest auf U ≤ 0,20, keine Auswahl mehr in der Übersicht; alte Links mit `w=` gelten weiter. (Die Gegenüberstellung GEG/BEG/EH40 im Reiter „Wärmeschutz“ ist seit 06.11.2026 entfallen, Kap. 19.)
- **Bauphysikalische Grundwerte:**
  - Stein: λB = 0,74 W/(m·K) (DIN 4108-4, Betonsteine), R = 0,17 m²K/W.
  - Dampfbremse: sd = 2 m. Bei R außen ≈ 1,33 × R innen ist die Konstruktion funktionsfähig; wir planen mit 1,5 als Reserve.
  - Die Schraubdurchdringungen der Bahn gelten nach DIN 4108-7, 6.1.2 als ausreichend luftdicht.
- **DIN 4108-3:2018 gegen den Normtext geprüft:**
  - Klima nach Tabelle A.3; Rsi 0,25 / Rse 0,04.
  - δ0 = 2·10⁻¹⁰ kg/(m·s·Pa).
  - 0,5 kg/m² auch an Mineralwolle.
  - Holzfeuchte: Holzfaser vorsichtig wie ein Holzwerkstoff mit +3 % angesetzt.
- **Schrauben durch die Holzfaserplatte:** gehen nach DIN EN ISO 6946 Anhang F in den U-Wert ein (Stahl, Ø 6 mm, alle 30 cm je Konterlatte).
- **Gewindestangen:** wie im Standardkatalog der Suite, 1050 mm mit Spannstück 100 mm; zusätzlich 600 mm als zweite Länge.
  - **Empfehlung an das Suite-Team:** 600 mm als Standardlänge aufnehmen. Damit sinken die Fälle mit Zuschnitt unter 200 mm deutlich (Auswertung über 3072 Wände: 717 → 124).
  - Verbleibende Zuschnitt- und Kopplungskonflikte zeigt der Konfigurator als Hinweis.
  - Mindesthöhe 2,50 m.
- **Platzgewinn:** Verglichen wird mit Kalksandstein 17,5 cm und Stahlbeton 20 cm, jeweils mit derselben Fassade, demselben Ziel und Innenputz.
- **Datenblatt-Links:** Sie tragen den Rechenstand (`v`) und die gewählten Dämmstärken (`dd`, `da`). Ändert sich die Rechnung, bleiben die Stärken erhalten und das Datenblatt weist darauf hin. Unbekannte Varianten fallen auf die Voreinstellung zurück.
- **Deploy:** Module, Daten und Stile bekommen je Veröffentlichung `?v=<Commit>`.

## 13 · Planungsdateien im Datenblatt (03.11.2026)

- **BIM (IFC4, `js/export-ifc.js`):**
  - Inhalt: eine `IfcWall` mit Achse und Volumenkörper, Schichtaufbau als `IfcMaterialLayerSet` von innen nach außen (Hinterlüftung als belüftete Schicht), Öffnungen als `IfcOpeningElement`.
  - Eigenschaften: `Pset_WallCommon` (IsExternal, U-Wert) und `SEMBLA_Konfiguration` (Steine, Lagen, Spannachsen, Verbinder, Aufbauten, Link zum Datenblatt).
  - Geprüft mit IfcOpenShell 0.8 (Schema- und Regelprüfung, Geometrie): alle 25 Kombinationen aus Fassade und Innenseite fehlerfrei.
- **CAD (DXF R12, `js/export-dxf.js`):**
  - Inhalt: Ansicht mit jedem Stein als Rechteck (Layer i3, i2, Ausgleich), Öffnungen, Spannachsen, Maßlinien, darunter ein Grundriss-Schnitt mit beschriftetem Schichtaufbau. Einheit mm.
  - Geprüft mit ezdxf (Audit ohne Fehler).
- **Ausschreibungstext (`js/export-lv.js`):** LV-Entwurf mit Vorbemerkungen und Positionen.
  - Rohwand: Fläche, je Öffnung, Deckenanschlüsse.
  - Fassade und Innenseite: je Bauteil der Stückliste.
  - Fabrikatsneutral außer dem Leitfabrikat SEMBLA, mit Feldern für EP und GP.
- **Ort:** Die Downloads liegen nur im Datenblatt, also hinter dem Kontaktformular. Sie erscheinen nicht im Druck.

## 14 · Holz-UK und Auswahl (03.11.2026)

- **Auswahl:** Angeboten werden nur freigegebene Varianten (`freigegeben` in `data/aufbauten.json`).
  - Fassade: Ohne Fassade, Keramik-Schindel und Holzleisten (beide auf Holz-UK). Stand 06.11.2026 siehe Kap. 19.
  - Innenseite: Sichtmauerwerk und Trockenbau verputzt (Voreinstellung).
  - Die Alu-UK-Fassaden und die übrigen Innenseiten bleiben für ältere Links rechenbar und werden freigegeben, wenn sie stimmig sind.
- **Latten:** Sie laufen bis zur Wandkrone, zum Wandfuß bzw. zur Öffnungskante.
  - Modul 2 der Suite ließ eine Latte an der letzten Lage enden, deren Nut die Achse führt ([U-8]). Darüber fehlte der Bekleidung bis zu 20 cm die Unterkonstruktion.
  - Überstände bis 40 cm ohne Verbinder werden geschlossen; befestigt wird weiter nur an den Verbindern aus Modul 2.
  - Empfehlung an das Suite-Team: [U-8] entsprechend anpassen.
- **Traglatten:** zusätzlich eine Latte bündig an der Wandkrone, wenn darüber sonst mehr als 2 cm frei blieben.
- **Fassadenachsen:** Außen ist die Holzfaserplatte durchlaufend. Deshalb setzt Modul 2 dort nur die Endachsen (12,5 cm vom Rand) und die Achsen an den Öffnungen und verteilt dazwischen gleichmäßig, höchstens 62,5 cm. Bei 6 m Wand gibt es kein 25-cm-Restfeld mehr. Innen bleibt das 62,5-Raster wegen der Plattenstöße.
- **Kennzahlen:** Schall- und Brandschutz der Rohwand stehen nicht mehr unter der Ansicht.

## 15 · Dämmstoffe der Holz-UK (03.11.2026)

- **Entscheidung:** Mineralwolle WLS 032 im Gefach (μ = 1, kapillar nicht wasseraufnahmefähig), Holzfaserplatte WLS 040 außen (winddicht, μ = 3, ρ = 160 kg/m³).
  - Ergebnis: 20 mm dünner bei beiden Innenseiten, kreislauffähig, Mineralwolle im Gefach.
  - Rechenstand im Datenblatt-Link: `v=3`.
- **Untersuchte Kombinationen (Schindel, BEG U ≤ 0,20, Wanddicke innen verputzt / Sichtmauerwerk):**
  - heute (Holzfaser flexibel WLS 038 + Holzfaserplatte WLS 042): 482 / 441 mm
  - Mineralwolle WLS 032 + Holzfaserplatte WLS 040: 462 / 421 mm (gewählt)
  - Holzfaser flexibel WLS 038 + Mineralwolle druckfest WLS 032: 463 / 422 mm
  - Mineralwolle WLS 032 + Mineralwolle druckfest WLS 032: 463 / 442 mm
  - Holzfaser flexibel WLS 036 + Holzfaserplatte WLS 040: 482 / 441 mm (keine Stufe gespart)
  - Mineralwolle WLS 032 + PIR vlieskaschiert WLS 026: 442 / 381 mm; verworfen wegen Rückbau und geringem Trocknungspotenzial (sd innen und außen > 2 m, DIN 4108-3)
- **Befund:** Die Dämmung macht nur rund 200 von 480 mm aus. Fest sind Stein 125 mm, Lattung und Schindel 95 mm und die verputzte Innenseite 60 mm. Die 20-mm-Stufen der Platten bestimmen, ob sich ein besserer Dämmstoff lohnt. Die 1,5-Regel kostet keine Dicke gegenüber 1,33, sie verteilt nur um.
- **Zu prüfen:** Verfügbarkeit von Mineralwolle WLS 032 als Klemmfilz und von Holzfaserplatten WLS 040 in 40–220 mm.
- **Lattung (03.11.2026):** Die Traglatte (nur bei der Schindel-Fassade) ist jetzt 24 × 48 mm statt 30 × 50 mm; das spart 6 mm, Voreinstellung 456 mm.
  - Die Konterlatte ist seit Rechenstand 4 ebenfalls 24 mm, siehe Kapitel 16.

## 16 · Schraube, KVH und verputzte Innenseite (03.11.2026, Rechenstand `v=4`)

- **Schraubenspitze:** mindestens 4 mm vor dem Stein (bisher 8 mm), so entschieden am 03.11.2026.
  - Damit passt bei jeder Kombination aus Gefach und Holzfaserplatte eine Handelslänge (20-mm-Schritte), auch beim KVH 60.
  - Fenster der Schraubenlänge beim KVH 60: Konterlatte + Platte + 50 bis + 56 mm.
- **Konterlatte 24 × 50 mm** statt 30 × 50; Hinterlüftung 24 mm (Mindestmaß 20 mm). Spart 6 mm.
- **Dickere KVH geprüft, verworfen** (Schindel, BEG U ≤ 0,20, Konterlatte 24):

  | Variante | Sichtmauerwerk | verputzt |
  |---|---|---|
  | KVH 60 breit, ab 60 tief (gewählt) | 409 mm | 449,5 mm (vor den Änderungen unten) |
  | KVH ab 80 tief | 469 mm | 449,5 mm |
  | KVH 80 breit | 429 mm | 469,5 mm |

  - Ein tieferes KVH zwingt bei Sichtmauerwerk wegen der 1,5-Regel auch die Holzfaserplatte dicker.
  - Ein breiteres KVH ist eine größere Wärmebrücke im Gefach.
  - Mit 4 mm Spitzenabstand wird beides für die Schraube nicht mehr gebraucht.
- **Verputzte Innenseite ohne Dampfbremse:**
  - Bei luftdichter Innenseite (`luftdicht: true`) entfällt die Schicht mit `nur_ohne_luftdichte_innenseite` (die Dampfbremse in der Holz-UK).
  - Grund: Mit Putz liegt die Bahn bei R außen / R innen = 0,35 auf der kalten Seite. Glaser nach DIN 4108-3 ergibt mit Bahn 0,075 kg/m² Tauwasser an der Bahn, ohne Bahn keines.
  - Den Dampf bremst der Stein (μ 15, sd ≈ 1,9 m). Die luftdichte Ebene ist der Putz.
  - Bei Sichtmauerwerk bleibt die Bahn als luftdichte Ebene mit der 1,5-Regel.
- **Gedämmte Installationsebene:** Mineralwolle WLS 032, 38 mm, zwischen den Latten von Trockenbau verputzt.
  - Ergebnis: Gefach 100 statt 120 mm, U 0,186 statt 0,199.
  - Die Steininnenseite bleibt mit rund 14 °C über dem Taupunkt (9,3 °C); Glaser ohne Tauwasser.
  - Leitungen und Hohlwanddosen liegen in der Dämmung. Die Dosen müssen luftdicht sein (Putz als luftdichte Ebene).
- **Ergebnis Voreinstellung** (Schindel, Trockenbau verputzt, BEG): **428,5 mm** statt 455,5 mm, U 0,186, Dämmung 100 + 60 mm, Schraube 6 × 140. Sichtmauerwerk: 409 mm statt 415 mm.
- **Weitere Option, nicht umgesetzt:** Installationsebene 27 statt 38 mm spart weitere 11 mm, verlangt aber flache Hohlwanddosen. Entscheidung beim Planungsteam.
- **Holzfaserplatte 40 mm** geprüft: bringt keine dünnere Wand, nur eine andere Aufteilung.

## 17 · Verbinder: Bemessung und Lage (03.11.2026, Rechenstand `v=5`)

Die Bemessung gehört in die SEMBLA Planning Suite. Der Konfigurator rechnet eine Vorbemessung mit festen Bemessungswerten (`verbinder` in `data/aufbauten.json`), die Herleitung steht in der Suite.

- **Bemessungswerte je Verbinder** (Steinmitte, FA vorerst wie IA): Zug 0,6 kN, Querlast entlang der Nut 0,3 kN, quer zur Nut 1,8 kN.
- **Geometrie (bestätigt):** Die Nuten laufen senkrecht, das Eigengewicht wirkt entlang der Nut. Verbinder sitzen immer auf halber Steinhöhe.
- **Wirkweise (bestätigt 03.11.2026):** Auf Zug hält der Verbinder formschlüssig in der Nut. Entlang der Nut hält er nur über Klemmung, und die Schraube zum KVH bzw. zur Latte spannt ihn mit. Holz schwindet nach dem Einbau (KVH 15 % → 10–12 % Holzfeuchte, etwa 0,7 mm auf 60 mm), die elastische Vorspannung beträgt nur einige hundertstel Millimeter. Die Klemmung entlang der Nut ist damit nicht dauerhaft. **Deshalb trägt immer ein Auflager das Eigengewicht:** außen Fußauflager und Auflager über Öffnungen für alle Holz-UK-Fassaden, innen eine Schwelle am Boden und Riegel über Öffnungen. Die Verbinder tragen nur Zug.
- **Lasten:**
  - Windsog außen: Windzone 2 Binnenland, Gebäude bis 10 m (q_p = 0,65 kN/m²), Bereich A an der Gebäudeecke, c_pe,1 = −1,4, γQ = 1,5, voll auf die Unterkonstruktion.
  - Eigengewicht: aus `flaechengewicht_kg_m2` je Fassade und Innenseite, γG = 1,35.
  - Ausmitte des Eigengewichts: Zug in den Verbindern, linear zum Abstand vom Fußpunkt des Lattenstrangs.
  - Einflussfläche je Verbinder aus seiner Lage.
  - Zug und Querlast zusammen: (N/N_Rd)^1,5 + (V/V_Rd)^1,5 ≤ 1.
- **Ergebnisse:**
  - **Fußauflager ist Pflicht** für alle Holz-UK-Fassaden. Rechnerisch ginge die Holzleiste mit den Versuchswerten auch ohne, das setzt aber eine dauerhafte Klemmung voraus (siehe Wirkweise).
  - **Innen:** Die Latten stehen auf einer Schwelle; die Innenverbinder tragen nur Zug aus der Ausmitte (Ausnutzung wenige Prozent).
  - **Auflager über Öffnungen:** Winkel am Sturz oder Wechsel zur Nachbarachse; sonst hängen die Lattenstränge über Öffnungen an zu wenigen Verbindern.
  - **Lücken auf den Achsen:** Modul 2 lässt Positionen in Stoßfugen aus, dadurch entstehen Lücken bis 2,8 m. Der Konfigurator prüft jeden Verbinder und setzt auf überlasteten Achsen zusätzliche Verbinder in freie Nuten (Steinmitte, im Stein, auf der Latte), bis alle halten. Standardwand 6 × 2,85 m: +6 außen.
  - **Reichweite:** Windzone 2 bis 10 m Höhe, auch an der Gebäudeecke. Für höhere Windlasten dichtere Reihen oder ein tragfähigerer FA-Verbinder.
- **Nicht betrachtet:** Konsollasten innen (gehen entlang der Nut in die Verbinder, brauchen eigene Auflager oder Tragplatten), Anprall, Erdbeben, Brandfall.
- **Montage:** KVH mit höchstens 15 % Holzfeuchte, trocken lagern; erst Auflager bzw. Schwelle setzen, Holz daraufstellen, dann verschrauben; Verbinder mit Drehmomentschrauber (Moment aus den Versuchen); Schrauben vor dem Schließen nachziehen; Unterlage unter dem Schraubenkopf im Holz ≥ 20 mm.
- **An das Suite-Team (Modul 2):** Reihenabstand aus dem Nachweis ableiten und gesperrte Positionen auf die nächste freie Lage verschieben (Todoist [P] SEMBLA Suite).

**Weitere Änderungen in diesem Stand:**
- Installationsebene innen 27 mm (Latte 27 × 58, Mineralwolle WLS 035, 30 mm auf 27 mm geklemmt). Verbinderschraube innen M6 × 45 statt M6 × 55. Flache Hohlwanddosen.
- Stückliste und Ausschreibung: Fußauflager je Achse, Auflager über Öffnungen, Lüftungsprofil mit Insektenschutz (unten, oben, an Öffnungen; ≥ 50 cm²/m nach DIN 18516-1).

## 18 · Lieferbarkeit der Dämmstoffe (Recherche 03.11.2026)

Recherche in Herstellerdatenblättern, Markt Deutschland. Herstellernamen stehen nur in der internen Recherche, nicht im Konfigurator.

- **Holzfaserplatte „WLS 040“:** Die winddichten Platten für hinterlüftete Fassaden haben λD = 0,040, der Bemessungswert ist aber **λB = 0,042 W/(mK)**. Gerechnet wird jetzt mit 0,042 (DIN 4108-4). Bezeichnung im Konfigurator: „Holzfaserplatte λD 0,040“.
  - Lieferbar in 60–200 mm bei zwei Herstellern, Nut und Feder, ρ ≈ 140 kg/m³, μ 3–4, Klasse E. 40 mm nur bei einem Hersteller.
  - 220 mm gibt es nicht: die Stufe ist gestrichen (`daemmstufen.aussen` bis 200 mm).
- **Mineralwolle WLS 032 im Gefach** (λD 0,031, λB 0,032; Glaswolle, A1, μ 1):
  - Rolle 570 mm für 60-mm-Ständer in 80 und 120–200 mm. 100 mm nur als Platte 1250 × 575. 60 mm vorab bestätigen lassen.
  - 240 mm gibt es in Ständerbreite nicht, nur als zwei Lagen 120 mm.
  - WLS 035 ist in allen Dicken 60–240 mm bei mehreren Herstellern Lagerware (Glas- und Steinwolle).
- **Installationsebene 27 mm:** Mineralwolle in 27 mm gibt es nicht. Geplant ist 30 mm WLS 035, auf 27 mm geklemmt; gerechnet mit λ = 0,035.
- **Folge:** Voreinstellung (Schindel, Trockenbau verputzt, BEG) **437,5 mm**, Dämmung 120 + 60 mm, U 0,182. Sichtmauerwerk 429 mm (60 + 160 mm), U 0,188.

## 19 · Stand 06.11.2026: Fassaden, Höhe, Wärmeschutz, Bedienung

- **Fassaden (Feedback Felix 4.1/4.2):**
  - Neu: Keramik-Schindel und Holzleisten mit **einlagig gedämmter Holz-UK**: eine Dämmlage, Dampfbremse auf dem Stein, außen eine dünne Holzfaserplatte (Schindel) bzw. eine UV-stabile Fassadenbahn (Holzleisten mit offener Fuge).
  - Die **zweilagige Holzleiste** (offene Fuge, Holzfaserplatte ohne Fassadenbahn) ist zurückgezogen: Hinter der offenen Fuge liegt die Holzfaserplatte ungeschützt in UV-Licht und Schlagregen, und ohne Dampfbremse hat der Aufbau die geringste Feuchtereserve. Alte Links gehen über `ersatz` auf „Holzleisten einlagig“, das Datenblatt rechnet alte Links unverändert.
  - Angeboten: Ohne Fassade, Schindel zweilagig (Voreinstellung), Schindel einlagig, Holzleisten einlagig. Die zweilagige Schindel bleibt vorerst Voreinstellung.
- **Höhe nur in vollen Lagen:** Der Regler stellt die **Wandhöhe** von 2,40 bis 4,80 m in 20-cm-Schritten ein, ohne Ausgleichslage. Die Raumhöhe ist Wandhöhe plus Deckenfuge (20 mm). Ältere Links mit freier Raumhöhe werden im Konfigurator auf volle Lagen abgerundet. Titel, Zusammenfassung, IFC und LV nennen die Wandhöhe. Wie ein größerer Spalt zur Decke geschlossen wird, zeigt der Konfigurator vorerst nicht.
- **Wärmeschutz ohne Förderbezug:** Die Wand ist ein Neubauprodukt. GEG-Höchstwert und BEG-Einzelmaßnahme gelten für Änderungen im Bestand und werden nicht mehr genannt. Der U-Wert steht bei den Kennwerten; im Reiter „Wärmeschutz“ steht, auf welchen U-Wert die Dämmstärke ausgelegt ist und dass das Gebäude den energetischen Nachweis führt. Die Auslegung bleibt U ≤ 0,20.
- **Bedienung (Feedback Nico):**
  - Regler mit `aria-label` und `aria-valuetext`; der Hinweis „Ziehen zum Drehen“ verschwindet nach der ersten Bedienung.
  - Die Übersicht ist ruhiger, Details stehen im Datenblatt: 5 statt 8 Kennwerte, 3 statt 7 Punkte unter „So funktioniert's“, Stückliste eine Zeile je Gruppe, Rechenweg Wärmeschutz eingeklappt, Ansicht-Optionen unter „Mehr“, Aufbautexte in einem Satz.
  - Das Eingabe-Panel ist auf dem Desktop höchstens so hoch wie die Vorschau: knappere Abstände und Schriften, kurze Kartentitel (`karte`), Hinweise in der Reglerzeile. Von mehreren Öffnungen zeigt nur die gerade bearbeitete Regler und Maße, die anderen sind eine Zeile.
- **Kennwerte in Gruppen (Feedback Felix 5.1/B6):** Material (Steine, Spannachsen, Verbinder), Geometrie (Wandfläche, Wanddicke, Lagen), Bauphysik & Gewicht (U-Wert, Gewicht Rohwand), je Gruppe dezent farbig. In jeder Kachel steht die Bezeichnung über der Zahl, die Einheit direkt an der Zahl, die Erläuterung darunter. Der Konfigurator zeigt Steine, Wandfläche, Wanddicke, U-Wert und Gewicht, das Datenblatt alle.
- **Lieferumfang (Feedback Felix B23, B21):** Die Stückliste ist geteilt in „Lieferung Polycare“ (SEMBLA-Steine, Spannsystem, Boden- und Deckenanschluss mit Boden-, Ausgleichsblechen und Deckenwinkeln, Verbinder FA/IA mit M6-Schrauben) und „Bauseits, Richtwerte“ (Vergussmasse, Fassade samt Fußauflagern, Innenseite). Das Datenblatt nennt auf Seite 1 den Lieferumfang und dass die übrigen Schichten beispielhaft sind; die CSV hat eine Spalte „Lieferung“. Im LV stehen die Verbinder weiter bei Fassade bzw. Innenseite.
- **Bodenblech unter Türen ausgespart (Feedback Felix B4, Andreas 11.11.2026):** Der Konfigurator übergibt die Rasterfelder jeder Tür als manuelle Bodenblech-Aussparung an den Kern ([A-28]); links und rechts wird getrennt in Standardlängen zerlegt, Ausgleichspunkte und Vergussmasse folgen der belegten Länge. 3D, Zeichnung, Stückliste und LV zeigen die Lücke.
- **Begriff „Verbindernut“ (Feedback Felix B9, Andreas 11.11.2026):** Die senkrechten Nuten im Stein, in denen die Verbinder sitzen, heißen in allen Texten, Stückliste und LV „Verbindernut“. „Nut und Feder“ der Dämmplatten bleibt davon unberührt.
- **Wiederverwendbarkeit (Feedback Felix B15, Andreas 11.11.2026):** Angesetzt sind höchstens 10 % Ausschuss beim Rückbau, also mindestens 90 % wiederverwendbare Steine. Texte, Rückbau-Regler und LV sagen „mindestens 90 %“ statt „alle Steine“.
- **Vorschau (Feedback Felix 1.1–1.3):** Reiter „3D · Außenansicht · Innenansicht“. Die Innenansicht ist die gespiegelte Wand von der Raumseite mit den Verbindern innen (Beschriftung ungespiegelt). Breite Wände: Die 2D-Ansicht wird nie flacher als 200 px und scrollt dann seitlich in sich; der Knopf „Vollbild“ legt die Vorschau über das ganze Fenster (Esc schließt) und nutzt echtes Vollbild, wo der Browser es erlaubt (iframe mit `allow="fullscreen"`). Der Schnitt (1.4) folgt.
- **Wandschnitt (Feedback Felix 1.4/B5):** vierter Reiter „Schnitt“ und Abschnitt „Wandaufbau“ im Datenblatt (`js/schnitt2d.js`). Horizontalschnitt durch 1 m Regelwand in Wandmitte, innen oben, außen unten: Schichten in Materialfarbe, Ständer und Latten auf ihren echten Achsen, Hinterlüftung schraffiert, Verbinder grün in der Verbindernut, Gesamtdicke links. Nummern rechts, die Schichtliste mit Dicken steht darunter als Text.
- **Öffnungen bedienen (Feedback Felix 1.5–1.7):** „+ Tür“ / „+ Fenster“ stehen über der Liste. Neben dem Regler lässt sich die Position als Zahl eingeben („ab … m“, Komma oder Punkt, auf 12,5 cm gerundet). Rastet die zuletzt bewegte Öffnung wegen einer anderen Öffnung oder des Wandendes woandershin, nennt die Zeile den Grund und die gesetzte Lage, unter der Vorschau steht ein Hinweis, und 2D und 3D zeigen die gewünschte Lage als roten Kasten, bis eine passende Eingabe folgt. Bloßes Einrasten im Steinverband gilt nicht als Kollision.
- **Texte für Kunden und Planende (Feedback Felix B11, B19):** „Verbinder bemessen“ ist für Kunden ein Satz (Windsog mit Reserve, Gewicht auf Auflagern, Vorbemessung). Windzone, Gebäudehöhe, Ausnutzung, zusätzlich gesetzte Verbinder, Lastabtrag und Schrauben stehen im Datenblatt unter „Annahmen für die Planung“ (`planungHtml`). Die Einlegebleche sind erklärt: eines je Spannstrang etwa auf halber Höhe, es hält die Stange beim Aufmauern mittig (Regeltext und Stückliste).
- **Anschlüsse erklärt (Feedback Robert, Felix B20):** „So funktioniert's“ hat den Punkt „Angeschlossen, nicht eingespannt“, das Datenblatt den Absatz „Anschlüsse“: Bodenbleche mit Ausgleichsblechen und Vergussmasse, je Spannachse ein gleitendes Deckenwinkel-Set (Wandwinkel auf der Spannplatte, Deckenwinkel an der Rohdecke), seitlich Trennstreifen aus Mineralwolle, Ecken und Stöße mit weiteren SEMBLA-Wänden verzahnt (Planungsteam). Ohne Zahlen auf der Seite; Durchbiegung und Befestigung stehen als Platzhalter im LV. Bauseits in der Stückliste: Befestigungssatz an der Rohdecke je Deckenwinkel-Set und Trennstreifen an beiden Wandenden.
- **Rückbau auf Paletten, Kopfzeile (Feedback Felix 1.8/1.9, Andreas 12.11.2026):** Im letzten Schritt des Rückbau-Reglers wandern die Steine Lage für Lage von oben auf Europaletten an der Innenseite (je Palette 5 Lagen à 3 × 6 Steine), die Einlegebleche kommen mit ihrer Lage heraus, am Ende liegen nur die Bodenbleche. Die Kopfzeile über der Vorschau nennt nur die Maße; die Steinanzahl steht in der Kennwert-Kachel und in der Stückliste.
- **Datenblatt-Anfrage:** zwei getrennte Häkchen, Pflicht für das Datenblatt und freiwillig für den Kontaktwunsch; dieser steht in der Zusammenfassung an HubSpot (Details in `docs/HUBSPOT.md`).
- **Gespeicherte Konfiguration:** Die letzte Konfiguration bleibt im Browser (`localStorage`); ein Link mit Parametern hat Vorrang, „Zurücksetzen“ stellt die Voreinstellung her.
