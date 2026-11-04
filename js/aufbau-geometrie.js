// Geometrie der Aufbauschichten: Tiefenlage, Gesamtdicke und Länge der Fassadenschraube.
// Eigenes Modul ohne Abhängigkeiten, damit wand.js und waerme.js es beide nutzen können.

const SCHRAUBEN_LAENGEN = [80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300];

/** Schichten mit Tiefenlage z0/z1 ab Steinoberfläche; `parallel` teilt die Zone der Vorgängerschicht. */
export function schichtLagen(schichten) {
  let start = 0, ende = 0;
  return (schichten || []).map((s) => {
    if (!s.parallel) start = ende;
    const z0 = start, z1 = start + s.dicke;
    ende = Math.max(ende, z1);
    return { ...s, z0, z1 };
  });
}

export function aufbauDicke(schichten) {
  return schichtLagen(schichten).reduce((a, s) => Math.max(a, s.z1), 0);
}

/**
 * Schraubenlänge nach der Mock-up-Regel: durchdrungene Schichten + Mindesteinbindung im Holz,
 * die Spitze hält den Mindestabstand zum Stein. Gewählt wird die kürzeste Handelslänge im Fenster.
 */
export function schraubenlaenge(aufbau) {
  const sc = aufbau && aufbau.schraube;
  if (!sc) return null;
  const dicke = (id) => aufbau.schichten.find((s) => s.id === id).dicke;
  const durch = sc.durch.reduce((a, id) => a + dicke(id), 0);
  const holz = dicke(sc.in);
  const min = durch + sc.einbindung_min_mm;
  const max = durch + holz - sc.abstand_stein_min_mm;
  const laenge = SCHRAUBEN_LAENGEN.find((l) => l >= min && l <= max) ?? null;
  return {
    bezeichnung: sc.bezeichnung, durchmesser_mm: sc.durchmesser_mm, laenge_mm: laenge, min_mm: min, max_mm: max,
    begruendung: `${sc.durch.map(dicke).join(" + ")} mm durchdrungen + mind. ${sc.einbindung_min_mm} mm im KVH, `
      + `Spitze mind. ${sc.abstand_stein_min_mm} mm vor dem Stein`,
  };
}

/**
 * Schichtfolge der ganzen Wand von innen nach außen, wie sie BIM, CAD und Ausschreibung brauchen:
 * je Tiefenzone eine Schicht (Ständer und Gefachdämmung nebeneinander werden eine Zone), dazu
 * der Stein. `art`: innen | stein | fassade | belueftung (ab `belueftung_ab`, hinterlüftet).
 */
export function schichtFolge(fassade, innen, steinDicke = 125) {
  const zonen = (schichten) => {
    const liste = [];
    for (const s of schichten || []) {
      if (!s.parallel || !liste.length) liste.push([]);
      liste[liste.length - 1].push(s);
    }
    return liste.map((z) => ({ name: z.map((s) => s.name).join(" + "), dicke: Math.max(...z.map((s) => s.dicke)), schichten: z }));
  };
  const ab = fassade?.belueftung_ab ? fassade.schichten.findIndex((s) => s.id === fassade.belueftung_ab) : -1;
  const aussen = zonen(fassade?.schichten).map((z) => ({
    ...z, art: ab >= 0 && fassade.schichten.indexOf(z.schichten[0]) >= ab ? "belueftung" : "fassade",
  }));
  return [
    ...zonen(innen?.schichten).reverse().map((z) => ({ ...z, art: "innen" })),
    { name: "SEMBLA-Stein, Trockenmauerwerk vorgespannt", dicke: steinDicke, art: "stein", schichten: [] },
    ...aussen,
  ];
}

/**
 * Höhenlagen (Unterkante, mm) der waagerechten Traglatten: ab 60 mm im Abstand der Deckung, dazu
 * eine Latte bündig an der Wandkrone, wenn darüber sonst mehr als 20 mm frei blieben.
 */
export function traglattenReihen(H, latte) {
  const reihen = [];
  for (let y = 60; y + latte.breite <= H; y += latte.abstand) reihen.push(y);
  const oben = H - latte.breite;
  if (reihen.length && oben - (reihen[reihen.length - 1] + latte.breite) > 20) reihen.push(oben);
  return reihen;
}
