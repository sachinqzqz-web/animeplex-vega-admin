module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(503).json({ error: "ADMIN_PASSWORD is not configured in Vercel." });
  const supplied = typeof req.body?.password === "string" ? req.body.password : "";
  if (!supplied || supplied !== expected) return res.status(401).json({ error: "Incorrect admin password." });
  return res.status(200).json({ ok: true });
};
