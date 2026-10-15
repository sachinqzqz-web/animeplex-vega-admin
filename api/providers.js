module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const response = await fetch("https://raw.githubusercontent.com/sachinqzqz-web/vega-providers/main/manifest.json", {
      headers: { "Cache-Control": "no-cache" }
    });
    if (!response.ok) throw new Error("Could not load provider manifest.");
    const manifest = await response.json();
    if (!Array.isArray(manifest)) throw new Error("Provider manifest format is invalid.");
    const enabled = manifest
      .filter(item => item && typeof item.value === "string" && typeof item.display_name === "string" && !item.disabled)
      .map(item => ({ value: item.value, display_name: item.display_name, type: item.type || "global", version: item.version || "" }));
    return res.status(200).json({ providers: enabled, count: enabled.length });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Failed to load provider list." });
  }
};
