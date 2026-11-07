// Wandaufbau für die Feuchte-App auf der Kommandozeile, als JSON auf stdout.
//   node tools/wandaufbau.mjs "https://…/?f=schindel&i=trockenbau_putz&dd=120&da=60"
//   node tools/wandaufbau.mjs f=schindel_einlagig i=trockenbau_putz dd=160
//   node tools/wandaufbau.mjs --alle        # alle freigegebenen Kombinationen mit ausgelegter Dämmstärke
import { readFileSync } from "node:fs";
import { wandaufbau, wandaufbauAusLink } from "../js/export-hygro.js";

const A = JSON.parse(readFileSync(new URL("../data/aufbauten.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
try {
  let out;
  if (args[0] === "--alle") {
    out = [];
    for (const f of A.fassaden.filter((x) => x.freigegeben !== false))
      for (const i of A.innen.filter((x) => x.freigegeben !== false)) out.push(wandaufbau(A, { fassade: f.id, innen: i.id }));
  } else if (args.length) {
    out = wandaufbauAusLink(A, args.length === 1 ? args[0] : args.join("&"));
  } else {
    console.error("Aufruf: node tools/wandaufbau.mjs <Konfigurator-Link | f=… i=… dd=… da=…> | --alle");
    process.exit(2);
  }
  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  console.error(String(e.message || e));
  process.exit(1);
}
