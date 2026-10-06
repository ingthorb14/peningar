// ═══════════════════════════════════════════════════════════════════
//  peningar.is — viðmót
// ═══════════════════════════════════════════════════════════════════
"use strict";

// ── HJÁLPARFÖLL ──────────────────────────────────────────────────
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// norm() og slug() eru í gogn.js (build-skriftan notar þau líka)
// Hvert hugtak á eigin static síðu (búin til af scripts/build.mjs). Gamlar #hugtok/<slug> slóðir virka enn.
const hugtakSlod = term => "/hugtok/" + slug(term);

const nf0 = { format: n => tala(n, 0) };
const nf2 = { format: n => tala(n, 2) };
const MANUDIR = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
const dagsetning = iso => { const [y, m, d] = iso.split("-").map(Number); return `${d}. ${MANUDIR[m - 1]} ${y}`; };
const kr = n => nf0.format(Math.round(n)) + " kr";
const mkr = n => Math.abs(n) >= 1e6 ? nf2.format(Math.round(n / 1e5) / 10) + " m.kr" : kr(n);
// Les bæði „1.234.567,5“ og „1234567.5“
function parseNum(s) {
  s = String(s).replace(/[\s\u00a0kr]/g, "").replace(/−/g, "-");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ── LEIÐARKERFI (#flipi/undirsíða) ───────────────────────────────
const TABS = ["hugtok", "ordabok", "reiknivelar", "prof", "saga", "fraedast", "fyrirtaeki"];
const onEnter = {};

function route() {
  const [tab, sub] = decodeURIComponent(location.hash.slice(1)).split("/");
  const name = TABS.includes(tab) ? tab : "hugtok";
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
  $$(".tab-btn").forEach(b => {
    const on = b.dataset.tab === name;
    b.setAttribute("aria-selected", on);
    b.tabIndex = on ? 0 : -1;
    if (on) {
      if (!valmyndOpin()) b.scrollIntoView({ block: "nearest", inline: "nearest" });
      $("#menuLabel").textContent = b.textContent.replace(/^\S+\s/, "");   // án emoji
    }
  });
  lokaValmynd($("#tabBar").contains(document.activeElement));   // val í valmynd lokar henni
  onEnter[name]?.(sub);
}
window.addEventListener("hashchange", route);

// ── MARKAÐSTÖLUR & GENGI ─────────────────────────────────────────
const MYNTIR = ["ISK", "EUR", "USD", "GBP", "DKK", "NOK", "SEK", "CHF", "JPY", "CAD", "PLN"];
const MYNT_NOFN = { ISK: "Íslensk króna", EUR: "Evra", USD: "Bandaríkjadalur", GBP: "Sterlingspund", DKK: "Dönsk króna", NOK: "Norsk króna", SEK: "Sænsk króna", CHF: "Svissneskur franki", JPY: "Japanskt jen", CAD: "Kanadadalur", PLN: "Pólskt slot" };
let gengi = { live: false, dags: MARKADUR.gengiVara.dags, perEUR: null };

// Varagildi: ISK á hverja einingu → einingar á hverja evru
(function () {
  const g = MARKADUR.gengiVara, perEUR = { EUR: 1, ISK: g.EUR };
  for (const k of ["USD", "GBP", "DKK", "NOK", "SEK"]) perEUR[k] = g.EUR / g[k];
  gengi.perEUR = perEUR;
})();
const iskPer = cur => gengi.perEUR[cur] ? gengi.perEUR.ISK / gengi.perEUR[cur] : null;

async function saekjaGengi() {
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=" + MYNTIR.filter(m => m !== "EUR").join(","));
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (!d.rates?.ISK) throw new Error("vantar ISK");
    gengi = { live: true, dags: dagsetning(d.date), perEUR: { EUR: 1, ...d.rates } };
  } catch (e) { /* varagildi haldast */ }
  teiknaTicker();
  teiknaStats();
  reikna.gengi?.();
}

function teiknaTicker() {
  const m = MARKADUR;
  const fx = ["EUR", "USD", "GBP", "DKK"].map(c => `<span class="${gengi.live ? "live" : ""}">${c}/ISK<b>${nf2.format(iskPer(c))}</b></span>`).join("");
  const macro = `
    <span class="neg">Verðbólga<b>${pct(m.verdbolga.gildi)}</b></span>
    <span>Stýrivextir<b>${pct(m.styrivextir.gildi)}</b></span>
    <span>Verðbólgumarkmið<b>${pct(m.verdbolgumarkmid)}</b></span>
    <span>Raunstýrivextir<b>${pct(m.styrivextir.gildi - m.verdbolga.gildi)}</b></span>
    <span>VNV<b>${nf2.format(m.vnv.gildi)}</b></span>
    <span>Persónuafsláttur<b>${nf0.format(SKATTUR.personuafslattur)} kr/mán</b></span>`;
  const one = fx + macro;
  $("#ticker").innerHTML = `<div style="display:contents">${one}</div><div style="display:contents" aria-hidden="true">${one}</div>`;
}

function teiknaStats() {
  const el = $("#stats");
  if (!el) return;
  const m = MARKADUR;
  el.innerHTML = [
    ["Stýrivextir", pct(m.styrivextir.gildi), m.styrivextir.dags, m.styrivextir.heimild],
    ["Verðbólga", pct(m.verdbolga.gildi), m.verdbolga.dags + " · markmið 2,5%", m.verdbolga.heimild],
    ["EUR/ISK", nf2.format(iskPer("EUR")), (gengi.live ? "Lifandi · " : "") + gengi.dags, "#reiknivelar/gengi"],
    ["USD/ISK", nf2.format(iskPer("USD")), (gengi.live ? "Lifandi · " : "") + gengi.dags, "#reiknivelar/gengi"],
  ].map(([l, v, s, h]) => `<a class="card stat" href="${h}" ${h.startsWith("http") ? 'target="_blank" rel="noopener"' : ""} style="text-decoration:none;color:inherit">
      <div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></a>`).join("");
}

// ── HUGTÖK: LEIT ─────────────────────────────────────────────────
const IDX = HUGTOK.map(h => ({ h, id: slug(h.term), t: norm(h.term), a: (h.aliases || []).map(norm), x: norm(h.explanation + " " + h.hint) }));

function leita(q, max = 8) {
  const n = norm(q.trim());
  if (!n) return [];
  const res = [];
  for (const it of IDX) {
    let s = 0;
    if (it.t === n) s = 100;
    else if (it.a.includes(n)) s = 95;
    else if (it.t.startsWith(n)) s = 80;
    else if (it.a.some(a => a.startsWith(n))) s = 70;
    else if (it.t.includes(n)) s = 60;
    else if (it.a.some(a => a.includes(n))) s = 50;
    else if (n.length > 2 && it.x.includes(n)) s = 20;
    if (s) res.push({ ...it, s });
  }
  return res.sort((a, b) => b.s - a.s || a.t.length - b.t.length).slice(0, max);
}

function teiknaHugtak(h, fromAI = false) {
  const f = FLOKKAR[h.cat] || FLOKKAR.grunnur;
  const rel = (h.related || []).map(r => HUGTOK.find(x => x.term === r)).filter(Boolean);
  $("#result").innerHTML = `<article class="card result-card">
    <div class="result-header">
      <div>
        <h2 class="result-term">${esc(h.term)}</h2>
        ${h.aliases?.length ? `<div class="result-aliases">Einnig: ${h.aliases.map(esc).join(", ")}</div>` : ""}
      </div>
      <div class="result-meta">
        <span class="pill ${f.cls}">${fromAI ? "Gervigreind" : f.nafn}</span>
        ${fromAI ? "" : `<button class="icon-btn" type="button" data-share="${slug(h.term)}" title="Afrita tengil">🔗</button>`}
      </div>
    </div>
    <div class="result-body">
      <p class="result-explain">${esc(h.explanation)}</p>
      <div class="result-box"><h3>🇮🇸 Íslenskt dæmi</h3><p>${esc(h.example)}</p></div>
      ${h.keyNumber ? `<div class="result-box" style="text-align:center"><h3>Tala til að þekkja</h3><span class="big-num">${esc(h.keyNumber)}</span><p>${esc(h.keyNumberLabel)}</p></div>` : ""}
      <div class="result-box tip"><h3>💡 Gott að vita</h3><p>${esc(h.tip)}</p></div>
      ${rel.length ? `<div class="result-foot"><span class="lbl">Tengd hugtök:</span>${rel.map(r => `<a class="chip" href="${hugtakSlod(r.term)}">${esc(r.term)}</a>`).join("")}</div>` : ""}
      ${fromAI ? `<p class="ai-note">Þessi skýring var búin til af gervigreind og getur innihaldið villur. Sannreyndu mikilvægar upplýsingar.</p>` : ""}
    </div>
  </article>`;
}

async function ekkiFannst(q) {
  const dict = await hladaOrdabok().catch(() => null);
  const n = norm(q);
  const hits = dict ? dict.filter(e => e.ne.includes(n) || e.ni.includes(n)).slice(0, 6) : [];
  $("#result").innerHTML = `<div class="card result-empty">
    <h2 class="result-term" style="margin-bottom:0.5rem">„${esc(q)}“</h2>
    <p>Þetta hugtak er ekki enn í safninu okkar.${hits.length ? " En það kemur fyrir í orðabókinni:" : ""}</p>
    ${hits.length ? `<div class="dict-hits">${hits.map(e => `<div><span>${esc(e.en)}</span><span>${esc(e.is)}</span></div>`).join("")}</div>
      <p><a href="#ordabok" data-dictq="${esc(q)}">Sjá allt í orðabókinni →</a></p>` : ""}
    <div class="chips" id="noResultActions"></div>
  </div>`;
  const el = $("#noResultActions");
  const ai = await aiTiltaek();
  if (!el.isConnected) return;   // ný leit hefur þegar teiknað yfir
  if (ai) {
    el.innerHTML = `<button class="btn btn-sm" type="button" id="askAI">✨ Biðja gervigreind um skýringu</button>`;
    $("#askAI").onclick = () => spyrjaGervigreind(q);
  } else {
    const efni = encodeURIComponent("Tillaga að hugtaki: " + q);
    el.innerHTML = (hits.length ? "" : `<a class="chip" href="#ordabok">📖 Skoða orðabókina</a>`) +
      (NETFANG ? `<a class="chip" href="mailto:${NETFANG}?subject=${efni}">✉️ Stingdu upp á hugtaki</a>` : "");
  }
}

// Er AI-skýring virk? GET á /api/explain svarar { virkt } án kostnaðar. Athugað einu sinni.
// Á localhost með einföldum vefþjóni (npx serve / python) er ekkert /api — sleppum þá
// beiðninni svo 404 birtist ekki í console. `vercel dev` keyrir á porti 3000.
let aiPromise = null;
function aiTiltaek() {
  const stadbundid = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== "3000";
  aiPromise ??= stadbundid ? Promise.resolve(false) : fetch("/api/explain")
    .then(r => r.ok ? r.json() : {})
    .then(d => d.virkt === true)
    .catch(() => false);
  return aiPromise;
}

async function spyrjaGervigreind(q) {
  $("#result").innerHTML = `<div class="card"><div class="loading"><div class="dots"><span></span><span></span><span></span></div> Útbý skýringu á „${esc(q)}“…</div></div>`;
  try {
    const r = await fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ term: q }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.explanation) throw new Error(d.error || r.status);
    teiknaHugtak({ term: d.term || q, cat: "grunnur", explanation: d.explanation, example: d.example || "", tip: d.tip || "" }, true);
  } catch (e) {
    $("#result").innerHTML = `<div class="card result-empty"><p>Ekki tókst að sækja skýringu núna. Reyndu aftur síðar eða leitaðu að öðru orði.</p></div>`;
  }
}

