// 3D-Modell der Wand mit three.js: vereinfachte Steine (mit Kammern und Nuten), Spannsystem,
// Verbinder, Fassaden- und Innenschichten. Koordinaten in mm: x entlang der Wand, y nach oben,
// z = 0 ist die Außenseite der Steine, die Innenseite liegt bei z = −125.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GRID, THICK, CHAMBER_OFFSET, wirksameZwischenpunkte } from "./sembla-core.js";
import { schichtLagen } from "./wand.js";
import { traglattenReihen } from "./aufbau-geometrie.js";

const FASE = 3;          // Kantenrundung der vereinfachten Steine
const NUT_B = 22, NUT_T = 10, KAMMER = 58;
// Spannteile aus den Bauteil-OBJs (data/spannteile.json, Ursprung in der Stangenachse, y nach
// oben). Bis die Netze geladen sind, stehen Quader mit denselben Außenmaßen: Breite, y0, y1, Tiefe.
const ERSATZ = { mutter: [17, 0, 8, 19.6], langmutter: [17, 0, 30, 19.6], senkkopf: [22.4, 0, 30.3, 22.4], einlegeblech: [47, -8.5, 1.5, 90] };
const EINLEGEBLECH_OBEN = 1.5;   // Oberkante des Blechs über seinem Ursprung
// Gestufte Darstellung: jede Schicht endet um STUFE_MM früher als die darunterliegende.
const STUFE_MM = 450;

/** Vereinfachter Stein: Grundriss mit Kammern und Nuten, hochextrudiert, Kanten gefast. */
function steinGeometrie(m) {
  const len = m * GRID, x0 = 1 + FASE, x1 = len - 1 - FASE, y0 = FASE, y1 = THICK - FASE;
  const s = new THREE.Shape();
  s.moveTo(x0, y0);
  for (let j = 1; j < m; j++) {
    const x = j * GRID;
    s.lineTo(x - NUT_B / 2, y0); s.lineTo(x - NUT_B / 2, y0 + NUT_T); s.lineTo(x + NUT_B / 2, y0 + NUT_T); s.lineTo(x + NUT_B / 2, y0);
  }
  s.lineTo(x1, y0); s.lineTo(x1, y1);
  for (let j = m - 1; j >= 1; j--) {
    const x = j * GRID;
    s.lineTo(x + NUT_B / 2, y1); s.lineTo(x + NUT_B / 2, y1 - NUT_T); s.lineTo(x - NUT_B / 2, y1 - NUT_T); s.lineTo(x - NUT_B / 2, y1);
  }
  s.lineTo(x0, y1); s.closePath();
  for (let i = 0; i < m; i++) {
    const cx = CHAMBER_OFFSET + i * GRID, cy = THICK / 2, h = KAMMER / 2;
    const p = new THREE.Path();
    p.moveTo(cx - h, cy - h); p.lineTo(cx - h, cy + h); p.lineTo(cx + h, cy + h); p.lineTo(cx + h, cy - h); p.closePath();
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 198 - 2 * FASE, bevelEnabled: true, bevelThickness: FASE,
    bevelSize: FASE, bevelSegments: 1, curveSegments: 2 });
  g.translate(0, 0, FASE + 1);
  g.rotateX(-Math.PI / 2);   // Extrusion zeigt nach oben, Grundriss-y wird zu −z
  g.computeVertexNormals();
  return g;
}

/** Rechteck minus Öffnungen → Teilrechtecke. */
function ausschneiden(r, loecher) {
  let teile = [r];
  for (const h of loecher) {
    const neu = [];
    for (const t of teile) {
      if (h.x1 <= t.x0 || h.x0 >= t.x1 || h.y1 <= t.y0 || h.y0 >= t.y1) { neu.push(t); continue; }
      if (t.x0 < h.x0) neu.push({ ...t, x1: h.x0 });
      if (t.x1 > h.x1) neu.push({ ...t, x0: h.x1 });
      const xa = Math.max(t.x0, h.x0), xb = Math.min(t.x1, h.x1);
      if (t.y0 < h.y0) neu.push({ ...t, x0: xa, x1: xb, y1: h.y0 });
      if (t.y1 > h.y1) neu.push({ ...t, x0: xa, x1: xb, y0: h.y1 });
    }
    teile = neu;
  }
  return teile.filter((t) => t.x1 - t.x0 > 1 && t.y1 - t.y0 > 1);
}

const EINHEIT = new THREE.BoxGeometry(1, 1, 1);

