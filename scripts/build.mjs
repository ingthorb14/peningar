// ═══════════════════════════════════════════════════════════════════
//  peningar.is — build (keyrt af Vercel, sjá vercel.json)
//  Afritar síðuna í dist/ og býr til:
//    • dist/hugtok/<slug>/index.html — static síða fyrir hvert hugtak (SEO)
//    • dist/sitemap.xml og dist/robots.txt
//  Engin dependency — aðeins Node (18+).
//  Staðbundið:  node scripts/build.mjs && python3 -m http.server -d dist
// ═══════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROT, "dist");
const lesa = f => fs.readFileSync(path.join(ROT, f), "utf8");

// Lén: SITE_URL ef stillt, annars aðallén Vercel-verkefnisins, annars vercel.app
const SITE = (process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : "https://peningar.vercel.app")
).replace(/\/$/, "");

// ── Gögn úr js/gogn.js (keyrt í einangruðu samhengi) ──────────────
const ctx = vm.createContext({});
const { HUGTOK, FLOKKAR, UPPFAERT, slug } = vm.runInContext(lesa("js/gogn.js") + "\n;({ HUGTOK, FLOKKAR, UPPFAERT, slug })", ctx);

// Cache-busting útgáfa og footer eru sótt úr index.html svo þau séu á einum stað
const index = lesa("index.html");
const VERSJON = index.match(/var VERSJON = "([^"]+)"/)?.[1];
const FOOTER = index.match(/<footer>[\s\S]*?<\/footer>/)?.[0];
if (!VERSJON || !FOOTER) throw new Error("Fann ekki VERSJON eða <footer> í index.html");

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const jsonLd = o => JSON.stringify(o).replace(/</g, "\\u003c");
// Stytta texta að orðaskilum fyrir meta description (~155 stafir)
const stytta = (s, n = 155) => s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,;:.]$/, "") + "…";

const OG_IMAGE = SITE + "/og-image.png";
const ANALYTICS = index.match(/<script>\s*\/\/ Vercel Web Analytics[\s\S]*?<\/script>/)?.[0] || "";

// ── Hugtakasíður ─────────────────────────────────────────────────
const slodir = new Map();
for (const h of HUGTOK) {
  const s = slug(h.term);
  if (!s) throw new Error("Tómt slug fyrir: " + h.term);
  if (slodir.has(s)) throw new Error(`Sama slug „${s}“ fyrir „${h.term}“ og „${slodir.get(s).term}“`);
  slodir.set(s, h);
}

