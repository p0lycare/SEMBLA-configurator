// Tauwasserschutz der Außenwand nach DIN 4108-3: Glaser-Verfahren (Periodenbilanz) im Gefach-
// schnitt und Taupunkt an der Dampfbremse. Klima, Übergangswiderstände und Grenzwerte stehen in
// aufbauten.json (`waerme.feuchte`). Reines Modul ohne DOM.

// Wasserdampf-Diffusionsleitkoeffizient ruhender Luft δ0 = 2 · 10⁻¹⁰ kg/(m·s·Pa) (DIN 4108-3:2018,
// Anhang B); als Widerstand je Stunde Z = sd / (δ0 · 3600 s) in m²·h·Pa/kg.
const Z_FAKTOR = 1 / (2e-10 * 3600);

/** Sättigungsdampfdruck in Pa (DIN 4108-3, Magnus-Formel). */
export function ps(theta) {
  return theta >= 0 ? 610.5 * Math.exp(17.269 * theta / (237.3 + theta)) : 610.5 * Math.exp(21.875 * theta / (265.5 + theta));
}

/** Taupunkttemperatur in °C. */
export function taupunkt(theta, phi) {
  const x = Math.log(phi * ps(theta) / 610.5);
  return x >= 0 ? 237.3 * x / (17.269 - x) : 265.5 * x / (21.875 - x);
}

// Bahnen: Dampfbremse ("bahn") und diffusionsoffene Fassadenbahn; Dampfbremse ist nur die erste.
const istBahn = (s) => s.material === "bahn" || s.material === "fassadenbahn";
// Kapillar nicht wasseraufnahmefähig (DIN 4108-3, 5.2.2 c): Folien, Mineralwolle, Schaumkunststoffe.
const nichtSaugend = (s) => istBahn(s) || s.kapillar === false;

/** Schichten einer Seite als Zonen (eine Schicht plus die mit `parallel` danebenliegenden). */
function zonenListe(schichten) {
  const liste = [];
  for (const s of schichten) {
    if (!s.parallel || !liste.length) liste.push([]);
    liste[liste.length - 1].push(s);
  }
  return liste;
}

/** Eine Zone im Gefach: Dämmung bzw. Platte; ohne Gefachstoff ruhende Luft zwischen Latten. */
function gefachLage(zone) {
  const bahn = zone.find(istBahn);
  if (bahn) return { name: bahn.name, R: 0, sd: bahn.sd, bahn: bahn.material === "bahn", nichtSaugend: true, einbau: bahn.einbau };
  const stoff = zone.find((s) => s.lambda && s.art !== "staender" && s.art !== "latte_v");
  if (stoff) return {
    name: stoff.name, R: stoff.dicke / 1000 / stoff.lambda, sd: (stoff.mu ?? 1) * stoff.dicke / 1000,
    nichtSaugend: nichtSaugend(stoff),
    // Holz und Holzwerkstoffe: zulässige Erhöhung des massebezogenen Feuchtegehalts (5 % bzw. 3 %).
    ...(stoff.holz_feuchte_max ? { flaechenmasse: stoff.rho * stoff.dicke / 1000, feuchte_max: stoff.holz_feuchte_max } : {}),
  };
  const latte = zone.find((s) => s.art === "latte_v");
  if (latte) return { name: "Installationsebene (Luft)", R: latte.r_zwischenraum ?? 0.18, sd: latte.dicke / 1000 };
  return null;
}

/**
 * Schichten von innen nach außen im Gefachschnitt. Bei hinterlüfteten Fassaden endet die Rechnung
 * an der Belüftungsebene (`belueftung_ab`), dort gilt das Außenklima.
 */
