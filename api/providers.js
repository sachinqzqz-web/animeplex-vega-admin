module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const sources = [
    "https://raw.githubusercontent.com/sachinqzqz-web/vega-providers/main/manifest.json",
    "https://cdn.jsdelivr.net/gh/sachinqzqz-web/vega-providers@main/manifest.json"
  ];
  let lastError = null;

  for (const url of sources) {
    try {
      const response = await fetch(url, {
        headers: { "Cache-Control": "no-cache", "Accept": "application/json" },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error("Provider source returned HTTP " + response.status);
      const manifest = await response.json();
      if (!Array.isArray(manifest)) throw new Error("Provider manifest format is invalid.");

      const providers = manifest
        .filter(item => item && typeof item.value === "string" &&
          typeof item.display_name === "string" && !item.disabled)
        .map(item => ({
          value: item.value,
          display_name: item.display_name,
          type: item.type || "global",
          version: item.version || ""
        }));

      if (!providers.length) throw new Error("Provider manifest contains no enabled providers.");
      return res.status(200).json({ providers, count: providers.length });
    } catch (error) {
      lastError = error;
    }
  }

  return res.status(502).json({
    error: "Provider list source is temporarily unavailable. Please retry in a moment.",
    detail: lastError?.message || "All provider sources failed."
  });
};