function hugtakSida(h, s) {
  const url = `${SITE}/hugtok/${s}`;
  const f = FLOKKAR[h.cat] || FLOKKAR.grunnur;
  const titill = `${h.term} — einföld skýring | peningar.is`;
  // Ekki endurtaka hugtakið ef skýringin byrjar á því
  const lysing = stytta(h.explanation.startsWith(h.term) ? h.explanation : `${h.term}: ${h.explanation}`);
  const rel = (h.related || []).map(r => HUGTOK.find(x => x.term === r)).filter(Boolean);
  const somuFlokkur = HUGTOK.filter(x => x.cat === h.cat && x !== h && !rel.includes(x));
  const chip = x => `<a class="chip" href="/hugtok/${slug(x.term)}">${esc(x.term)}</a>`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: h.term,
    ...(h.aliases?.length ? { alternateName: h.aliases } : {}),
    description: h.explanation,
    url,
    inLanguage: "is",
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "Fjármálahugtök á peningar.is", url: SITE + "/" },
  };

  return `<!DOCTYPE html>
<html lang="is">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titill)}</title>
<meta name="description" content="${esc(lysing)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#f5f0e8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1814" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="article">
<meta property="og:locale" content="is_IS">
<meta property="og:site_name" content="peningar.is">
<meta property="og:title" content="${esc(h.term)} — einföld skýring á íslensku">
<meta property="og:description" content="${esc(lysing)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css?v=${VERSJON}">
<script>
  (function () {
    var t = null;
    try { t = localStorage.getItem("peningar-theme"); } catch (e) {}
    if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
  })();
</script>
<script type="application/ld+json">${jsonLd(ld)}</script>
${ANALYTICS}
</head>
<body>
<a class="skip-link" href="#main">Fara beint í efni</a>

<nav>
  <a href="/" class="logo" aria-label="peningar.is — forsíða">
    peningar<span>.</span>is
    <span class="logo-sub">fjármál á íslensku</span>
  </a>
  <div class="nav-actions">
    <a class="icon-btn" href="/#hugtok" title="Leita að hugtaki" aria-label="Öll hugtök">🔍 <span class="search-kbd">Öll hugtök</span></a>
    <button class="icon-btn" id="themeBtn" type="button" aria-label="Skipta um þema">🌙</button>
  </div>
</nav>

<main id="main">
  <p class="crumbs"><a href="/">Forsíða</a> › <a href="/#hugtok">Hugtök</a> › ${esc(h.term)}</p>
  <div id="result">
    <article class="card result-card">
      <div class="result-header">
        <div>
          <h1 class="result-term">${esc(h.term)}</h1>
          ${h.aliases?.length ? `<div class="result-aliases">Einnig: ${h.aliases.map(esc).join(", ")}</div>` : ""}
        </div>
        <div class="result-meta"><span class="pill ${f.cls}">${esc(f.nafn)}</span></div>
      </div>
      <div class="result-body">
        <p class="result-explain">${esc(h.explanation)}</p>
        <div class="result-box"><h2 class="h3">🇮🇸 Íslenskt dæmi</h2><p>${esc(h.example)}</p></div>
        ${h.keyNumber ? `<div class="result-box" style="text-align:center"><h2 class="h3">Tala til að þekkja</h2><span class="big-num">${esc(h.keyNumber)}</span><p>${esc(h.keyNumberLabel)}</p></div>` : ""}
        <div class="result-box tip"><h2 class="h3">💡 Gott að vita</h2><p>${esc(h.tip)}</p></div>
        ${rel.length ? `<div class="result-foot"><span class="lbl">Tengd hugtök:</span>${rel.map(chip).join("")}</div>` : ""}
      </div>
    </article>
  </div>
  <div class="more">
    ${somuFlokkur.length ? `<h2 class="section-label">Fleiri hugtök: ${esc(f.nafn)}</h2><div class="chips" style="margin:0 0 1.6rem">${somuFlokkur.map(chip).join("")}</div>` : ""}
    <h2 class="section-label">Meira á peningar.is</h2>
    <div class="chips" style="margin:0">
      <a class="chip" href="/#hugtok">🔍 Öll hugtök</a>
      <a class="chip" href="/#ordabok">📖 Orðabók</a>
      <a class="chip" href="/#reiknivelar">🧮 Reiknivélar</a>
      <a class="chip" href="/#prof">🎯 Próf</a>
    </div>
  </div>
</main>

${FOOTER.replace('<span id="uppfaert"></span>', esc(UPPFAERT))}

<script>
  // Þemahnappur (sama hegðun og á forsíðu)
  (function () {
    var b = document.getElementById("themeBtn"), r = document.documentElement;
    function merkja() { var d = r.getAttribute("data-theme") === "dark"; b.textContent = d ? "☀️" : "🌙"; b.setAttribute("aria-label", d ? "Skipta í ljóst þema" : "Skipta í dökkt þema"); }
    merkja();
    b.onclick = function () {
      var n = r.getAttribute("data-theme") === "dark" ? "light" : "dark";
      r.setAttribute("data-theme", n);
      try { localStorage.setItem("peningar-theme", n); } catch (e) {}
      merkja();
    };
  })();
</script>
</body>
</html>
`;
}

// ── Skrifa dist/ ─────────────────────────────────────────────────
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST);
for (const f of ["css", "js", "data", "favicon.svg", "og-image.png"]) {
  fs.cpSync(path.join(ROT, f), path.join(DIST, f), { recursive: true });
}

// Forsíðan fær algildar slóðir fyrir canonical og og:image
fs.writeFileSync(path.join(DIST, "index.html"), index.replace(
  /<!-- scripts\/build\.mjs bætir við[^>]*-->/,
  `<link rel="canonical" href="${SITE}/">
<meta property="og:url" content="${SITE}/">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">`));

for (const [s, h] of slodir) {
  const mappa = path.join(DIST, "hugtok", s);
  fs.mkdirSync(mappa, { recursive: true });
  fs.writeFileSync(path.join(mappa, "index.html"), hugtakSida(h, s));
}

const idag = new Date().toISOString().slice(0, 10);
const slodirSitemap = [`${SITE}/`, ...[...slodir.keys()].map(s => `${SITE}/hugtok/${s}`)];
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${slodirSitemap.map(u => `  <url><loc>${u}</loc><lastmod>${idag}</lastmod></url>`).join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`);

console.log(`✓ ${slodir.size} hugtakasíður, sitemap.xml (${slodirSitemap.length} slóðir) og robots.txt → dist/ (${SITE}, v=${VERSJON})`);