export function glaserSchichten(fassade, innen, kw) {
  const innenLagen = zonenListe(innen?.schichten || []).map(gefachLage).filter(Boolean).reverse();
  const ende = fassade?.belueftung_ab ? fassade.schichten.findIndex((s) => s.id === fassade.belueftung_ab) : -1;
  const aussen = ende >= 0 ? fassade.schichten.slice(0, ende) : fassade?.schichten || [];
  const aussenLagen = zonenListe(aussen).map(gefachLage).filter(Boolean);
  // Der Stein zählt nur mit seinem Wärmewiderstand; als Dampfbremse wird er nicht angesetzt (μ = 0).
  const stein = { name: kw.stein.name || "SEMBLA-Stein", R: kw.stein.R, sd: (kw.stein.mu ?? 0) * (kw.stein.dicke_mm ?? 125) / 1000 };
  return [...innenLagen, stein, ...aussenLagen];
}

/** Untere konvexe Hülle (monotone Kette): der Dampfdruckverlauf als gespannter Faden unter p_s. */
function untereHuelle(punkte) {
  const h = [];
  for (const p of punkte) {
    while (h.length >= 2) {
      const [a, b] = [h[h.length - 2], h[h.length - 1]];
      if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) <= 0) h.pop(); else break;
    }
    h.push(p);
  }
  return h;
}

/**
 * Glaser-Verfahren nach DIN 4108-3 für Schichten von innen nach außen ({ name, R, sd, bahn }).
 * Rückgabe: Temperatur- und Druckverlauf, Tauwassermenge, Verdunstungsmenge, Grenzwert, ok.
 */
export function glaser(lagen, f) {
  const { tau, verdunstung: v } = f;
  // Knoten: Schichtgrenzen, Schichten mit Wärmewiderstand in 10 Scheiben geteilt.
  const RT = f.Rsi + lagen.reduce((a, l) => a + l.R, 0) + f.Rse;
  const knoten = [];
  let R = f.Rsi, x = 0;
  const temp = (r) => tau.theta_i - (tau.theta_i - tau.theta_e) * r / RT;
  knoten.push({ x, theta: temp(R), lage: -1 });
  lagen.forEach((l, i) => {
    const n = l.R > 0 && l.sd > 0 ? 10 : 1;
    for (let k = 1; k <= n; k++) knoten.push({ x: x + l.sd * k / n, theta: temp(R + l.R * k / n), lage: i, grenze: k === n });
    x += l.sd; R += l.R;
  });
  const Sd = x;
  const pi = tau.phi_i * ps(tau.theta_i), pe = tau.phi_e * ps(tau.theta_e);
  knoten.forEach((k) => (k.ps = ps(k.theta)));

  const punkte = [{ x: 0, y: pi }, ...knoten.slice(1, -1).map((k, i) => ({ x: k.x, y: k.ps, i: i + 1 })), { x: Sd, y: pe }];
  const huelle = untereHuelle(punkte);
  const kontakt = huelle.slice(1, -1);
  const Z = (sd) => Z_FAKTOR * Math.max(sd, 1e-6);
  const g = (a, b) => (a.y - b.y) / Z(b.x - a.x);   // Diffusionsstromdichte in kg/(m²h)

  const ergebnis = { lagen, knoten, pi, pe, Sd, huelle, tauwasser_kg_m2: 0, verdunstung_kg_m2: 0, ebenen: [], holz: [], grenze_kg_m2: f.grenzen.gesamt_kg_m2, ok: true };
  if (!kontakt.length) return ergebnis;

  const a = kontakt[0], b = kontakt[kontakt.length - 1];
  const mc = (g(huelle[0], a) - g(b, huelle[huelle.length - 1])) * tau.stunden;
  if (mc <= 1e-6) return ergebnis;
  // An Grenzflächen kapillar nicht wasseraufnahmefähiger Schichten gilt der kleinere Grenzwert.
  const nachbarn = (p) => { const k = knoten[p.i]; return [lagen[k.lage], k.grenze ? lagen[k.lage + 1] : null].filter(Boolean); };
  const anBahn = kontakt.some((p) => nachbarn(p).some((l) => l.nichtSaugend));
  // Holz/Holzwerkstoffe an der Tauwasserebene: das Tauwasser darf ihren Feuchtegehalt nur begrenzt erhöhen.
  const holz = [...new Set(kontakt.flatMap(nachbarn).filter((l) => l.feuchte_max))]
    .map((l) => ({ name: l.name, zunahme: mc / l.flaechenmasse, max: l.feuchte_max }));
  const mev = ((v.p_ebene - v.p_i) / Z(a.x) + (v.p_ebene - v.p_e) / Z(Sd - b.x)) * v.stunden;
  const grenze = anBahn ? f.grenzen.nicht_saugend_kg_m2 : f.grenzen.gesamt_kg_m2;
  const ebenen = [...new Set(kontakt.map((p) => {
    const k = knoten[p.i];
    return k.grenze && lagen[k.lage + 1] ? `${lagen[k.lage].name} / ${lagen[k.lage + 1].name}` : lagen[k.lage].name;
  }))];
  const holzOk = holz.every((h) => h.zunahme <= h.max);
  return { ...ergebnis, tauwasser_kg_m2: mc, verdunstung_kg_m2: mev, ebenen, grenze_kg_m2: grenze, holz, ok: mc <= grenze && mev >= mc && holzOk };
}