function syna(q, { scroll = true } = {}) {
  q = q.trim();
  if (!q) return;
  lokaTillogum();
  $("#searchInput").value = q;
  const best = leita(q, 1)[0];
  if (best && best.s >= 50) {
    teiknaHugtak(best.h);
    if (location.hash !== "#hugtok/" + best.id) history.replaceState(null, "", "#hugtok/" + best.id);
  } else {
    ekkiFannst(q);
  }
  if (scroll) requestAnimationFrame(() => $("#result").scrollIntoView({ behavior: "smooth", block: "start" }));
}

// Tillögur (autocomplete) með lyklaborðsstýringu
let sugIdx = -1;
function lokaTillogum() { $("#suggest").hidden = true; $("#searchInput").setAttribute("aria-expanded", "false"); sugIdx = -1; }
function syndTillogur() {
  const q = $("#searchInput").value;
  const list = leita(q, 6);
  const ul = $("#suggest");
  if (!q.trim() || !list.length) return lokaTillogum();
  ul.innerHTML = list.map((it, i) => `<li role="option" id="sug-${i}" data-term="${esc(it.h.term)}" aria-selected="false"><span>${esc(it.h.term)}</span><small>${esc(it.h.hint)}</small></li>`).join("");
  ul.hidden = false;
  $("#searchInput").setAttribute("aria-expanded", "true");
  sugIdx = -1;
}
function merkjaTillogu(i) {
  const items = $$("#suggest li");
  if (!items.length) return;
  sugIdx = (i + items.length) % items.length;
  items.forEach((li, j) => li.setAttribute("aria-selected", j === sugIdx));
  $("#searchInput").setAttribute("aria-activedescendant", "sug-" + sugIdx);
}

