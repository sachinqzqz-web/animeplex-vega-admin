const OWNER = "sachinqzqz-web";
const REPO = "vega-app";
const PATH = "provider-config.json";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=main`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
    });
    if (!response.ok) throw new Error("Could not read provider configuration from GitHub.");
    const file = await response.json();
    const config = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
    return res.status(200).json({ ...config, configSha: file.sha });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Failed to load configuration." });
  }
};
