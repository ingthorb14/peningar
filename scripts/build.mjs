// ═══════════════════════════════════════════════════════════════════
//  peningar.is — build (keyrt af Vercel, sjá vercel.json)
//  Afritar síðuna í dist/ og býr til:
//    • dist/hugtok/<slug>/index.html — static síða fyrir hvert hugtak (SEO)
//    • dist/blogg/ — listasíða, færslur úr content/blogg/*.md og rss.xml
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
vm.runInContext(lesa("js/saga-gogn.js"), ctx);   // gogn.js les MARKADUR úr SAGA_GOGN
const { HUGTOK, FLOKKAR, UPPFAERT, slug, frettabrefHtml } = vm.runInContext(lesa("js/gogn.js") + "\n;({ HUGTOK, FLOKKAR, UPPFAERT, slug, frettabrefHtml })", ctx);

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

// ── Sameiginleg umgjörð static síðna (hugtök, blogg) ─────────────
const RSS_LINK = `<link rel="alternate" type="application/rss+xml" title="peningar.is — blogg" href="/blogg/rss.xml">`;
const MEIRA = `<h2 class="section-label">Meira á peningar.is</h2>
    <div class="chips" style="margin:0">
      <a class="chip" href="/#hugtok">🔍 Öll hugtök</a>
      <a class="chip" href="/#ordabok">📖 Orðabók</a>
      <a class="chip" href="/#reiknivelar">🧮 Reiknivélar</a>
      <a class="chip" href="/#prof">🎯 Próf</a>
      <a class="chip" href="/blogg/">📝 Blogg</a>
    </div>`;