/**
 * Temperatur an der Dampfbremse im Tauperiodenklima gegenüber dem Taupunkt der Raumluft.
 * Bedingung nach DIN 4108-3: θ an der Bahn ≥ Taupunkt. Daraus folgt das Mindestverhältnis
 * R außen / R innen = (θs − θe) / (θi − θs).
 */
export function bahnTemperatur(lagen, f) {
  const k = lagen.findIndex((l) => l.bahn);
  if (k < 0) return null;
  const { theta_i: ti, theta_e: te, phi_i } = f.tau;
  const Rin = f.Rsi + lagen.slice(0, k).reduce((a, l) => a + l.R, 0);
  const Raus = lagen.slice(k + 1).reduce((a, l) => a + l.R, 0) + f.Rse;
  const theta = ti - (ti - te) * Rin / (Rin + Raus);
  const ts = taupunkt(ti, phi_i);
  const din = (ts - te) / (ti - ts);
  // Planungsregel: R außen / R innen mindestens `bahn_verhaeltnis_min` (1,5), nie weniger als die DIN-Grenze.
  const soll = Math.max(din, f.bahn_verhaeltnis_min || 0);
  const verhaeltnis = Raus / Rin;
  return { einbau: lagen[k].einbau, theta, taupunkt: ts, verhaeltnis, verhaeltnis_din: din, verhaeltnis_min: soll, ok: verhaeltnis >= soll - 1e-9, R_innen: Rin, R_aussen: Raus };
}

/**
 * Feuchteschutz des Aufbaus: Glaser, Temperatur an der Bahn, Lage der luftdichten Ebene.
 * Ist die Innenseite nicht luftdicht, muss die Bahn die luftdichte Ebene sein; dann ist ihre
 * Temperatur über dem Taupunkt Pflicht, sonst würde Raumluft durch die Steinfugen an ihr kondensieren.
 */
export function feuchteschutz(fassade, innen, kw) {
  const f = kw.feuchte;
  const lagen = glaserSchichten(fassade, innen, kw);
  const gl = glaser(lagen, f);
  const bahn = bahnTemperatur(lagen, f);
  const luftdicht = innen?.luftdicht ? "innen" : bahn ? "bahn" : null;
  const bahnPflicht = luftdicht === "bahn";
  // ok umfasst Glaser, die Temperatur an der Bahn (wenn sie luftdicht sein muss) und dass es überhaupt
  // eine luftdichte Ebene gibt; `tauwasserOk` nur den Diffusionsnachweis.
  const tauwasserOk = gl.ok && (!bahnPflicht || bahn.ok);
  return { glaser: gl, bahn, luftdicht, bahnPflicht, tauwasserOk, ok: tauwasserOk && !!luftdicht };
}
