// Wandelt Bauteil-OBJs (Rhino-Export, mm, y nach oben) in kompakte Netze {v, f} für das 3D-Modell.
// Aufruf: node tools/obj-zu-json.mjs ziel.json name=pfad.obj [name=pfad.obj …]
// Koordinaten auf 0,1 mm gerundet, Flächen als Dreiecksfächer. Normalen rechnet three.js.
import { readFileSync, writeFileSync } from "node:fs";

function lies(pfad) {
  const v = [], f = [];
  for (const zeile of readFileSync(pfad, "utf8").split(/\r?\n/)) {
    const t = zeile.trim().split(/\s+/);
    if (t[0] === "v") v.push(...t.slice(1, 4).map((x) => Math.round(+x * 10) / 10));
    else if (t[0] === "f") {
      const idx = t.slice(1).map((s) => { const i = parseInt(s, 10); return i < 0 ? v.length / 3 + i : i - 1; });
      for (let k = 1; k + 1 < idx.length; k++) f.push(idx[0], idx[k], idx[k + 1]);
    }
  }
  return { v, f };
}

const [ziel, ...teile] = process.argv.slice(2);
const aus = {};
for (const t of teile) { const [name, pfad] = t.split("="); aus[name] = lies(pfad); }
writeFileSync(ziel, JSON.stringify(aus));
for (const [k, n] of Object.entries(aus)) console.log(k, n.v.length / 3, "Punkte,", n.f.length / 3, "Dreiecke");
