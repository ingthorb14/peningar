// ═══════════════════════════════════════════════════════════════════
//  Sækir söguleg gögn og skrifar js/saga-gogn.js. Engin dependency (Node 18+).
//    node scripts/saekja-gogn.mjs         → VNV (Hagstofa) + meginvextir (Seðlabanki)
//    node scripts/saekja-gogn.mjs --vnv   → aðeins VNV; stýrivextir haldast óbreyttir
//  Skráin er aðeins endurskrifuð ef tölurnar breytast (notað af GitHub Action).
// ═══════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKRA = path.join(ROT, "js", "saga-gogn.js");
const ADEINS_VNV = process.argv.includes("--vnv");

const HEIMILDIR = {
  vnvManadar: "https://px.hagstofa.is/pxis/api/v1/is/Efnahagur/visitolur/1_vnv/1_vnv/VIS01000.px",
  vnvAr: "https://px.hagstofa.is/pxis/api/v1/is/Efnahagur/visitolur/1_vnv/1_vnv/VIS01005.px",
  meginvextir: "https://www.sedlabanki.is/xmltimeseries/Default.aspx?TimeSeriesID=17923&Type=csv",
};
const FRA_AR = 2000;

async function px(url, query) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json-stat2" } }),
  });
  if (!r.ok) throw new Error(`Hagstofa svaraði ${r.status} (${url})`);
  return r.json();
}

// Mánaðarleg VNV (1988=100) og ársbreyting í %
async function saekjaVnv() {
  const d = await px(HEIMILDIR.vnvManadar, [
    { code: "Vísitala", selection: { filter: "item", values: ["CPI"] } },
    { code: "Liður", selection: { filter: "item", values: ["index", "change_A"] } },
  ]);
  if (d.id.join() !== "Mánuður,Vísitala,Liður") throw new Error("Óvænt uppbygging VIS01000: " + d.id);
  const manudir = Object.keys(d.dimension["Mánuður"].category.index);
  const lidir = Object.keys(d.dimension["Liður"].category.index);
  const iI = lidir.indexOf("index"), iA = lidir.indexOf("change_A");
  const rod = manudir.map((m, k) => ({ m: m.replace("M", "-"), vnv: d.value[k * lidir.length + iI], ars: d.value[k * lidir.length + iA] }))
    .filter(x => x.vnv != null);
  const fra = rod.findIndex(x => x.m === `${FRA_AR}-01`);
  const nyjast = rod[rod.length - 1];
  return {
    verdbolga: { fra: rod[fra].m, gildi: rod.slice(fra).map(x => x.ars) },
    vnvNyjast: { man: nyjast.m, gildi: nyjast.vnv },
  };
}

// Ársmeðaltal VNV á grunni 1988=100 (til frá 1988)
async function saekjaVnvAr() {
  const d = await px(HEIMILDIR.vnvAr, [
    { code: "Vísitala", selection: { filter: "item", values: ["CPI"] } },
    { code: "Grunnur", selection: { filter: "item", values: ["B1988"] } },
  ]);
  const ar = Object.keys(d.dimension["Ár"].category.index);
  const rod = ar.map((a, k) => [+a, d.value[k]]).filter(([, v]) => v != null);
  rod.forEach(([a], k) => { if (k && a !== rod[k - 1][0] + 1) throw new Error("Gat í ársmeðaltölum við " + a); });
  return { fra: rod[0][0], gildi: rod.map(([, v]) => v) };
}

// Meginvextir: dagleg röð → aðeins dagar þar sem vextir breytast
async function saekjaMeginvexti() {
  const idag = new Date().toISOString().slice(0, 10);
  const r = await fetch(`${HEIMILDIR.meginvextir}&DagsFra=${FRA_AR}-01-01&DagsTil=${idag}`);
  if (!r.ok) throw new Error(`Seðlabankinn svaraði ${r.status}`);
  const dagar = (await r.text()).split(/\r?\n/).map(l => l.split(";")).filter(p => p.length >= 8 && p[2] === "17923" && p[7])
    .map(p => {
      const [m, dd, y] = p[6].split(" ")[0].split("/").map(Number);   // M/D/YYYY
      return [`${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`, +(+p[7]).toFixed(3)];
    })
    .sort((a, b) => a[0] < b[0] ? -1 : 1);
  if (dagar.length < 1000) throw new Error("Of fáar færslur frá Seðlabanka: " + dagar.length);
  return dagar.filter((x, k) => !k || x[1] !== dagar[k - 1][1]);
}

