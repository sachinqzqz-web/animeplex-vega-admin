const crypto = require("crypto");
const OWNER = "sachinqzqz-web";
const REPO = "vega-app";
const PATH = "provider-config.json";
function validCookie(req, secret) {
  const raw = (req.headers.cookie || "").split(";").map(v => v.trim()).find(v => v.startsWith("ap_admin="));
  if (!raw) return false;
  const parts = decodeURIComponent(raw.slice("ap_admin=".length)).split(".");
  if (parts.length !== 2 || !/^\d+$/.test(parts[0])) return false;
  const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest("hex");
  const a = Buffer.from(parts[1]); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const issued = Number(parts[0]);
  return issued <= Date.now() && Date.now() - issued < 30 * 24 * 60 * 60 * 1000;
}
const VALID_TYPES = new Set(["trending", "series", "movies", "anime", "drama"]);
const VALID_MEDIA_TYPES = new Set(["movie", "series", "anime", "drama"]);
function sanitizeUI(input, currentUI) {
  const source = input && typeof input === "object" ? input : currentUI || {};
  const rawSections = Array.isArray(source.sections) ? source.sections : currentUI?.sections;
  const sections = Array.isArray(rawSections) ? rawSections.slice(0, 12).filter(s =>
    s && typeof s.id === "string" && VALID_TYPES.has(s.type) && typeof s.title === "string"
  ).map((s, i) => ({ id: s.id.slice(0, 40) || "section-" + i, type: s.type, title: s.title.trim().slice(0, 60) || "Untitled section", visible: s.visible !== false })) : [
    {id:"trending",type:"trending",title:"🔥  TRENDING NOW",visible:true},
    {id:"series",type:"series",title:"WEB SERIES",visible:true},
    {id:"movies",type:"movies",title:"MOVIES",visible:true}
  ];
  if (!sections.length) throw new Error("At least one section configuration is required.");
  const categories = Array.isArray(source.categories) ? source.categories.slice(0, 20).filter(c => c && typeof c.id === "string" && typeof c.title === "string").map((c, i) => ({ id: c.id.slice(0, 40) || "category-" + i, title: c.title.trim().slice(0, 50) || "Untitled category", visible: c.visible !== false, providers: Array.isArray(c.providers) ? c.providers.filter(p => typeof p === "string" && /^[A-Za-z0-9_-]{2,64}$/.test(p)).slice(0, 50) : [] })) : currentUI?.categories || [];
  const featuredMovies = Array.isArray(source.featuredMovies) ? source.featuredMovies.slice(0, 200).filter(m => m && typeof m.id === "string" && typeof m.title === "string").map(m => ({ id: m.id.trim().slice(0, 600), title: m.title.trim().slice(0, 100) })).filter(m => m.id && m.title) : currentUI?.featuredMovies || [];
  const featuredMovieIds = featuredMovies.length ? featuredMovies.map(m => m.id) : (Array.isArray(source.featuredMovieIds) ? source.featuredMovieIds.filter(id => typeof id === "string").slice(0, 200) : currentUI?.featuredMovieIds || []);
  const managedTitles = Array.isArray(source.managedTitles) ? source.managedTitles.slice(0, 500).filter(m => m && typeof m.id === "string" && typeof m.title === "string" && VALID_MEDIA_TYPES.has(m.kind) && typeof m.link === "string" && /^https?:\/\//i.test(m.link)).map(m => ({ id: m.id.slice(0, 700), title: m.title.trim().slice(0, 120), kind: m.kind, link: m.link.slice(0, 2000), posterUrl: typeof m.posterUrl === "string" && /^https?:\/\//i.test(m.posterUrl) ? m.posterUrl.slice(0, 2000) : "", providerValues: Array.isArray(m.providerValues) ? m.providerValues.filter(p => typeof p === "string" && /^[A-Za-z0-9_-]{2,64}$/.test(p)).slice(0, 50) : [], language: ["auto", "hi", "original"].includes(m.language) ? m.language : "auto", visible: m.visible !== false, addedAt: typeof m.addedAt === "string" ? m.addedAt.slice(0, 40) : "" })).filter(m => m.id && m.title) : currentUI?.managedTitles || [];
  return { hamburgerVisible: source.hamburgerVisible !== false, useServerLabels: source.useServerLabels !== false, sections, categories, featuredMovies, featuredMovieIds, managedTitles };
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const token = process.env.GITHUB_TOKEN;
  const password = process.env.ADMIN_PASSWORD;
  if (!token || !password) return res.status(503).json({ error: "Admin setup incomplete. Configure GITHUB_TOKEN and ADMIN_PASSWORD in Vercel Environment Variables." });
  if (!validCookie(req, password)) return res.status(401).json({ error: "Admin session expired. Sign in again." });
  const provider = typeof req.body?.defaultProvider === "string" ? req.body.defaultProvider.trim() : "";
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(provider)) return res.status(400).json({ error: "Choose a provider from the list." });
  try {
    const manifestResponse = await fetch("https://raw.githubusercontent.com/sachinqzqz-web/vega-providers/main/manifest.json", { headers: { "Cache-Control": "no-cache" } });
    if (!manifestResponse.ok) throw new Error("Could not validate against the live provider manifest.");
    const manifest = await manifestResponse.json();
    const selected = Array.isArray(manifest) ? manifest.find(item => item?.value === provider && !item?.disabled) : null;
    if (!selected) return res.status(400).json({ error: "Choose an enabled provider from the live provider list." });
    const headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    const url = "https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/" + PATH;
    const currentResponse = await fetch(url + "?ref=main", { headers });
    if (!currentResponse.ok) throw new Error("Could not read current config from GitHub.");
    const currentFile = await currentResponse.json();
    const currentConfig = JSON.parse(Buffer.from(currentFile.content, "base64").toString("utf8"));
    const ui = sanitizeUI(req.body?.ui, currentConfig.ui);
    const nextConfig = { ...currentConfig, defaultProvider: provider, ui };
    const saveResponse = await fetch(url, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ message: "Admin: publish provider and AnimePlex UI settings", content: Buffer.from(JSON.stringify(nextConfig, null, 2) + "\n").toString("base64"), sha: currentFile.sha, branch: "main" }) });
    const saved = await saveResponse.json();
    if (!saveResponse.ok) throw new Error(saved.message || "GitHub rejected the config update.");
    return res.status(200).json({ ok: true, defaultProvider: provider, ui, commitUrl: saved.commit?.html_url });
  } catch (error) { return res.status(502).json({ error: error.message || "Failed to save configuration." }); }
}