function initHugtok() {
  const inp = $("#searchInput");
  inp.addEventListener("input", syndTillogur);
  inp.addEventListener("keydown", e => {
    if ($("#suggest").hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); merkjaTillogu(sugIdx + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); merkjaTillogu(sugIdx - 1); }
    else if (e.key === "Escape") lokaTillogum();
    else if (e.key === "Enter" && sugIdx >= 0) { e.preventDefault(); syna($$("#suggest li")[sugIdx].dataset.term); }
  });
  $("#suggest").addEventListener("mousedown", e => {
    const li = e.target.closest("li");
    if (li) { e.preventDefault(); syna(li.dataset.term); }
  });
  inp.addEventListener("blur", () => setTimeout(lokaTillogum, 100));
  $("#searchForm").addEventListener("submit", e => { e.preventDefault(); syna(inp.value); });

  $("#quickPicks").innerHTML = ["Verðbólga", "Stýrivextir", "Verðtrygging", "Séreignarsparnaður", "ETF", "Persónuafsláttur", "Greiðslubyrðarhlutfall", "Raunvextir"]
    .map(t => `<a class="chip" href="${hugtakSlod(t)}">${t}</a>`).join("");

  // Yfirlitstölur fyrir ofan hugtakaspjöldin
  const wrap = $("#view-hugtok .wrap");
  wrap.insertAdjacentHTML("afterbegin", `<h2 class="section-label">Staðan í dag</h2><div class="stats" id="stats"></div>${grafHtml()}`);
  teiknaStats();
  initGraf();

  const cats = ["all", ...Object.keys(FLOKKAR)];
  $("#catFilter").innerHTML = cats.map(c => `<button class="chip${c === "all" ? " active" : ""}" type="button" data-cat="${c}">${c === "all" ? "Allt" : FLOKKAR[c].nafn}</button>`).join("");
  const teiknaSpjold = cat => {
    $("#cardGrid").innerHTML = HUGTOK.filter(h => cat === "all" || h.cat === cat)
      .map(h => `<a class="glossary-card" href="${hugtakSlod(h.term)}" style="text-decoration:none"><span class="ct">${esc(h.term)}</span><span class="ch">${esc(h.hint)}</span></a>`).join("");
  };
  $("#catFilter").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    $$("#catFilter .chip").forEach(x => x.classList.toggle("active", x === b));
    teiknaSpjold(b.dataset.cat);
  });
  teiknaSpjold("all");

  $("#result").addEventListener("click", e => {
    const s = e.target.closest("[data-share]");
    if (s) {
      const url = location.origin + "/hugtok/" + s.dataset.share;
      (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => toast("Tengill afritaður 🔗"), () => prompt("Afritaðu tengilinn:", url));
    }
    const d = e.target.closest("[data-dictq]");
    if (d) { e.preventDefault(); location.hash = "ordabok"; setTimeout(() => { $("#dictInput").value = d.dataset.dictq; renderDict(true); }, 0); }
  });
}
onEnter.hugtok = sub => {
  teiknaGraf();   // flipinn var falinn þegar grafið var búið til (breidd 0)
  if (!sub) return;
  const h = HUGTOK.find(x => slug(x.term) === sub);
  if (h) { $("#searchInput").value = h.term; teiknaHugtak(h); requestAnimationFrame(() => $("#result").scrollIntoView({ behavior: "smooth", block: "start" })); }
};

// ── GRAF: STÝRIVEXTIR & VERÐBÓLGA (gögn úr js/saga-gogn.js) ─────
// Tími er táknaður sem ár með broti: mars 2008 → 2008 + 2/12
const tAr = (y, m, d = 1) => y + (m - 1) / 12 + (d - 1) / 365;
const VB_SAGA = (() => {
  const [y0, m0] = SAGA_GOGN.verdbolga.fra.split("-").map(Number);
  return SAGA_GOGN.verdbolga.gildi.map((v, k) => {
    const y = y0 + Math.floor((m0 - 1 + k) / 12), m = (m0 - 1 + k) % 12 + 1;
    return { y, m, t: tAr(y, m), v };
  });
})();
const SV_SAGA = SAGA_GOGN.styrivextir.map(([d, v]) => { const [y, m, dd] = d.split("-").map(Number); return { t: tAr(y, m, dd), v }; });
// Meginvextir í gildi á tíma t (þrepafall)
const styrivextirA = t => { let v = SV_SAGA[0].v; for (const s of SV_SAGA) { if (s.t <= t) v = s.v; else break; } return v; };
const GRAF_ENDIR = VB_SAGA[VB_SAGA.length - 1].t + 1 / 12;   // lok síðasta mælda mánaðar
const graf = { ar: 10, idx: null };

function grafHtml() {
  return `<div class="card graf" id="graf">
    <div class="graf-head">
      <h3 class="graf-titill">Stýrivextir og verðbólga</h3>
      <div class="chips graf-bil" role="group" aria-label="Tímabil">
        ${[[5, "5 ár"], [10, "10 ár"], [0, "Allt"]].map(([a, t]) => `<button class="chip" type="button" data-ar="${a}">${t}</button>`).join("")}
      </div>
    </div>
    <div class="graf-svaedi">
      <svg class="graf-svg" tabindex="0" role="img"></svg>
      <div class="graf-tip" aria-live="polite" hidden></div>
    </div>
    <div class="legend">
      <span><i style="background:var(--red)"></i>Ársverðbólga</span>
      <span><i style="background:var(--teal)"></i>Stýrivextir (meginvextir SÍ)</span>
      <span><i class="dash"></i>Verðbólgumarkmið ${pct(MARKADUR.verdbolgumarkmid)}</span>
    </div>
    <p class="note">Heimildir: <a href="https://px.hagstofa.is/pxis/pxweb/is/Efnahagur/Efnahagur__visitolur__1_vnv__1_vnv/VIS01000.px" target="_blank" rel="noopener">Hagstofa Íslands</a> (vísitala neysluverðs) og
      <a href="https://sedlabanki.is/gagnatorg/vextir/" target="_blank" rel="noopener">Seðlabanki Íslands</a> (meginvextir). Gögn til ${MANUDIR[VB_SAGA.at(-1).m - 1]} ${VB_SAGA.at(-1).y}. Músin, fingur eða örvatakkar sýna gildi hvers mánaðar.</p>
  </div>`;
}

// Snyrtileg skref á y-ás (1, 2, 2,5, 5 …) svo línur verði 4–6
function grafSkref(max) {
  const groft = max / 5, p = Math.pow(10, Math.floor(Math.log10(groft)));
  return [1, 2, 2.5, 5, 10].map(k => k * p).find(k => k >= groft);
}

function teiknaGraf() {
  const svg = $("#graf .graf-svg");
  const W = Math.round(svg.parentElement.clientWidth);
  if (!W) return;                                    // flipinn er falinn
  const H = Math.round(Math.min(320, Math.max(220, W * 0.42)));
  const P = { l: 34, r: 10, t: 12, b: 24 };
  const t0 = graf.ar ? GRAF_ENDIR - graf.ar : VB_SAGA[0].t;
  const vb = VB_SAGA.filter(d => d.t >= t0 - 1e-9);
  const sv = [{ t: t0, v: styrivextirA(t0) }, ...SV_SAGA.filter(s => s.t > t0 && s.t < GRAF_ENDIR)];
  const max = Math.max(MARKADUR.verdbolgumarkmid, ...vb.map(d => d.v), ...sv.map(s => s.v));
  const min = Math.min(0, ...vb.map(d => d.v));
  const skref = grafSkref(max - min), yMax = Math.ceil(max / skref) * skref, yMin = Math.floor(min / skref) * skref;
  const x = t => P.l + (t - t0) / (GRAF_ENDIR - t0) * (W - P.l - P.r);
  const y = v => P.t + (1 - (v - yMin) / (yMax - yMin)) * (H - P.t - P.b);
  const f = n => n.toFixed(1);

  let grid = "";
  for (let v = yMin; v <= yMax + 1e-9; v += skref) {
    grid += `<line class="g-grid" x1="${P.l}" x2="${W - P.r}" y1="${f(y(v))}" y2="${f(y(v))}"/><text x="${P.l - 6}" y="${f(y(v) + 3.5)}" text-anchor="end">${tala(v, 1)}%</text>`;
  }
  // Ártöl á x-ás: bil fer eftir breidd og tímabili
  const arBil = [1, 2, 4, 5].find(k => (W - P.l - P.r) / ((GRAF_ENDIR - t0) / k) >= 46);
  for (let a = Math.ceil(t0); a < GRAF_ENDIR; a++) {
    if (a % arBil) continue;
    grid += `<line class="g-tick" x1="${f(x(a))}" x2="${f(x(a))}" y1="${H - P.b}" y2="${H - P.b + 4}"/><text x="${f(x(a))}" y="${H - 6}" text-anchor="middle">${a}</text>`;
  }
  const markmid = `<line class="g-mark" x1="${P.l}" x2="${W - P.r}" y1="${f(y(MARKADUR.verdbolgumarkmid))}" y2="${f(y(MARKADUR.verdbolgumarkmid))}"/>`;
  const vbLina = vb.map((d, i) => `${i ? "L" : "M"}${f(x(d.t))},${f(y(d.v))}`).join("");
  // Stýrivextir sem þrepalína: lárétt þar til næsta ákvörðun tekur gildi
  let svLina = `M${f(x(sv[0].t))},${f(y(sv[0].v))}`;
  for (const s of sv.slice(1)) svLina += `H${f(x(s.t))}V${f(y(s.v))}`;
  svLina += `H${f(x(GRAF_ENDIR))}`;

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W); svg.setAttribute("height", H);
  const sidast = vb.at(-1);
  svg.setAttribute("aria-label", `Línurit: ársverðbólga og stýrivextir frá ${vb[0].y}. Nýjast (${MANUDIR[sidast.m - 1]} ${sidast.y}): verðbólga ${pct(sidast.v)}, stýrivextir ${pct(styrivextirA(sidast.t + 1 / 12 - 1e-6))}.`);
  svg.innerHTML = `${grid}${markmid}
    <path class="g-sv" d="${svLina}"/><path class="g-vb" d="${vbLina}"/>
    <g class="g-hover" visibility="hidden"><line class="g-cursor" y1="${P.t}" y2="${H - P.b}"/><circle class="g-dot-vb" r="4"/><circle class="g-dot-sv" r="4"/></g>`;
  Object.assign(graf, { vb, x, y, W });
  if (graf.idx != null) syndGrafGildi(Math.min(graf.idx, vb.length - 1));
}

