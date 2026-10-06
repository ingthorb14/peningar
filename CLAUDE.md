# peningar.is — samhengi fyrir Claude Code

Íslensk fjármálafræðsluvefsíða. Eigandi: fyrsta árs nemi í fjármálaverkfræði við HR.
Svaraðu á íslensku, stutt og hnitmiðað. Kóðaathugasemdir á íslensku (eins og í núverandi kóða).

## Uppbygging (staðan 24. sept. 2026)
- `index.html` — skel: nav, flipastika (7 flipar), section fyrir hvern flipa, footer.
- `css/style.css` — allt útlit. CSS-breytur fyrir ljóst/dökkt þema (`data-theme` á `<html>`). Eitt breakpoint: 720px.
- `js/gogn.js` — ALLT efni og tölur: `UPPFAERT`, `MARKADUR`, `SKATTUR`, `LANAREGLUR`, `FLOKKAR`, `HUGTOK` (41), `SPURNINGAR` (18), `SAGA` (16), `FYRIRTAEKI` (19), `FRAEDAST`. Hjálparföll `tala()` og `pct()` (íslenskt talnasnið).
- `js/app.js` — viðmót: hash-leiðarkerfi (`#flipi/undirsíða`), leit, orðabók, 6 reiknivélar (laun, íbúðalán verðtr./óverðtr., sparnaður, lífeyrir, verðlag, gengi), próf, saga, fræðast, fyrirtæki, þema. SVG-línurit í `linurit()`.
- `js/saga-gogn.js` — `SAGA_GOGN`: mánaðarleg ársverðbólga frá 2000, VNV-ársmeðaltöl frá 1988, nýjasta VNV og meginvextir SÍ (breytingadagar) frá 2000. Búin til af `scripts/saekja-gogn.mjs` (Hagstofa PX-API + Seðlabanki tímaröð 17923) — aldrei breyta handvirkt. Hlaðin á undan gogn.js: `MARKADUR` (stýrivextir, verðbólga, VNV) les nýjustu gildin úr henni. Notuð líka í grafi á Hugtök-flipa (`teiknaGraf()`) og verðbólgureikni (`reikna.verdlag`).
- `.github/workflows/vnv.yml` — vikuleg Action: `saekja-gogn.mjs --vnv`, opnar PR af greininni `gogn/vnv` ef VNV breytist (aldrei beint á main).
- `data/ordabok.json` — ensk–íslensk orðabók, fylki af `[en, is]` pörum, hlaðið með fetch.
- `api/explain.js` — Vercel serverless fall fyrir AI-skýringar (Claude Haiku). Óvirkt nema `ANTHROPIC_API_KEY` sé stillt.
- Gengi sótt lifandi frá `api.frankfurter.dev`, varagildi í `MARKADUR.gengiVara`.
- Leturgerðir: Fraunces (serif, fyrirsagnir) + DM Sans. Litir: paper / gull (`--gold`) / teal (`--teal`).
- `scripts/build.mjs` — Node build (engin dependency), keyrt af Vercel (`vercel.json`). Afritar síðuna í `dist/` (gitignored) og býr til `dist/hugtok/<slug>/index.html` fyrir hvert hugtak (title, description, canonical, og:, JSON-LD), `sitemap.xml` og `robots.txt`. Lén: `SITE_URL` eða `VERCEL_PROJECT_PRODUCTION_URL`. `norm()`/`slug()` eru í gogn.js og deilt með build.
- `og-image.png` (1200×630) — búin til með `scripts/og-image.html` (opna í vafra → Sækja PNG).
- Vercel Web Analytics: script neðst í `<head>` (ekki keyrt á localhost).
- Cache-busting: breytan `VERSJON` (`YYYYMMDDx`) efst í `<head>` í index.html — eini staðurinn; hækka við hverja breytingu.

## Vinnuflæði
VS Code → GitHub Desktop (commit + push) → GitHub `ingthorb14/peningar` → Vercel sjálfvirk birting (peningar.vercel.app).
Eigandinn commitar og pushar sjálfur. Þú breytir skrám og prófar staðbundið: `node scripts/build.mjs && python3 -m http.server -d dist` (hugtakasíðurnar eru aðeins til eftir build).

## Reglur
1. Breyttu núverandi skrám. Aldrei endurskrifa frá grunni.
2. Ekki snerta `data/ordabok.json` nema beðið sé um það.
3. Haltu útliti, leturgerðum, litum og tóni óbreyttum nema beðið sé um annað. Nýir hlutar nota núverandi klasa (`card`, `chip`, `calc`, `rows`, `note`, `big`…) og CSS-breytur.
4. Ekki breyta tölum (stýrivextir, verðbólga, skattar, gengi) nema eigandinn gefi þær upp eða biðji um leit — og þá með heimild.
5. Engin ný frameworks (React o.þ.h.). Vanilla JS. Build-skref í Node eru í lagi ef þau eru einföld og keyrð af Vercel.
6. Ekkert sem kostar peninga án samþykkis (API, áskriftir, lén).
7. Allt þarf að virka í farsíma (≥ 360px), í báðum þemum og með lyklaborði.
8. Eftir hverja breytingu: prófaðu í vafra (bæði þemu, 375px og 1280px), engar villur í console.
9. Segðu í 2–4 línum hvað breyttist og hvaða skrár.
10. Fjármálaútreikningar: skrifaðu formúluna í athugasemd og staðfestu með þekktu dæmi.
