// Skýrir fjármálahugtak á íslensku með Claude.
// Tekur AÐEINS við { term } — fyrirspurnin er smíðuð hér á þjóninum svo enginn
// geti notað API-lykilinn í annað.

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TERM = 80;
const RATE_LIMIT = 20;               // beiðnir á IP-tölu …
const RATE_WINDOW_MS = 60 * 60 * 1000; // … á klukkustund (best-effort, per þjónstilvik)
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_LIMIT;
}

const SYSTEM = `Þú ert fræðari á íslensku fjármálavefnum peningar.is. Útskýrðu fjármálahugtök á einfaldri, réttri íslensku fyrir almenning.
Svaraðu EINGÖNGU með JSON-hlut, án annars texta, á forminu:
{"term": "hugtakið á íslensku", "explanation": "2-3 setningar", "example": "stutt dæmi úr íslenskum veruleika, í krónum", "tip": "eitt hagnýtt ráð"}
Ef spurningin er ekki um fjármál, hagfræði eða viðskipti skaltu skila {"error": "not_finance"}.
Ekki gefa persónulega fjárfestingarráðgjöf.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "not_configured" });

  const term = typeof req.body?.term === "string" ? req.body.term.trim() : "";
  if (!term || term.length > MAX_TERM) return res.status(400).json({ error: "invalid_term" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "?";
  if (limited(ip)) return res.status(429).json({ error: "rate_limited" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM,
        messages: [{ role: "user", content: `Hugtak: ${term}` }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "upstream_error" });

    const data = await r.json();
    const text = data.content?.find(b => b.type === "text")?.text || "";
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    if (json.error) return res.status(422).json({ error: json.error });

    const clip = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");
    return res.status(200).json({
      term: clip(json.term, 80) || term,
      explanation: clip(json.explanation, 800),
      example: clip(json.example, 500),
      tip: clip(json.tip, 300),
    });
  } catch (e) {
    return res.status(502).json({ error: "bad_response" });
  }
}