function syndGrafGildi(i) {
  const { vb, x, y, W } = graf, d = vb[i];
  if (!d) return;
  graf.idx = i;
  const sv = styrivextirA(d.t + 1 / 12 - 1e-6);       // í gildi í lok mánaðar
  const g = $("#graf .g-hover"), X = x(d.t);
  g.setAttribute("visibility", "visible");
  $("line", g).setAttribute("x1", X); $("line", g).setAttribute("x2", X);
  $(".g-dot-vb", g).setAttribute("cx", X); $(".g-dot-vb", g).setAttribute("cy", y(d.v));
  $(".g-dot-sv", g).setAttribute("cx", X); $(".g-dot-sv", g).setAttribute("cy", y(sv));
  const tip = $("#graf .graf-tip");
  tip.innerHTML = `<b>${MANUDIR[d.m - 1]} ${d.y}</b>
    <span><i style="background:var(--red)"></i>Verðbólga ${pct(d.v)}</span>
    <span><i style="background:var(--teal)"></i>Stýrivextir ${pct(sv)}</span>
    <span class="tip-sub">Raunstýrivextir ${pct(sv - d.v)}</span>`;
  tip.hidden = false;
  // Tooltip vinstra megin við línuna ef hún er hægra megin á grafinu
  const haegri = X > W * 0.55;
  tip.style.left = haegri ? "" : `${X + 12}px`;
  tip.style.right = haegri ? `${W - X + 12}px` : "";
}
function feljaGrafGildi() {
  graf.idx = null;
  $("#graf .g-hover")?.setAttribute("visibility", "hidden");
  $("#graf .graf-tip").hidden = true;
}