function lesaNuverandi() {
  if (!fs.existsSync(SKRA)) return null;
  return vm.runInContext(fs.readFileSync(SKRA, "utf8") + "\n;SAGA_GOGN", vm.createContext({}));
}

function skrifa(g) {
  const lina = (arr, n = 12) => arr.reduce((rows, v, k) => (k % n ? rows[rows.length - 1].push(v) : rows.push([v]), rows), [])
    .map(r => "      " + r.join(", ")).join(",\n");
  return `// ═══════════════════════════════════════════════════════════════════
//  SÖGULEG GÖGN — búin til af scripts/saekja-gogn.mjs. EKKI breyta handvirkt.
//  Heimildir:
//    Verðbólga (ársbreyting VNV, mánaðarlega): Hagstofa Íslands, tafla VIS01000
//      ${HEIMILDIR.vnvManadar}
//    VNV ársmeðaltöl (1988=100): Hagstofa Íslands, tafla VIS01005
//      ${HEIMILDIR.vnvAr}
//    Meginvextir Seðlabanka Íslands (tímaröð 17923, „útgefnir meginvextir á hverjum tíma“)
//      ${HEIMILDIR.meginvextir}
//      Til 31.3.2009: vextir á lánum gegn veði. 1.4.–30.9.2009: vextir á viðskiptareikningum.
//      1.10.2009–20.5.2014: meðaltal vaxta á viðskiptareikningum og 28 daga innstæðubréfa.
//      Frá 21.5.2014: vextir á 7 daga bundnum innlánum.
// ═══════════════════════════════════════════════════════════════════

const SAGA_GOGN = {
  sott: "${g.sott}",
  // Ársverðbólga (%) mánaðarlega, frá ${g.verdbolga.fra}
  verdbolga: {
    fra: "${g.verdbolga.fra}",
    gildi: [
${lina(g.verdbolga.gildi)}
    ],
  },
  // Nýjasta vísitala neysluverðs (1988=100)
  vnvNyjast: { man: "${g.vnvNyjast.man}", gildi: ${g.vnvNyjast.gildi} },
  // Ársmeðaltal VNV (1988=100), frá ${g.vnvAr.fra}
  vnvAr: {
    fra: ${g.vnvAr.fra},
    gildi: [
${lina(g.vnvAr.gildi, 10)}
    ],
  },
  // Meginvextir (%): [gildistökudagur, vextir] — aðeins dagar þegar vextir breyttust
  styrivextir: [
${g.styrivextir.map(([d, v]) => `    ["${d}", ${v}],`).join("\n")}
  ],
};
`;
}

const gamalt = lesaNuverandi();
if (ADEINS_VNV && !gamalt) throw new Error("--vnv krefst þess að js/saga-gogn.js sé til");

const [vnv, vnvAr, styrivextir] = await Promise.all([
  saekjaVnv(),
  saekjaVnvAr(),
  ADEINS_VNV ? Promise.resolve(gamalt.styrivextir) : saekjaMeginvexti(),
]);
const nytt = { ...vnv, vnvAr, styrivextir };

const sama = gamalt && ["verdbolga", "vnvNyjast", "vnvAr", "styrivextir"].every(k => JSON.stringify(gamalt[k]) === JSON.stringify(nytt[k]));
if (sama) {
  console.log(`Engin breyting (nýjasta VNV: ${nytt.vnvNyjast.man} = ${nytt.vnvNyjast.gildi})`);
} else {
  fs.writeFileSync(SKRA, skrifa({ sott: new Date().toISOString().slice(0, 10), ...nytt }));
  const vb = nytt.verdbolga.gildi.at(-1);
  console.log(`Uppfært: VNV ${nytt.vnvNyjast.man} = ${nytt.vnvNyjast.gildi}, ársverðbólga ${vb}%` +
    (gamalt ? ` (áður ${gamalt.vnvNyjast.man} = ${gamalt.vnvNyjast.gildi})` : "") +
    `, ${nytt.styrivextir.length} vaxtabreytingar`);
}
