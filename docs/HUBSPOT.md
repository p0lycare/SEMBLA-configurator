# Datenblatt gegen Kontaktdaten (HubSpot)

So läuft es ab:

1. Im Konfigurator klickt man auf „Ausführliches Datenblatt per E-Mail“ und gibt Name, E-Mail, Büro und die Einwilligung ein.
2. Der Konfigurator schickt die Angaben direkt an die Formular-Schnittstelle von HubSpot (`js/anfrage.js`, Portal 19508245). Dafür braucht es keinen Server und keinen Schlüssel.
3. Ein HubSpot-Workflow schickt die E-Mail mit dem Link zum Datenblatt und benachrichtigt den Vertrieb.
4. Das Datenblatt (`datenblatt.html?l=…`) zeigt die Konfiguration druckfertig, mit Ansicht, Kennwerten, Regeln, Wärmeschutz und vollständiger Stückliste. „Als PDF speichern“ nutzt den Druckdialog des Browsers.

Solange in `js/anfrage.js` kein `formGuid` eingetragen ist, öffnet der Knopf stattdessen das Projektformular auf sembla.de. Der Datenblatt-Link steht dann in der Zusammenfassung.

> **Hinweis:** Das Datenblatt selbst ist nicht geschützt. Wer den Link kennt, kann es öffnen. Die Sperre ist bewusst weich: Der Link kommt nur per E-Mail, so ist die Adresse geprüft.

## Einmalig in HubSpot einrichten

### 1. Kontakt-Eigenschaften

Angelegt am 02.11.2026 in der Gruppe „Kontaktinformationen“:

| Interner Name | Bezeichnung | Typ |
|---|---|---|
| `konfigurator_datenblatt_link` | Konfigurator: Datenblatt-Link | Einzeiliger Text |
| `konfigurator_zusammenfassung` | Konfigurator: Zusammenfassung | Mehrzeiliger Text |

### 2. Formular „Konfigurator Datenblatt“

- **Formulartyp:** Marketing → Formulare → Formular erstellen → **Eingebettetes Formular**. Nur dieser Typ nimmt Daten über die Schnittstelle an.
- **Felder:** Vorname, Nachname, E-Mail, Unternehmensname sowie die beiden Eigenschaften aus Schritt 1. Diese beiden als **ausgeblendete** Felder.
- **Datenschutz:** Bei „Datenschutz und Einwilligung“ die Option **„Einwilligung in die Verarbeitung“** wählen. Der Konfigurator schickt den Einwilligungstext genau so mit, wie er im Formular steht.
- **Veröffentlichen.** Die Formular-ID (GUID) steht in der Adresszeile des Formular-Editors, zum Beispiel `…/forms/19508245/editor/1a2b3c4d-…/edit`. Sie kommt in `js/anfrage.js` unter `formGuid`.

### 3. E-Mail „Ihr SEMBLA-Datenblatt“

- **E-Mail-Typ:** automatisierte Marketing-E-Mail.
- **Knopf „Datenblatt öffnen“:** Als Link das Personalisierungs-Token der Eigenschaft `konfigurator_datenblatt_link` einsetzen, also `{{ contact.konfigurator_datenblatt_link }}`.
- **Text:** zum Beispiel „Danke für Ihr Interesse. Hier ist das Datenblatt zu Ihrer Wand: … Mit ‚Als PDF speichern‘ legen Sie es ab. Möchten Sie Ihr Projekt mit unserem Planungsteam besprechen? …“
- **Abo-Typ:** einer für Transaktions- oder Service-E-Mails, damit die Mail auch ohne Marketing-Einwilligung zugestellt wird. Das bitte mit dem Datenschutz abstimmen.

### 4. Workflow

- **Auslösung:** Kontakt hat das Formular „Konfigurator Datenblatt“ abgeschickt. Wiederholte Anmeldung erlauben, damit jede neue Konfiguration eine neue Mail auslöst.
- **Aktionen:**
  1. E-Mail aus Schritt 3 senden.
  2. Interne Benachrichtigung an den Vertrieb, mit Zusammenfassung und Link.
  3. Optional: Lifecycle-Phase auf „Lead“ setzen und den Kontakt einem Verantwortlichen zuweisen.

### 5. Konfigurator scharf schalten

- `formGuid` in `js/anfrage.js` eintragen, pushen, eine Testanfrage schicken.
- **Prüfen:**
  - Kontakt mit Link und Zusammenfassung angelegt?
  - E-Mail angekommen?
  - Benachrichtigung angekommen?
- Liefert die Schnittstelle einen Fehler 404 oder 403, `endpunkt` auf `https://api-eu1.hsforms.com/submissions/v3/integration/submit` umstellen. Das Portal liegt im EU-Rechenzentrum.

## Tracking

