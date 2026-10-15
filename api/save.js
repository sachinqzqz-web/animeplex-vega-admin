const OWNER = "sachinqzqz-web";
const REPO = "vega-app";
const PATH = "provider-config.json";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const token = process.env.GITHUB_TOKEN;
  const password = process.env.ADMIN_PASSWORD;
  if (!token || !password) return res.status(503).json({ error: "Admin setup incomplete. Configure GITHUB_TOKEN and ADMIN_PASSWORD in Vercel Environment Variables." });
  if (req.headers["x-admin-password"] !== password) return res.status(401).json({ error: "Incorrect admin password." });
  const provider = typeof req.body?.defaultProvider === "string" ? req.body.defaultProvider.trim() : "";
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(provider)) return res.status(400).json({ error: "Enter a valid provider ID." });
  try {
    const manifestResponse = await fetch("https://raw.githubusercontent.com/sachinqzqz-web/vega-providers/main/manifest.json", { headers: { "Cache-Control": "no-cache" } });
    if (!manifestResponse.ok) throw new Error("Could not validate against the live provider manifest.");
    const manifest = await manifestResponse.json();
    const selected = Array.isArray(manifest) ? manifest.find(item => item?.value === provider && !item?.disabled) : null;
    if (!selected) return res.status(400).json({ error: "Choose an enabled provider from the live provider list." });
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
    const currentResponse = await fetch(url + "?ref=main", { headers });
    if (!currentResponse.ok) throw new Error("Could not read current config from GitHub.");
    const currentFile = await currentResponse.json();
    const currentConfig = JSON.parse(Buffer.from(currentFile.content, "base64").toString("utf8"));
    const nextConfig = { ...currentConfig, defaultProvider: provider };
    const saveResponse = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Admin: set default provider to ${provider}`,
        content: Buffer.from(JSON.stringify(nextConfig, null, 2) + "\n").toString("base64"),
        sha: currentFile.sha,
        branch: "main"
      })
    });
    const saved = await saveResponse.json();
    if (!saveResponse.ok) throw new Error(saved.message || "GitHub rejected the config update.");
    return res.status(200).json({ ok: true, defaultProvider: provider, commitUrl: saved.commit?.html_url });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Failed to save configuration." });
  }
};
