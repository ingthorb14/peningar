# peningar.is — samhengi fyrir Claude Code

Íslensk fjármálafræðsluvefsíða. Eigandi: fyrsta árs nemi í fjármálaverkfræði við HR.
Svaraðu á íslensku, stutt og hnitmiðað. Kóðaathugasemdir á íslensku (eins og í núverandi kóða).

## Uppbygging (staðan 24. sept. 2026)
- `index.html` — skel: nav, flipastika (7 flipar), section fyrir hvern flipa, footer.
- `css/style.css` — allt útlit. CSS-breytur fyrir ljóst/dökkt þema (`data-theme` á `<html>`). Eitt breakpoint: 720px.
- `js/gogn.js` — ALLT efni og tölur: `UPPFAERT`, `MARKADUR`, `SKATTUR`, `LANAREGLUR`, `FLOKKAR`, `HUGTOK` (41), `SPURNINGAR` (18), `SAGA` (16), `FYRIRTAEKI` (19), `FRAEDAST`. Hjálparföll `tala()` og `pct()` (íslenskt talnasnið).
- `js/app.js` — viðmót: hash-leiðarkerfi (`#flipi/undirsíða`), leit, orðabók, 5 reiknivélar (laun, íbúðalán verðtr./óverðtr., sparnaður, lífeyrir, gengi), próf, saga, fræðast, fyrirtæki, þema. SVG-línurit í `linurit()`.
- `data/ordabok.json` — ensk–íslensk orðabók, fylki af `[en, is]` pörum, hlaðið með fetch.
- `api/explain.js` — Vercel serverless fall fyrir AI-skýringar (Claude Haiku). Óvirkt nema `ANTHROPIC_API_KEY` sé stillt.
- Gengi sótt lifandi frá `api.frankfurter.dev`, varagildi í `MARKADUR.gengiVara`.
- Leturgerðir: Fraunces (serif, fyrirsagnir) + DM Sans. Litir: paper / gull (`--gold`) / teal (`--teal`).
- Cache-busting: breytan `VERSJON` (`YYYYMMDDx`) efst í `<head>` í index.html — eini staðurinn; hækka við hverja breytingu.

## Vinnuflæði
VS Code → GitHub Desktop (commit + push) → GitHub `ingthorb14/peningar` → Vercel sjálfvirk birting (peningar.vercel.app).
Eigandinn commitar og pushar sjálfur. Þú breytir skrám og prófar staðbundið (`npx serve .` eða `python3 -m http.server`).

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