Der Konfigurator meldet `datenblatt_angefordert` als Ereignis an sembla.de (dataLayer). Liegt das HubSpot-Cookie `hubspotutk` vor, geht es mit, und HubSpot ordnet die Anfrage dem bisherigen Besuch zu.

## Stand der Einrichtung (02.11.2026)

- **Formular** „Konfigurator Datenblatt“, ID `d3ebe3db-0ff2-48e4-902a-d1fcdba6b39b`, veröffentlicht.
  - Legt neue Kontakte an.
  - Benachrichtigt bei jeder Anfrage den Vertrieb per E-Mail.
  - Pflicht ist nur die Einwilligung zur Verarbeitung; das Newsletter-Häkchen ist freiwillig.
- **E-Mail** „Konfigurator | Datenblatt v3“ (seit 03.11.2026, nennt zusätzlich BIM, CAD und Ausschreibungstext): automatisiert, Abo-Typ „Auto-Reply | Eingangsbestätigung Kundenanfrage“, für Automatisierung veröffentlicht.
  - Dunkler Kopf mit SEMBLA-Schriftzug, Zusammenfassung der Konfiguration, grüner Knopf „Datenblatt öffnen“, Inhaltsliste, zweiter Knopf „Termin buchen“.
  - Die Fassungen „Konfigurator | Datenblatt“ und „… v2“ werden nicht mehr verwendet und können archiviert werden. Eine aktive Automatisierungs-Mail lässt sich nicht bearbeiten: kopieren, ändern, veröffentlichen und in der Folge-Mail austauschen.
- **Spam-Schutz:** HubSpot verwirft Anfragen von Domains, die nicht als Website-Domain im Account eingetragen sind („Unregistered Site Domain“). Die Schnittstelle antwortet trotzdem mit 200; die Anfrage landet nur unter Formular → Spam.
  - Einstellungen → Tracking & Analytics → Erweitertes Tracking → Weitere Website-Domains: `sembla.de`, `www.sembla.de`, `p0lycare.github.io` (02.11.2026) und `konfigurator.sembla.de` (03.11.2026) eingetragen.
  - **Wichtig:** Nach „Add domain“ unten auf **Save** klicken, sonst ist der Eintrag nach dem Neuladen weg.
  - HubSpot prüft den Host der Seitenadresse genau: `sembla.de` deckt `www.sembla.de` nicht ab. Eingebettet meldet der Konfigurator die Adresse der Seite auf sembla.de, direkt aufgerufen die GitHub-Pages-Adresse.
  - Geblockte Anfragen lassen sich unter Formular → Spam → „Release“ nachträglich verarbeiten; dann läuft auch die Folge-Mail.
  - Live-Test am 02.11.2026, 23:39 Uhr: Anfrage von der Live-Seite angekommen, Datenblatt-Mail zugestellt.
- **DSGVO:** Das Portal läuft im DSGVO-Modus. Die Mail geht nur raus, wenn der Kontakt dem Abo-Typ „Auto-Reply | Eingangsbestätigung Kundenanfrage“ (ID `2003065224`, in `js/anfrage.js` als `aboTyp`) zugestimmt hat. Der Konfigurator schickt diese Zustimmung mit dem Einwilligungs-Häkchen mit. Fehlt sie, steht im Kontakt-Verlauf „unsubscribed … or there isn't GDPR-compliant legal basis“.
- **Folge-Mail** „Konfigurator | Datenblatt senden“: einfacher Formular-Workflow im Formular-Editor unter „Automation“, **AN** seit 02.11.2026.
  - Zweiter Schritt seit 03.11.2026: „Rotate record to owner“. Neue Kontakte gehen an Andreas Kunsmann; Kontakte mit bestehendem Verantwortlichen behalten ihn. Felix kommt in dieselbe Aktion, wenn er Leads mitbekommen soll.
  - Lifecycle-Phase: setzt das Formular selbst auf „Lead“ (Formular-Einstellungen).
  - Test am 02.11.2026 mit einer internen Adresse: Kontakt mit Link und Zusammenfassung, Benachrichtigung und Datenblatt-Mail angekommen, der Knopf öffnet das richtige Datenblatt.
  - Normale Workflows mit Marketing-Mails sind im Paket Starter nicht möglich, deshalb dieser Weg.
  - Der leere Entwurf „Unbenannter Workflow …“ ist am 03.11.2026 gelöscht (90 Tage wiederherstellbar).
- **Terminseite** „SEMBLA Konfigurator: Projektgespräch“ (Round robin, 30 Min., Microsoft Teams): https://business.polycare.de/meetings/andreas-kunsmann/sembla-projektgespraech
  - Felix Bauroth kommt dazu, sobald sein Kalender verbunden ist: Meetings → Seite bearbeiten → Team members.