function initGraf() {
  const svg = $("#graf .graf-svg");
  const veljaTimabil = ar => {
    graf.ar = ar;
    $$("#graf .graf-bil .chip").forEach(b => { const on = +b.dataset.ar === ar; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
    feljaGrafGildi();
    teiknaGraf();
  };
  $("#graf .graf-bil").addEventListener("click", e => { const b = e.target.closest("[data-ar]"); if (b) veljaTimabil(+b.dataset.ar); });
  // Mús og snerting: næsti mánuður við bendilinn
  const benda = e => {
    if (!graf.vb) return;
    const r = svg.getBoundingClientRect(), X = (e.clientX - r.left) * graf.W / r.width;
    let best = 0, bd = Infinity;
    graf.vb.forEach((d, i) => { const dd = Math.abs(graf.x(d.t) - X); if (dd < bd) { bd = dd; best = i; } });
    syndGrafGildi(best);
  };
  svg.addEventListener("pointermove", benda);
  svg.addEventListener("pointerdown", benda);
  svg.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") feljaGrafGildi(); });
  document.addEventListener("pointerdown", e => { if (graf.idx != null && !e.target.closest("#graf")) feljaGrafGildi(); });
  // Lyklaborð: ←/→ mánuð, Home/End
  svg.addEventListener("focus", () => syndGrafGildi(graf.idx ?? graf.vb.length - 1));
  svg.addEventListener("blur", feljaGrafGildi);
  svg.addEventListener("keydown", e => {
    const n = graf.vb.length, i = graf.idx ?? n - 1;
    const j = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: n - 1, PageUp: i - 12, PageDown: i + 12 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    syndGrafGildi(Math.max(0, Math.min(n - 1, j)));
  });
  // Teikna aftur í nýrri breidd. ResizeObserver nær flestu; resize er varaleið (t.d. snúningur á síma)
  const endurteikna = debounce(teiknaGraf, 60);
  new ResizeObserver(endurteikna).observe(svg.parentElement);
  window.addEventListener("resize", endurteikna);
  veljaTimabil(10);
}

// ── ORÐABÓK ──────────────────────────────────────────────────────
let DICT = null, dictPromise = null, dictFilter = "all", dictLimit = 100;
function hladaOrdabok() {
  if (DICT) return Promise.resolve(DICT);
  dictPromise ??= fetch("data/ordabok.json?v=" + VERSJON).then(r => r.json()).then(rows => {
    DICT = rows.map(([en, is]) => ({ en, is, ne: norm(en), ni: norm(is) }));
    return DICT;
  });
  return dictPromise;
}

function highlight(text, n) {
  if (!n) return esc(text);
  const hay = norm(text);
  let out = "", i = 0, j;
  while ((j = hay.indexOf(n, i)) !== -1) {
    out += esc(text.slice(i, j)) + "<mark>" + esc(text.slice(j, j + n.length)) + "</mark>";
    i = j + n.length;
  }
  return out + esc(text.slice(i));
}

function renderDict(reset) {
  if (!DICT) return;
  if (reset) dictLimit = 100;
  const n = norm($("#dictInput").value.trim());
  let rows = DICT;
  if (n) {
    rows = DICT.filter(e => dictFilter === "en" ? e.ne.includes(n) : dictFilter === "is" ? e.ni.includes(n) : e.ne.includes(n) || e.ni.includes(n));
    const key = e => (dictFilter === "is" ? e.ni : e.ne);
    const rank = e => key(e) === n ? 0 : key(e).startsWith(n) ? 1 : 2;
    rows = rows.map(e => [rank(e), e]).sort((a, b) => a[0] - b[0] || a[1].en.length - b[1].en.length).map(x => x[1]);
  }
  const show = rows.slice(0, dictLimit);
  $("#dictBody").innerHTML = show.map(e => `<tr><td class="en-col">${dictFilter === "is" ? esc(e.en) : highlight(e.en, n)}</td><td>${dictFilter === "en" ? esc(e.is) : highlight(e.is, n)}</td></tr>`).join("");
  $("#dictNoResults").hidden = rows.length > 0;
  $("#dictMore").hidden = rows.length <= dictLimit;
  $("#dictCount").textContent = n ? `${nf0.format(rows.length)} niðurstöður` : `${nf0.format(DICT.length)} hugtök`;
}

function initOrdabok() {
  $("#dictInput").addEventListener("input", debounce(() => renderDict(true), 120));
  $("#dictFilter").addEventListener("click", e => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    dictFilter = b.dataset.f;
    $$("#dictFilter .chip").forEach(x => x.classList.toggle("active", x === b));
    renderDict(true);
  });
  $("#dictMore button").addEventListener("click", () => { dictLimit += 200; renderDict(false); });
}
let ordabokTilbuin = false;
onEnter.ordabok = async () => {
  if (ordabokTilbuin) return;
  ordabokTilbuin = true;
  try {
    await hladaOrdabok();
    const dayIdx = Math.floor(Date.now() / 864e5);
    const pool = DICT.filter(e => e.en.includes(" ") && e.is.length < 40);
    const w = pool[dayIdx % pool.length];
    $("#wotd").innerHTML = `<div><div class="k">Orð dagsins</div><div class="w">${esc(w.en)}</div><div class="t">${esc(w.is)}</div></div>
      <button class="btn btn-ghost btn-sm" type="button" id="randWord">🎲 Annað orð</button>`;
    $("#randWord").onclick = () => {
      const r = pool[Math.floor(Math.random() * pool.length)];
      $("#wotd .k").textContent = "Orð af handahófi";
      $("#wotd .w").textContent = r.en;
      $("#wotd .t").textContent = r.is;
    };
    renderDict(true);
  } catch (e) {
    ordabokTilbuin = false;
    dictPromise = null;
    $("#dictCount").textContent = "Ekki tókst að hlaða orðabókinni.";
  }
};

// ── REIKNIVÉLAR ──────────────────────────────────────────────────
const reikna = {};
const val = id => { const el = $("#" + id); return el.dataset.money !== undefined || el.type === "text" ? parseNum(el.value) : +el.value; };

function lanaGreidsla(L, rAr, n) {
  const r = rAr / 100 / 12;
  return r > 0 ? L * r / (1 - Math.pow(1 + r, -n)) : L / n;
}

// Einföld línurit í SVG — `series` = [{ values, color, label, fill? }]
// Á litlum skjá (≤ 400px) er hnitakerfið mjórra svo textinn minnki ekki of mikið
const LITILL_SKJAR = matchMedia("(max-width:400px)");
function linurit(series, years, { unit = mkr } = {}) {
  const W = LITILL_SKJAR.matches ? 300 : 420, H = LITILL_SKJAR.matches ? 210 : 190, P = { l: 52, r: 8, t: 10, b: 22 };
  const max = Math.max(...series.flatMap(s => s.values)) * 1.05 || 1;
  const x = i => P.l + (i / (series[0].values.length - 1)) * (W - P.l - P.r);
  const y = v => P.t + (1 - v / max) * (H - P.t - P.b);
  const grid = [0, 0.5, 1].map(f => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(max * f / 1.05)}" y2="${y(max * f / 1.05)}" stroke="var(--border)"/><text x="${P.l - 6}" y="${y(max * f / 1.05) + 3}" text-anchor="end">${unit(max * f / 1.05)}</text>`).join("");
  const xl = [0, Math.round(years / 2), years].map((t, i) => `<text x="${x(t / years * (series[0].values.length - 1))}" y="${H - 6}" text-anchor="${["start", "middle", "end"][i]}">${t} ár</text>`).join("");
  const paths = series.map(s => {
    const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const area = s.fill ? `<path d="${d}L${x(s.values.length - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="${s.color}" opacity="0.14"/>` : "";
    return area + `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" ${s.dash ? 'stroke-dasharray="4 4"' : ""}/>`;
  }).join("");
  const legend = `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join("")}</div>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Línurit">${grid}${xl}${paths}</svg>${legend}`;
}
const rows = arr => `<div class="rows">${arr.map(([a, b, cls]) => `<div class="${cls || ""}"><span>${a}</span><span>${b}</span></div>`).join("")}</div>`;

reikna.laun = () => {
  const G = val("l-laun"), ser = $("#l-sereign").checked, pa = $("#l-pa").checked, st = +$("#l-stett").value / 100;
  $("#l-stett-o").textContent = pct(st * 100);
  const lif = G * SKATTUR.lifeyrirLaunthegi, sereign = ser ? G * 0.04 : 0;
  const stofn = Math.max(0, G - lif - sereign);
  let skattur = 0, fyrri = 0;
  for (const t of SKATTUR.threp) { skattur += Math.max(0, Math.min(stofn, t.upp) - fyrri) * t.hlutfall; fyrri = t.upp; if (stofn <= t.upp) break; }
  const afsl = pa ? Math.min(skattur, SKATTUR.personuafslattur) : 0;
  const greiddur = skattur - afsl, stett = G * st;
  const net = G - lif - sereign - greiddur - stett;
  const atv = G * SKATTUR.lifeyrirAtvinnurekandi + (ser ? G * 0.02 : 0);
  $("#l-out").innerHTML = `
    <div><div class="big">${kr(net)}</div><div class="big-sub">útborgað á mánuði · ${pct(G ? net / G * 100 : 0)} af heildarlaunum</div></div>
    ${rows([
      ["Heildarlaun", kr(G)],
      ["Lífeyrissjóður (4%)", "−" + kr(lif)],
      ...(ser ? [["Séreignarsparnaður (4%)", "−" + kr(sereign)]] : []),
      ["Reiknaður skattur", "−" + kr(skattur)],
      ...(pa ? [["Persónuafsláttur", "+" + kr(afsl)]] : []),
      ...(st ? [["Stéttarfélag", "−" + kr(stett)]] : []),
      ["Útborgað", kr(net), "total"],
    ])}
    <p class="note">Vinnuveitandi greiðir auk þess ${kr(atv)} í lífeyrissjóð${ser ? " og séreign" : ""} á mánuði. Skatthlutfall er ${pct(G ? greiddur / G * 100 : 0)} af heildarlaunum. Útsvar er reiknað sem landsmeðaltal.</p>`;
};

reikna.lan = () => {
  const P = val("p-verd"), E = val("p-eigid"), yrs = +$("#p-ar").value, n = yrs * 12;
  $("#p-ar-o").textContent = yrs + " ár";
  const fyrstu = $("#p-fyrstu").checked;
  const L = Math.max(0, P - E), hamark = fyrstu ? LANAREGLUR.vedhlutfallFyrstu : LANAREGLUR.vedhlutfall;
  const hlutfall = P ? L / P : 0;
  const rO = val("p-ov"), rV = val("p-vt"), inf = val("p-vb") / 100;
  if (!L || !n) { $("#p-out").innerHTML = `<p class="note">Settu inn kaupverð og eigið fé.</p>`; return; }

  const pO = lanaGreidsla(L, rO, n);
  const aV = lanaGreidsla(L, rV, n);            // raungreiðsla verðtryggðs láns
  const im = Math.pow(1 + inf, 1 / 12) - 1;     // mánaðarleg verðbólga
  const rv = rV / 100 / 12, ro = rO / 100 / 12;
  let balO = L, balV = L, totO = 0, totV = 0;
  const serO = [L], serV = [L];
  for (let k = 1; k <= n; k++) {
    balO = balO * (1 + ro) - pO; totO += pO;
    balV = balV * (1 + rv) - aV;                 // raunstaða
    totV += aV * Math.pow(1 + im, k);
    if (k % 12 === 0) { serO.push(Math.max(0, balO)); serV.push(Math.max(0, balV) * Math.pow(1 + im, k)); }
  }
  const peakV = Math.max(...serV);
  const tekjur = pO / (fyrstu ? LANAREGLUR.greidslubyrdiFyrstu : LANAREGLUR.greidslubyrdi);

  $("#p-out").innerHTML = `
    <div><div class="big">${mkr(L)}</div><div class="big-sub">lánsfjárhæð · veðsetning ${pct(hlutfall * 100)}</div></div>
    ${hlutfall > hamark + 1e-9 ? `<div class="warn">⚠️ Hámark veðsetningar er ${hamark * 100}%${fyrstu ? " fyrir fyrstu kaupendur" : ""}. Þú þarft minnst ${mkr(P * (1 - hamark))} í eigið fé.</div>` : ""}
    <div class="compare">
      <div><h4>Óverðtryggt</h4><div class="v">${kr(pO)}</div><div class="s">á mánuði, fast allan tímann*<br>Samtals greitt: ${mkr(totO)}</div></div>
      <div><h4>Verðtryggt</h4><div class="v">${kr(aV * (1 + im))}</div><div class="s">fyrsta greiðsla, hækkar með verðbólgu<br>Samtals greitt: ${mkr(totV)}</div></div>
    </div>
    ${linurit([
      { values: serO, color: "var(--teal)", label: "Eftirstöðvar óverðtryggt" },
      { values: serV, color: "var(--gold)", label: "Eftirstöðvar verðtryggt (krónur hvers tíma)" },
    ], yrs)}
    <p class="note">${peakV > L * 1.001 ? `Höfuðstóll verðtryggða lánsins fer hæst í ${mkr(peakV)} áður en hann fer að lækka. ` : ""}Til að standast greiðslumat fyrir óverðtryggða lánið þarf ráðstöfunartekjur upp á a.m.k. ${kr(tekjur)} á mánuði. *Miðað við fasta vexti allan lánstímann; í raun breytast vextir. Upphæðir í krónum hvers tíma, ekki núvirði. Athugaðu vaxtatöflur bankanna.</p>`;
};

reikna.sparnadur = () => {
  const P0 = val("s-upphaf"), m = val("s-man"), rA = +$("#s-r").value, yrs = +$("#s-ar").value, inf = val("s-vb") / 100;
  $("#s-r-o").textContent = pct(rA); $("#s-ar-o").textContent = yrs + " ár";
  const r = rA / 100 / 12;
  let bal = P0, inn = P0;
  const serB = [P0], serI = [P0];
  for (let k = 1; k <= yrs * 12; k++) { bal = bal * (1 + r) + m; inn += m; if (k % 12 === 0) { serB.push(bal); serI.push(inn); } }
  const raun = bal / Math.pow(1 + inf, yrs);
  const tvofold = rA > 0 ? 72 / rA : null;
  $("#s-out").innerHTML = `
    <div><div class="big">${mkr(bal)}</div><div class="big-sub">eftir ${yrs} ár · jafngildir um ${mkr(raun)} á verðlagi dagsins</div></div>
    ${rows([["Innborganir samtals", kr(inn)], ["Vextir og ávöxtun", kr(bal - inn)], ["Hlutfall ávöxtunar af lokastöðu", pct(bal ? (bal - inn) / bal * 100 : 0)]])}
    ${linurit([
      { values: serB, color: "var(--gold)", label: "Heildarstaða", fill: true },
      { values: serI, color: "var(--teal)", label: "Innborganir", dash: true },
    ], yrs)}
    <p class="note">${tvofold ? `72-reglan: við ${pct(rA)} ávöxtun tvöfaldast upphæð á um ${nf2.format(Math.round(tvofold * 10) / 10)} árum. ` : ""}Fyrir skatta og kostnað. Söguleg ávöxtun er engin trygging fyrir framtíðinni.</p>`;
};

reikna.lifeyrir = () => {
  const G = val("f-laun"), yrs = +$("#f-ar").value, rA = +$("#f-r").value, ser = $("#f-sereign").checked;
  $("#f-ar-o").textContent = yrs + " ár"; $("#f-r-o").textContent = pct(rA);
  const r = rA / 100 / 12, n = yrs * 12;
  const fv = m => r > 0 ? m * (Math.pow(1 + r, n) - 1) / r : m * n;
  const samtr = fv(G * 0.155), sereign = ser ? fv(G * 0.06) : 0;
  $("#f-out").innerHTML = `
    <div><div class="big">${mkr(samtr + sereign)}</div><div class="big-sub">uppsafnað við starfslok, á verðlagi dagsins</div></div>
    ${rows([
      ["Samtrygging (15,5%)", mkr(samtr)],
      ["— þar af mánaðarlegt iðgjald", kr(G * 0.155)],
      ...(ser ? [["Séreign (6%)", mkr(sereign)], ["— ef tekin út á 10 árum", "≈ " + kr(sereign / 120) + "/mán"]] : [["Séreign", "Engin — þú missir 2% mótframlag!"]]),
    ])}
    <p class="note">Samtrygging greiðist út sem ævilangur lífeyrir — hversu hár hann verður fer eftir réttindakerfi sjóðsins. Sjáðu áætluð réttindi þín á <a href="https://www.lifeyrisgattin.is" target="_blank" rel="noopener">lifeyrisgattin.is</a>. Útreikningur miðar við föst laun að raunvirði.</p>`;
};

// Verðlagsreiknir: Z = X × VNV_nú / VNV_Y  (VNV 1988=100; VNV_Y = ársmeðaltal ársins Y)
// Meðalverðbólga á ári = (VNV_nú / VNV_Y)^(1/n) − 1, n = ár frá miðju ári Y til nýjustu mælingar.
// Staðfest með gögnum Hagstofu: VNV sept. 2026 / sept. 2025 gefur 5,92% (Hagstofa birtir 5,9%).
// Dæmi: 100.000 kr árið 2000 (VNV 199,1) → 100.000 × 697,3 / 199,1 ≈ 350.226 kr í sept. 2026.
reikna.verdlag = () => {
  const X = val("v-upph"), Y = +$("#v-ar").value;
  const { vnvAr, vnvNyjast } = SAGA_GOGN;
  const vY = vnvAr.gildi[Y - vnvAr.fra], vN = vnvNyjast.gildi;
  const [ny, nm] = vnvNyjast.man.split("-").map(Number), nyjast = `${MANUDIR[nm - 1]} ${ny}`;
  const Z = X * vN / vY, n = tAr(ny, nm) - (Y + 0.5);
  const medal = n > 0 ? (Math.pow(vN / vY, 1 / n) - 1) * 100 : 0;
  $("#v-out").innerHTML = `
    <div><div class="big">${kr(Z)}</div><div class="big-sub">${kr(X)} árið ${Y} jafngilda þessu á verðlagi í ${nyjast}</div></div>
    ${rows([
      [`Vísitala neysluverðs ${Y} (ársmeðaltal)`, tala(vY, 1)],
      [`Vísitala neysluverðs, ${nyjast}`, tala(vN, 1)],
      ["Verðlag hefur hækkað um", pct(Math.round((vN / vY - 1) * 1000) / 10)],
      ["Meðalverðbólga á ári", "≈ " + pct(Math.round(medal * 10) / 10)],
      [`1 kr árið ${Y}`, `= ${tala(vN / vY, 2)} kr nú`, "total"],
    ])}
    <p class="note">Byggt á vísitölu neysluverðs frá <a href="https://hagstofa.is/talnaefni/efnahagur/verdlag/visitala-neysluverds/" target="_blank" rel="noopener">Hagstofu Íslands</a> (1988=100). Ársmeðaltal ársins ${Y} er borið saman við nýjustu mælingu. Laun og einstök verð hafa ekki endilega breyst eins og meðalverðlag.</p>`;
};

reikna.gengi = () => {
  const a = parseNum($("#g-upph").value), fra = $("#g-fra").value, til = $("#g-til").value;
  const fI = iskPer(fra), tI = iskPer(til);
  if (!fI || !tI) { $("#g-out").innerHTML = `<p class="note">Gengi fyrir þennan gjaldmiðil er ekki tiltækt núna.</p>`; return; }
  const res = a * fI / tI;
  const alg = ["EUR", "USD", "GBP", "DKK", "NOK", "SEK"].filter(c => gengi.perEUR[c]);
  $("#g-out").innerHTML = `
    <div><div class="big">${nf2.format(res)} ${til}</div><div class="big-sub">${nf2.format(a)} ${fra} · 1 ${fra} = ${nf2.format(fI / tI)} ${til}</div></div>
    ${rows(alg.map(c => [`1 ${c} (${MYNT_NOFN[c]})`, nf2.format(iskPer(c)) + " kr"]))}
    <p class="note">${gengi.live ? "Lifandi viðmiðunargengi Seðlabanka Evrópu" : "Síðasta skráða gengi (ekki náðist í lifandi gengi)"} frá ${gengi.dags}. Bankar og kortafyrirtæki bæta við álagi.</p>`;
};

function initReiknivelar() {
  $$("[data-skattar]").forEach(s => s.textContent = SKATTUR.ar);
  const sel = MYNTIR.map(c => `<option value="${c}">${c} — ${MYNT_NOFN[c]}</option>`).join("");
  $("#g-fra").innerHTML = sel; $("#g-til").innerHTML = sel;
  $("#g-fra").value = "EUR"; $("#g-til").value = "ISK";
  const { vnvAr } = SAGA_GOGN, sidastaAr = vnvAr.fra + vnvAr.gildi.length - 1;
  $("#v-ar").innerHTML = Array.from({ length: vnvAr.gildi.length }, (_, k) => sidastaAr - k).map(a => `<option value="${a}">${a}</option>`).join("");
  $("#v-ar").value = "2000";
  $("#g-swap").onclick = () => { const f = $("#g-fra").value; $("#g-fra").value = $("#g-til").value; $("#g-til").value = f; reikna.gengi(); };

  // Tölur með þúsundaskilum
  $$("[data-money]").forEach(inp => {
    const fmt = () => { const n = parseNum(inp.value); inp.value = n ? nf0.format(n) : "0"; };
    fmt();
    inp.addEventListener("blur", fmt);
    inp.addEventListener("focus", () => inp.select());
  });

  const map = { l: "laun", p: "lan", s: "sparnadur", f: "lifeyrir", g: "gengi", v: "verdlag" };
  $("#view-reiknivelar").addEventListener("input", e => {
    const key = map[e.target.id?.split("-")[0]];
    if (key) reikna[key]();
  });
  $("#calcNav").addEventListener("click", e => {
    const b = e.target.closest("[data-calc]");
    if (b) history.replaceState(null, "", "#reiknivelar/" + b.dataset.calc), onEnter.reiknivelar(b.dataset.calc);
  });
  Object.values(reikna).forEach(f => f());
  LITILL_SKJAR.addEventListener("change", () => { reikna.lan(); reikna.sparnadur(); });   // teikna línurit upp á nýtt
}
onEnter.reiknivelar = sub => {
  const name = reikna[sub] ? sub : ($(".calc.active")?.id.replace("calc-", "") || "laun");
  $$(".calc").forEach(c => c.classList.toggle("active", c.id === "calc-" + name));
  $$("#calcNav .chip").forEach(c => c.classList.toggle("active", c.dataset.calc === name));
  reikna[name]();
};

// ── SPURNINGAKEPPNI ──────────────────────────────────────────────
function stokka(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
let quiz = null;

function byrjaProf() {
  quiz = {
    i: 0, score: 0, answered: false,
    qs: stokka(SPURNINGAR).slice(0, 10).map(q => {
      const order = stokka(q.opts.map((_, i) => i));
      return { ...q, opts: order.map(i => q.opts[i]), correct: order.indexOf(q.correct) };
    }),
  };
  teiknaSpurningu();
}

function teiknaSpurningu() {
  const q = quiz.qs[quiz.i], total = quiz.qs.length;
  quiz.answered = false;
  $("#quiz").innerHTML = `
    <div class="quiz-top"><span>Stig: ${quiz.score}</span><span>Spurning ${quiz.i + 1} af ${total}</span></div>
    <div class="progress"><i style="width:${quiz.i / total * 100}%"></i></div>
    <div class="card">
      <div class="quiz-question" id="qq">${esc(q.q)}</div>
      <div class="quiz-options" role="group" aria-labelledby="qq">
        ${q.opts.map((o, i) => `<button class="quiz-option" type="button" data-i="${i}"><span class="n">${i + 1}</span>${esc(o)}</button>`).join("")}
      </div>
      <div class="quiz-feedback" aria-live="polite"></div>
      <div class="quiz-actions"></div>
    </div>`;
}

function svara(idx) {
  if (!quiz || quiz.answered) return;
  quiz.answered = true;
  const q = quiz.qs[quiz.i];
  const btns = $$(".quiz-option");
  btns.forEach(b => b.disabled = true);
  btns[q.correct].classList.add("correct");
  const rett = idx === q.correct;
  if (rett) quiz.score++; else btns[idx].classList.add("wrong");
  $(".quiz-feedback").innerHTML = `${rett ? "✅ <strong>Rétt!</strong>" : "❌ <strong>Rangt.</strong>"} ${esc(q.explanation)}`;
  const last = quiz.i + 1 >= quiz.qs.length;
  $(".quiz-actions").innerHTML = `<button class="btn" type="button" id="qNext">${last ? "Sjá niðurstöður 🏆" : "Næsta spurning →"}</button>`;
  $("#qNext").focus();
  $("#qNext").onclick = () => { quiz.i++; last ? lokaProfi() : teiknaSpurningu(); };
}

function lokaProfi() {
  const s = quiz.score, t = quiz.qs.length;
  const best = Math.max(s, +(store.get("peningar-best") || 0));
  store.set("peningar-best", best);
  const [emoji, title, msg] =
    s === t ? ["🏆", "Fullkomið!", "Þú veist allt um fjármál!"] :
    s >= 8 ? ["🎉", "Framúrskarandi!", "Mjög góð þekking á fjármálum."] :
    s >= 6 ? ["👍", "Vel gert!", "Góð grunnþekking — haltu áfram að læra."] :
    s >= 4 ? ["📚", "Ekki slæmt!", "Kíktu á Hugtök-flipann og reyndu aftur."] :
             ["💡", "Allir byrja einhvers staðar!", "peningar.is er hér til að hjálpa."];
  quiz = null;
  $("#quiz").innerHTML = `<div class="card quiz-final">
    <div class="emoji">${emoji}</div><div class="title">${title}</div>
    <div class="score">${s}/${t}</div><div class="msg">${msg}</div>
    <div class="best">Besti árangur þinn: ${best}/${t}</div>
    <button class="btn" type="button" id="qAgain">Spila aftur 🔄</button>
    <button class="btn btn-ghost" type="button" id="qShare" style="margin-left:0.4rem">Deila</button>
  </div>`;
  $("#qAgain").onclick = byrjaProf;
  $("#qShare").onclick = () => {
    const text = `Ég fékk ${s}/${t} í fjármálaprófinu á peningar.is 💰`;
    if (navigator.share) navigator.share({ text, url: location.origin }).catch(() => {});
    else navigator.clipboard?.writeText(text + " " + location.origin).then(() => toast("Afritað!"));
  };
}

function initProf() {
  $("#quiz").addEventListener("click", e => { const b = e.target.closest(".quiz-option"); if (b) svara(+b.dataset.i); });
  document.addEventListener("keydown", e => {
    if (!$("#view-prof").classList.contains("active") || !quiz || e.target.matches("input,textarea,select")) return;
    if (/^[1-4]$/.test(e.key) && !quiz.answered) svara(+e.key - 1);
  });
}
onEnter.prof = () => { if (!quiz) byrjaProf(); };

// ── SAGA, FRÆÐAST, FYRIRTÆKI ─────────────────────────────────────
const ISL_AR = new Set(["1886", "1981", "2001", "2008", "2017", "2023", "2025"]);
function teiknaSogu(adeinsIs) {
  $("#timeline").innerHTML = SAGA.filter(s => !adeinsIs || ISL_AR.has(s.ar)).map(s => `
    <div class="tl-item${ISL_AR.has(s.ar) ? " is" : ""}">
      <div class="tl-year">${s.ar}${ISL_AR.has(s.ar) ? `<span class="tl-flag">🇮🇸 Ísland</span>` : ""}</div>
      <h3 class="tl-title">${esc(s.titill)}</h3>
      <p class="tl-text">${esc(s.texti)}</p>
    </div>`).join("");
}

function teiknaFraedast() {
  const tagName = { beg: "Byrjendur", all: "Allir", adv: "Lengra komnir" };
  $("#fraedast").innerHTML = FRAEDAST.map(sec => `
    <h3 class="section-label">${esc(sec.flokkur)}</h3>
    <div class="grid">${sec.items.map(i => `
      <div class="card tile">
        <div class="tile-emoji" aria-hidden="true">${i.e}</div>
        <div class="tile-title">${esc(i.t)}</div>
        <div class="tile-sub">${esc(i.s)}</div>
        <div class="tile-desc">${esc(i.d)}</div>
        <span class="tag tag-${i.tag}">${tagName[i.tag]}</span>
      </div>`).join("")}</div>`).join("");
}

function teiknaFyrirtaeki(flokkur) {
  const keys = Object.keys(FYRIRTAEKI_FLOKKAR).filter(k => flokkur === "all" || k === flokkur);
  $("#fyrirtaeki").innerHTML = keys.map(k => {
    const F = FYRIRTAEKI_FLOKKAR[k];
    return `<h3 class="section-label">${F.nafn}</h3><div class="grid">${FYRIRTAEKI.filter(f => f.flokkur === k).map(f => `
      <div class="card tile">
        <div class="f-head"><span class="f-icon" aria-hidden="true">${F.icon}</span><span class="pill ${F.cls}">${F.merki}</span></div>
        <div class="tile-title">${esc(f.nafn)}</div>
        <div class="f-full">${esc(f.fullt)}</div>
        <div class="tile-desc">${esc(f.lysing)}</div>
        <div class="facts">${f.stadreyndir.map(s => `<span class="fact">${esc(s)}</span>`).join("")}</div>
        <a class="f-link" href="${f.url}" target="_blank" rel="noopener">Vefsíða ↗</a>
      </div>`).join("")}</div>`;
  }).join("");
}

function initEfni() {
  teiknaSogu(false);
  $("#sagaFilter").addEventListener("click", e => {
    const b = e.target.closest("[data-s]");
    if (!b) return;
    $$("#sagaFilter .chip").forEach(x => x.classList.toggle("active", x === b));
    teiknaSogu(b.dataset.s === "is");
  });
  teiknaFraedast();
  $("#fFilter").innerHTML = `<button class="chip active" type="button" data-f="all">Allt</button>` +
    Object.entries(FYRIRTAEKI_FLOKKAR).map(([k, F]) => `<button class="chip" type="button" data-f="${k}">${F.nafn}</button>`).join("");
  $("#fFilter").addEventListener("click", e => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    $$("#fFilter .chip").forEach(x => x.classList.toggle("active", x === b));
    teiknaFyrirtaeki(b.dataset.f);
  });
  teiknaFyrirtaeki("all");
}

// ── ÞEMA & FLÝTILYKLAR ───────────────────────────────────────────
function uppfaeraThemaTakka() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  $("#themeBtn").textContent = dark ? "☀️" : "🌙";
  $("#themeBtn").setAttribute("aria-label", dark ? "Skipta í ljóst þema" : "Skipta í dökkt þema");
}
function initThema() {
  uppfaeraThemaTakka();
  $("#themeBtn").onclick = () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    store.set("peningar-theme", next);
    uppfaeraThemaTakka();
  };
}