/** Viele Quader eines Materials als eine InstancedMesh. box: {x0,x1,y0,y1,z0,z1,rx?} */
function quader(boxen, material) {
  const im = new THREE.InstancedMesh(EINHEIT, material, Math.max(1, boxen.length));
  const o = new THREE.Object3D();
  boxen.forEach((b, i) => {
    o.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    o.rotation.set(b.rx || 0, 0, 0);
    o.scale.set(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  im.count = boxen.length;
  return im;
}

export function erstelle(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch { return null; }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 50, 200000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f90, 1.1));
  const sonne = new THREE.DirectionalLight(0xffffff, 1.4); sonne.position.set(3000, 6000, 5000); scene.add(sonne);
  const gegen = new THREE.DirectionalLight(0xffffff, 0.5); gegen.position.set(-3000, 2000, -5000); scene.add(gegen);

  const controls = new OrbitControls(cam, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.minDistance = 600;
  controls.maxDistance = 60000;

  const mats = {};
  const mat = (farbe, opt = {}) => (mats[farbe + JSON.stringify(opt)] ||= new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.85, ...opt }));
  const steinGeo = {};
  let echteSteine = null;   // vereinfachte Originalgeometrie aus data/steine.json
  const geo = (m) => (echteSteine && echteSteine[m]) || (steinGeo[m] ||= steinGeometrie(m));
  let letzterAufruf = null;
  const netz = (p) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p.v, 3));
    g.setIndex(p.f);
    const flach = g.toNonIndexed(); flach.computeVertexNormals(); g.dispose();
    return flach;
  };
  let spannteile = null;
  const ersatzGeo = {};
  const teilGeo = (n) => spannteile?.[n] || (ersatzGeo[n] ||= (() => {
    const [b, y0, y1, t] = ERSATZ[n], g = new THREE.BoxGeometry(b, y1 - y0, t);
    g.translate(0, (y0 + y1) / 2, 0); return g;
  })());
  /** Ein Spannteil an vielen Stellen auf der Stangenachse (Wandmitte). punkte: [{x, y}] */
  function teil(n, punkte, material) {
    const im = new THREE.InstancedMesh(teilGeo(n), material, Math.max(1, punkte.length));
    const o = new THREE.Object3D();
    punkte.forEach((p, i) => { o.position.set(p.x, p.y, -THICK / 2); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.count = punkte.length;
    return im;
  }
  fetch(new URL("../data/spannteile.json", import.meta.url)).then((r) => r.json()).then((P) => {
    spannteile = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, netz(p)]));
    if (letzterAufruf) aktualisiere(...letzterAufruf);
  }).catch(() => { /* Ersatzquader bleiben */ });
  fetch(new URL("../data/steine.json", import.meta.url)).then((r) => r.json()).then((P) => {
    echteSteine = { 2: netz(P.i2), 3: netz(P.i3) };
    Object.values(echteSteine).forEach((g) => (steinGeo["echt" + g.id] = g));
    if (letzterAufruf) aktualisiere(...letzterAufruf);
  }).catch(() => { /* vereinfachte Ersatzkörper bleiben */ });

  const welt = new THREE.Group(); scene.add(welt);
  let st = null;   // aktueller Szeneninhalt
  let zustand = { rueckbau: 0, faechern: 0, gestuft: true, ebenen: { steine: true, spann: true, verbinder: true, fassade: true, innen: true } };
  let rahmen = 0;

  function render() { renderer.render(scene, cam); }
  function anfordern() { if (!rahmen) rahmen = requestAnimationFrame(() => { rahmen = 0; if (controls.update()) anfordern(); render(); }); }
  controls.addEventListener("change", anfordern);

  function groesse() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); anfordern();
  }
  new ResizeObserver(groesse).observe(canvas);

  function leeren() {
    while (welt.children.length) {
      const c = welt.children.pop();
      c.traverse((o) => { if (o.isInstancedMesh) o.dispose(); else if (o.geometry && o.geometry !== EINHEIT && !Object.values(steinGeo).includes(o.geometry)) o.geometry.dispose(); });
    }
  }

  /** Schichten einer Seite als Gruppen (eine je Schicht). seite: +1 außen, −1 innen. */
  function schichten(aufbau, ver, seite, w, loecher, farben) {
    const L = w.length_mm, H = w.height_mm;
    const gruppen = [];
    const zWelt = (z0, z1) => (seite > 0 ? [z0, z1] : [-THICK - z1, -THICK - z0]);
    let staenderBreite = 60;
    const lagen = schichtLagen(aufbau.schichten);
    const stufe = zustand.gestuft ? Math.min(STUFE_MM, (L * 0.5) / Math.max(1, lagen.length)) : 0;
    for (const [idx, s] of lagen.entries()) {
      const [za, zb] = zWelt(s.z0, s.z1);
      const boxen = [];
      const flaeche = (x0, x1, y0, y1, extra = {}) =>
        ausschneiden({ x0, x1, y0, y1 }, loecher).forEach((t) => boxen.push({ ...t, z0: za, z1: zb, ...extra }));
      switch (s.art) {
        case "staender":
        case "latte_v":
          staenderBreite = s.breite;
          for (const sg of ver.segmente) boxen.push({ x0: sg.x - s.breite / 2, x1: sg.x + s.breite / 2, y0: sg.y0, y1: sg.y1, z0: za, z1: zb });
          break;
        case "feld": {
          const xs = ver.achsen, b = staenderBreite / 2;
          const kanten = [0, ...xs.flatMap((x) => [x - b, x + b]), L];
          for (let i = 0; i < kanten.length; i += 2) if (kanten[i + 1] - kanten[i] > 2) flaeche(kanten[i] + 1, kanten[i + 1] - 1, 0, H);
          break;
        }
        case "platte":
          flaeche(0, L, 0, H);
          break;
        case "latte_h":
          for (const y of traglattenReihen(H, s)) flaeche(0, L, y, y + s.breite);
          break;
        case "halter":
          for (const p of ver.punkte) boxen.push({ x0: p.x - s.breite / 2, x1: p.x + s.breite / 2, y0: p.y - s.hoehe / 2, y1: p.y + s.hoehe / 2, z0: za, z1: zb });
          break;
        case "leiste_h":
          for (let y = 0; y < H; y += s.hoehe + s.fuge) flaeche(0, L, y, Math.min(H, y + s.hoehe));
          break;
        case "paneel":
          for (let y = 0; y < H; y += s.hoehe) for (let x = 0; x < L; x += s.breite)
            flaeche(x + s.fuge / 2, Math.min(L, x + s.breite) - s.fuge / 2, y + s.fuge / 2, Math.min(H, y + s.hoehe) - s.fuge / 2);
          break;
        case "schindel": {
          const neig = -Math.atan(s.dicke / s.hoehe) * seite;
          const zm = (za + zb) / 2;
          for (let r = 0, y = 0; y + 40 < H; r++, y += s.deckung) {
            const y1 = Math.min(H, y + s.hoehe);
            for (let x = r % 2 ? -s.breite / 2 : 0; x < L; x += s.breite)
              ausschneiden({ x0: Math.max(0, x) + 1, x1: Math.min(L, x + s.breite) - 1, y0: y, y1 }, loecher)
                .forEach((t) => boxen.push({ ...t, z0: zm - 6, z1: zm + 6, rx: neig }));
          }
          break;
        }
      }
      // Gestuft: am rechten Wandende tritt jede Schicht hinter die nächstäußere zurück.
      const xEnde = L - idx * stufe;
      const sichtbar = stufe ? boxen.filter((b) => b.x0 < xEnde - 1).map((b) => (b.x1 > xEnde ? { ...b, x1: xEnde } : b)) : boxen;
      const g = new THREE.Group();
      g.add(quader(sichtbar, mat(farben[s.material] || "#cccccc")));
      g.userData = { seite, tiefe: s.z1, name: s.name };
      gruppen.push(g);
    }
    return gruppen;
  }

  function aktualisiere(r, fassade, innen, farben) {
    letzterAufruf = [r, fassade, innen, farben];
    leeren();
    const { w } = r;
    const L = w.length_mm, H = w.height_mm;
    const loecher = w.openings.map((op) => ({
      x0: op.g0 * GRID, x1: op.g1 * GRID,
      y0: w.courses[op.l0].unterkante_mm, y1: w.courses[op.l1 - 1].oberkante_mm,
    }));

    // Steine: je Steintyp eine InstancedMesh; Lage und Höhe je Instanz gemerkt für den Rückbau
    const steine = new THREE.Group();
    const proTyp = {};
    w.courses.forEach((c, li) => c.stones.forEach((s) => {
      const m = Math.round((s.x1 - s.x0) / GRID);
      (proTyp[m] ||= []).push({ x: s.x0, y: c.unterkante_mm, sy: c.hoehe_mm / 200, li });
    }));
    const steinMeshes = Object.entries(proTyp).map(([m, liste]) => {
      const im = new THREE.InstancedMesh(geo(+m), mat(farben.stein, { roughness: 0.92 }), liste.length);
      im.userData.liste = liste; steine.add(im); return im;
    });

    // Spannsystem: Gewindestange je Segment, Kopplungsmuttern an den Stößen. Am Wandfuß
    // Senkkopfschraube durchs Bodenblech in die Kopplungsmutter, die Stange steckt zur Hälfte darin.
    // An jedem Spannplatten-Ende Platte und Spannmutter (oben darauf, über einer Öffnung darunter).
    const spann = new THREE.Group();
    const stahl = mat(farben.stahl, { metalness: 0.6, roughness: 0.4 });
    const stab = new THREE.CylinderGeometry(5, 5, 1, 12);
    const platten = [], muttern = [], kopplung = [], schrauben = [];
    for (const col of w.tension_columns) for (const sg of col.segments) {
      const x = col.x_mm, fuss = sg.anker_unten === "bodenblech";
      const laengen = (sg.stuecke || []).map((t) => t.len_mm);
      const gesamt = laengen.reduce((a, b) => a + b, 0) || sg.z1_mm - sg.z0_mm + 30;
      const start = fuss ? sg.z0_mm + 15 : sg.z0_mm - 25;
      const rod = new THREE.Mesh(stab, stahl);
      rod.scale.y = gesamt; rod.position.set(x, start + gesamt / 2, -THICK / 2);
      spann.add(rod);
      let y = start;
      for (const l of laengen.slice(0, -1)) { y += l; kopplung.push({ x, y: y - 15 }); }
      if (fuss) { kopplung.push({ x, y: sg.z0_mm }); schrauben.push({ x, y: sg.z0_mm - 10 }); }
      else {
        platten.push({ x0: x - 60, x1: x + 60, y0: sg.z0_mm - 10, y1: sg.z0_mm, z0: -THICK / 2 - 60, z1: -THICK / 2 + 60 });
        muttern.push({ x, y: sg.z0_mm - 18 });
      }
      platten.push({ x0: x - 60, x1: x + 60, y0: sg.z1_mm, y1: sg.z1_mm + 10, z0: -THICK / 2 - 60, z1: -THICK / 2 + 60 });
      muttern.push({ x, y: sg.z1_mm + 10 });
    }
    spann.add(quader(platten, stahl), teil("mutter", muttern, stahl), teil("langmutter", kopplung, stahl), teil("senkkopf", schrauben, stahl));
    // Einlegebleche der Zwischenspannpunkte mit Mutter: Oberkante bündig mit der Lagenoberkante,
    // sie liegen in der Lage und gehen beim Rückbau mit ihr.
    const lageAn = (z) => w.courses.findIndex((c) => Math.abs(c.oberkante_mm - z) < 1);
    const zp = wirksameZwischenpunkte(w).map((p) => ({ x: p.x_mm, y: p.z_mm, li: Math.max(0, lageAn(p.z_mm)) }));
    const einlege = new THREE.Group();
    // Signalfarbe, damit die Bleche zwischen den abgehobenen Lagen auffallen.
    const blechMat = mat(farben.einlegeblech || "#E0A100", { metalness: 0.3, roughness: 0.45 });
    const blechM = teil("einlegeblech", zp.map((p) => ({ x: p.x, y: p.y - EINLEGEBLECH_OBEN })), blechMat);
    const mutterM = teil("mutter", zp.map((p) => ({ x: p.x, y: p.y })), blechMat);
    blechM.userData.liste = mutterM.userData.liste = zp;
    einlege.add(blechM, mutterM);
    const boden = quader([{ x0: 0, x1: L, y0: -10, y1: 0, z0: -THICK, z1: 0 }], stahl);
    welt.add(boden);

    // Verbinder
    const verb = new THREE.Group();
    const vm = mat(farben.verbinder, { roughness: 0.5 });
    verb.add(quader(r.fa.punkte.map((p) => ({ x0: p.x - 18, x1: p.x + 18, y0: p.y - 24, y1: p.y + 24, z0: -4, z1: 14 })), vm));
    verb.add(quader(r.ia.punkte.map((p) => ({ x0: p.x - 18, x1: p.x + 18, y0: p.y - 24, y1: p.y + 24, z0: -THICK - 14, z1: -THICK + 4 })), vm));

    const aussen = schichten(fassade, r.fa, 1, w, loecher, farben);
    const innenG = schichten(innen, r.ia, -1, w, loecher, farben);
    const fGruppe = new THREE.Group(); aussen.forEach((g) => fGruppe.add(g));
    const iGruppe = new THREE.Group(); innenG.forEach((g) => iGruppe.add(g));

    // Boden
    const flur = new THREE.Mesh(new THREE.BoxGeometry(L + 3000, 40, 4000), mat("#E4E4DF", { roughness: 1 }));
    flur.position.set(L / 2, -30, -THICK / 2);
    welt.add(steine, spann, einlege, verb, fGruppe, iGruppe, flur);

    // Ausbauschichten in Rückbau-Reihenfolge: außen zuerst die äußerste
    const reihenfolge = [...aussen, ...innenG].sort((a, b) => b.userData.tiefe - a.userData.tiefe);

    const neu = !st || st.L !== L || st.H !== H;
    st = { L, H, lagen: w.courses.length, steinMeshes, spann, einlege, einlegeBasis: [blechM, mutterM].map((m) => { const a = new THREE.Matrix4(); return [...Array(m.count).keys()].map((i) => { m.getMatrixAt(i, a); return a.clone(); }); }), verb, fGruppe, iGruppe, aussen, innenG, reihenfolge };
    anwenden();
    if (neu) blick("schraeg");
    anfordern();
  }

  function anwenden() {
    if (!st) return;
    const t = zustand.rueckbau, f = zustand.faechern, e = zustand.ebenen;
    const k = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
    const sanft = (x) => x * x * (3 - 2 * x);

    // Phase A (0–0,35): Ausbauschichten nacheinander abnehmen
    const n = st.reihenfolge.length;
    st.reihenfolge.forEach((g, j) => {
      const p = sanft(k((0.3 * j) / Math.max(1, n), (0.3 * j) / Math.max(1, n) + 0.12));
      const idx = (g.userData.seite > 0 ? st.aussen : st.innenG).indexOf(g);
      g.position.z = g.userData.seite * ((idx + 1) * 380 * f + p * 1600);
      g.visible = p < 1;
    });
    st.fGruppe.visible = e.fassade; st.iGruppe.visible = e.innen;
    st.verb.visible = e.verbinder && k(0.3, 0.36) < 1;

    // Phase B (0,35–0,6): Vorspannung lösen, Gewindestangen ziehen
    st.spann.position.y = sanft(k(0.38, 0.58)) * (st.H + 900);
    st.spann.visible = e.spann && k(0.38, 0.6) < 1;

    // Phase C (0,6–1): Lage für Lage abheben
    const pc = sanft(k(0.6, 1));
    const o = new THREE.Object3D();
    for (const im of st.steinMeshes) {
      im.userData.liste.forEach((s, i) => {
        o.position.set(s.x, s.y + pc * s.li * 110, 0); o.scale.set(1, s.sy, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      });
      im.instanceMatrix.needsUpdate = true; im.visible = e.steine;
    }
    // Einlegebleche heben mit ihrer Lage ab und schweben dabei sichtbar in der Fuge darüber; sie
    // gehören zum Spannsystem, bleiben aber beim Ziehen der Stangen liegen.
    const hub = new THREE.Matrix4();
    st.einlege.children.forEach((im, j) => {
      im.userData.liste.forEach((p, i) => {
        hub.makeTranslation(0, pc * (p.li * 110 + 55), 0).multiply(st.einlegeBasis[j][i]);
        im.setMatrixAt(i, hub);
      });
      im.instanceMatrix.needsUpdate = true;
    });
    st.einlege.visible = e.spann;
    anfordern();
  }

  function setze(teil) {
    const neuBauen = "gestuft" in teil && teil.gestuft !== zustand.gestuft;
    zustand = { ...zustand, ...teil, ebenen: { ...zustand.ebenen, ...(teil.ebenen || {}) } };
    if (neuBauen && letzterAufruf) aktualisiere(...letzterAufruf); else anwenden();
  }

  function blick(name) {
    if (!st) return;
    const az = { aussen: 0, innen: Math.PI, schraeg: 0.65 }[name] ?? 0.65;
    const el = name === "schraeg" ? 0.28 : 0.06;
    const ziel = new THREE.Vector3(st.L / 2, st.H / 2, 0);
    const halbH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = Math.max(st.H / 2 / halbH, st.L / 2 / (halbH * Math.max(cam.aspect, 0.5))) * 1.25 + 800;
    cam.position.set(ziel.x + d * Math.sin(az) * Math.cos(el), ziel.y + d * Math.sin(el), ziel.z + d * Math.cos(az) * Math.cos(el));
    controls.target.copy(ziel); controls.update(); anfordern();
  }

  groesse();
  return { aktualisiere, setze, blick };
}