function sida({ titill, lysing, slod, ogTitill = titill, ogType = "article", ld, efni }) {
  const url = SITE + slod;
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
<meta property="og:type" content="${ogType}">
<meta property="og:locale" content="is_IS">
<meta property="og:site_name" content="peningar.is">
<meta property="og:title" content="${esc(ogTitill)}">
<meta property="og:description" content="${esc(lysing)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${RSS_LINK}
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
${ld ? `<script type="application/ld+json">${jsonLd(ld)}</script>` : ""}
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
${efni}
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

function hugtakSida(h, s) {
  const f = FLOKKAR[h.cat] || FLOKKAR.grunnur;
  // Ekki endurtaka hugtakið ef skýringin byrjar á því
  const lysing = stytta(h.explanation.startsWith(h.term) ? h.explanation : `${h.term}: ${h.explanation}`);
  const rel = (h.related || []).map(r => HUGTOK.find(x => x.term === r)).filter(Boolean);
  const somuFlokkur = HUGTOK.filter(x => x.cat === h.cat && x !== h && !rel.includes(x));
  const chip = x => `<a class="chip" href="/hugtok/${slug(x.term)}">${esc(x.term)}</a>`;
  return sida({
    titill: `${h.term} — einföld skýring | peningar.is`,
    ogTitill: `${h.term} — einföld skýring á íslensku`,
    lysing,
    slod: `/hugtok/${s}`,
    ld: {
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      name: h.term,
      ...(h.aliases?.length ? { alternateName: h.aliases } : {}),
      description: h.explanation,
      url: `${SITE}/hugtok/${s}`,
      inLanguage: "is",
      inDefinedTermSet: { "@type": "DefinedTermSet", name: "Fjármálahugtök á peningar.is", url: SITE + "/" },
    },
    efni: `  <p class="crumbs"><a href="/">Forsíða</a> › <a href="/#hugtok">Hugtök</a> › ${esc(h.term)}</p>
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
    ${frettabrefHtml("hugtak") ? `<div style="margin-bottom:1.8rem">${frettabrefHtml("hugtak")}</div>` : ""}
    ${MEIRA}
  </div>`,
  });
}

// ── Markdown → HTML (lítill þýðandi, engin dependency) ───────────
// Styður: ## fyrirsagnir, málsgreinar, - / 1. listar, > tilvitnanir, ---, | töflur |,
// **feitt**, *skáletrað*, `kóði` og [tengla](slóð). HTML í texta er alltaf escape-að.
function inline(t) {
  return esc(t)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
      const u = url.replace(/&amp;/g, "&");
      if (!/^(https?:\/\/|\/|#|mailto:)/.test(u)) return txt;   // engar javascript:-slóðir
      const ytri = /^https?:\/\//.test(u);
      return `<a href="${esc(u)}"${ytri ? ' target="_blank" rel="noopener"' : ""}>${txt}</a>`;
    });
}
function markdown(md) {
  const linur = md.replace(/\r\n/g, "\n").split("\n"), ut = [];
  let i = 0;
  const erTala = c => /^[≈~\s−\-+]*[\d.,]+\s*(%|kr|m\.kr|ár)?\s*$/.test(c);
  while (i < linur.length) {
    const l = linur[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{2,4})\s+(.*)$/))) { const n = m[1].length; ut.push(`<h${n} id="${slug(m[2])}">${inline(m[2])}</h${n}>`); i++; continue; }
    if (/^---+\s*$/.test(l)) { ut.push("<hr>"); i++; continue; }
    if (/^\|/.test(l) && /^\|[\s:|-]+\|\s*$/.test(linur[i + 1] || "")) {
      const reitir = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const haus = reitir(l), rodir = [];
      i += 2;
      while (i < linur.length && /^\|/.test(linur[i])) rodir.push(reitir(linur[i++]));
      const tala = haus.map((_, k) => rodir.length && rodir.every(r => erTala(r[k] || "")));
      ut.push(`<div class="grein-tafla"><table><thead><tr>${haus.map((c, k) => `<th${tala[k] ? ' class="tala"' : ""}>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rodir.map(r => `<tr>${r.map((c, k) => `<td${tala[k] ? ' class="tala"' : ""}>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^>\s?/.test(l)) {
      const b = [];
      while (i < linur.length && /^>\s?/.test(linur[i])) b.push(linur[i++].replace(/^>\s?/, ""));
      ut.push(`<blockquote>${markdown(b.join("\n"))}</blockquote>`);
      continue;
    }
    if ((m = l.match(/^(\s*)([-*]|\d+\.)\s+/))) {
      const ol = /\d/.test(m[2]), atridi = [];
      while (i < linur.length && /^\s*([-*]|\d+\.)\s+/.test(linur[i])) atridi.push(linur[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      ut.push(`<${ol ? "ol" : "ul"}>${atridi.map(a => `<li>${inline(a)}</li>`).join("")}</${ol ? "ol" : "ul"}>`);
      continue;
    }
    const p = [];
    while (i < linur.length && linur[i].trim() && !/^(#{2,4}\s|>|\||---+\s*$|\s*([-*]|\d+\.)\s+)/.test(linur[i])) p.push(linur[i++].trim());
    ut.push(`<p>${inline(p.join(" "))}</p>`);
  }
  return ut.join("\n");
}

// ── Blogg: content/blogg/*.md með frontmatter (titill, dags, lysing) ─
const MANUDIR_HEIL = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const dagsTexti = iso => { const [y, m, d] = iso.split("-").map(Number); return `${d}. ${MANUDIR_HEIL[m - 1]} ${y}`; };
const BLOGG_MAPPA = path.join(ROT, "content", "blogg");
const faerslur = (fs.existsSync(BLOGG_MAPPA) ? fs.readdirSync(BLOGG_MAPPA) : [])
  .filter(f => f.endsWith(".md"))
  .map(f => {
    const txt = fs.readFileSync(path.join(BLOGG_MAPPA, f), "utf8");
    const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!m) throw new Error(`Vantar frontmatter í content/blogg/${f}`);
    const fm = Object.fromEntries(m[1].split(/\r?\n/).filter(l => l.includes(":")).map(l => {
      const k = l.indexOf(":");
      return [l.slice(0, k).trim(), l.slice(k + 1).trim().replace(/^["']|["']$/g, "")];
    }));
    for (const k of ["titill", "dags", "lysing"]) if (!fm[k]) throw new Error(`Vantar „${k}“ í frontmatter í content/blogg/${f}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.dags)) throw new Error(`dags verður að vera YYYY-MM-DD í content/blogg/${f}`);
    return { ...fm, slug: f.replace(/\.md$/, ""), html: markdown(m[2]) };
  })
  .sort((a, b) => (a.dags < b.dags ? 1 : -1));

function bloggFaersla(f) {
  return sida({
    titill: `${f.titill} | peningar.is`,
    ogTitill: f.titill,
    lysing: f.lysing,
    slod: `/blogg/${f.slug}`,
    ld: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: f.titill,
      description: f.lysing,
      datePublished: f.dags,
      inLanguage: "is",
      url: `${SITE}/blogg/${f.slug}`,
      image: OG_IMAGE,
      publisher: { "@type": "Organization", name: "peningar.is", url: SITE + "/" },
    },
    efni: `  <p class="crumbs"><a href="/">Forsíða</a> › <a href="/blogg/">Blogg</a> › ${esc(f.titill)}</p>
  <article class="grein">
    <h1>${esc(f.titill)}</h1>
    <p class="grein-meta"><time datetime="${f.dags}">${dagsTexti(f.dags)}</time></p>
    <div class="grein-efni">
${f.html}
    </div>
  </article>
  <div class="more">
    ${frettabrefHtml("blogg") ? `<div style="margin-bottom:1.8rem">${frettabrefHtml("blogg")}</div>` : ""}
    ${MEIRA}
  </div>`,
  });
}

function bloggListi() {
  return sida({
    titill: "Blogg — fjármál á íslensku | peningar.is",
    ogTitill: "Blogg á peningar.is",
    lysing: "Greinar um íslensk fjármál á mannamáli: lán, vexti, verðbólgu, sparnað og skatta.",
    slod: "/blogg/",
    ogType: "website",
    efni: `  <div class="page-hero">
    <h1>Blogg<br><em>um fjármál</em></h1>
    <p>Greinar um íslensk fjármál á mannamáli. <a href="/blogg/rss.xml">RSS-straumur</a></p>
  </div>
  <div class="wrap">
    <div class="blogg-listi">
${faerslur.map(f => `      <a class="card blogg-kort" href="/blogg/${f.slug}"><time datetime="${f.dags}">${dagsTexti(f.dags)}</time><h2>${esc(f.titill)}</h2><p>${esc(f.lysing)}</p></a>`).join("\n") || "      <p>Engar færslur enn.</p>"}
    </div>
  </div>
  <div class="more">
    ${frettabrefHtml("bloggListi") ? `<div style="margin-bottom:1.8rem">${frettabrefHtml("bloggListi")}</div>` : ""}
    ${MEIRA}
  </div>`,
  });
}

// RSS 2.0 — pubDate á RFC 822 sniði
function rss() {
  const rfc822 = iso => new Date(iso + "T12:00:00Z").toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>peningar.is — blogg</title>
  <link>${SITE}/blogg/</link>
  <atom:link href="${SITE}/blogg/rss.xml" rel="self" type="application/rss+xml"/>
  <description>Greinar um íslensk fjármál á mannamáli.</description>
  <language>is</language>
${faerslur.map(f => `  <item>
    <title>${esc(f.titill)}</title>
    <link>${SITE}/blogg/${f.slug}</link>
    <guid isPermaLink="true">${SITE}/blogg/${f.slug}</guid>
    <pubDate>${rfc822(f.dags)}</pubDate>
    <description>${esc(f.lysing)}</description>
  </item>`).join("\n")}
</channel>
</rss>
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
<meta property="og:image:height" content="630">
${RSS_LINK}`));

for (const [s, h] of slodir) {
  const mappa = path.join(DIST, "hugtok", s);
  fs.mkdirSync(mappa, { recursive: true });
  fs.writeFileSync(path.join(mappa, "index.html"), hugtakSida(h, s));
}

fs.mkdirSync(path.join(DIST, "blogg"), { recursive: true });
fs.writeFileSync(path.join(DIST, "blogg", "index.html"), bloggListi());
fs.writeFileSync(path.join(DIST, "blogg", "rss.xml"), rss());
for (const f of faerslur) {
  fs.mkdirSync(path.join(DIST, "blogg", f.slug), { recursive: true });
  fs.writeFileSync(path.join(DIST, "blogg", f.slug, "index.html"), bloggFaersla(f));
}

const idag = new Date().toISOString().slice(0, 10);
const slodirSitemap = [
  [`${SITE}/`, idag],
  ...[...slodir.keys()].map(s => [`${SITE}/hugtok/${s}`, idag]),
  [`${SITE}/blogg/`, faerslur[0]?.dags || idag],
  ...faerslur.map(f => [`${SITE}/blogg/${f.slug}`, f.dags]),
];
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${slodirSitemap.map(([u, d]) => `  <url><loc>${u}</loc><lastmod>${d}</lastmod></url>`).join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`);

console.log(`✓ ${slodir.size} hugtakasíður, ${faerslur.length} bloggfærslur + rss.xml, sitemap.xml (${slodirSitemap.length} slóðir) og robots.txt → dist/ (${SITE}, v=${VERSJON})`);