// ── VALMYND (farsími, < 720px) ───────────────────────────────────
// Flipastikan (#tabBar) birtist sem fellivalmynd. Fókus helst inni meðan hún er opin.
const valmyndOpin = () => $("#tabBar").classList.contains("open");
function opnaValmynd() {
  $("#tabBar").classList.add("open");
  $("#menuBtn").setAttribute("aria-expanded", "true");
  ($(".tab-btn[aria-selected='true']") || $(".tab-btn")).focus();
}
function lokaValmynd(skilaFokus = true) {
  if (!valmyndOpin()) return;
  $("#tabBar").classList.remove("open");
  $("#menuBtn").setAttribute("aria-expanded", "false");
  if (skilaFokus) $("#menuBtn").focus();
}
function initValmynd() {
  $("#menuBtn").onclick = () => valmyndOpin() ? lokaValmynd() : opnaValmynd();
  // Smellur utan við valmynd og takka lokar
  document.addEventListener("click", e => {
    if (valmyndOpin() && !e.target.closest("#tabBar, #menuBtn")) lokaValmynd(false);
  });
  document.addEventListener("keydown", e => {
    if (!valmyndOpin()) return;
    if (e.key === "Escape") { e.preventDefault(); lokaValmynd(); return; }
    if (e.key !== "Tab") return;
    // Fókusgildra: takki + allir flipar, hringast
    const items = [$("#menuBtn"), ...$$(".tab-btn")];
    const i = items.indexOf(document.activeElement);
    e.preventDefault();
    items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
  });
  // Ef glugginn er breikkaður yfir 720px lokast valmyndin
  matchMedia("(max-width:720px)").addEventListener("change", e => { if (!e.matches) lokaValmynd(false); });
}
// Örvatakkar færa fókus milli flipa (bæði í stiku og valmynd)
function initFlipaLyklar() {
  $("#tabBar").addEventListener("keydown", e => {
    const tabs = $$(".tab-btn"), i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const fram = ["ArrowRight", "ArrowDown"], aftur = ["ArrowLeft", "ArrowUp"];
    let j = fram.includes(e.key) ? i + 1 : aftur.includes(e.key) ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (j === null) return;
    e.preventDefault();
    tabs[(j + tabs.length) % tabs.length].focus();
  });
}

function fokusLeit() {
  if ($("#view-ordabok").classList.contains("active")) return $("#dictInput").focus();
  if (!$("#view-hugtok").classList.contains("active")) location.hash = "hugtok";
  setTimeout(() => { $("#searchInput").focus(); $("#searchInput").select(); window.scrollTo({ top: 0, behavior: "smooth" }); }, 0);
}
// Smellur á tengil í sömu undirsíðu og nú er opin kallar ekki á hashchange
document.addEventListener("click", e => {
  const a = e.target.closest('a[href^="#"]');
  if (a && a.getAttribute("href") === location.hash) route();
});
document.addEventListener("keydown", e => {
  if (e.key === "/" && !e.target.matches("input,textarea,select")) { e.preventDefault(); fokusLeit(); }
});

// ── RÆSING ───────────────────────────────────────────────────────
$("#uppfaert").textContent = UPPFAERT;
$("#searchBtn").onclick = fokusLeit;
initThema();
initValmynd();
initFlipaLyklar();
initHugtok();
initOrdabok();
initReiknivelar();
initProf();
initEfni();
teiknaTicker();
route();
saekjaGengi();
