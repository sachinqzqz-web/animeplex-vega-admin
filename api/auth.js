const crypto = require("crypto");
function signature(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
function validCookie(req, secret) {
  const raw = (req.headers.cookie || "").split(";").map(v => v.trim()).find(v => v.startsWith("ap_admin="));
  if (!raw) return false;
  const token = decodeURIComponent(raw.slice("ap_admin=".length));
  const parts = token.split(".");
  if (parts.length !== 2 || !/^\d+$/.test(parts[0])) return false;
  const expected = signature(parts[0], secret);
  const a = Buffer.from(parts[1]); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const issued = Number(parts[0]);
  return issued <= Date.now() && Date.now() - issued < 30 * 24 * 60 * 60 * 1000;
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(503).json({ error: "ADMIN_PASSWORD is not configured in Vercel." });
  if (req.method === "GET") return res.status(200).json({ ok: validCookie(req, expected) });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const supplied = typeof req.body?.password === "string" ? req.body.password : "";
  if (!supplied || supplied !== expected) return res.status(401).json({ error: "Incorrect admin password." });
  const issued = String(Date.now());
  const token = issued + "." + signature(issued, expected);
  res.setHeader("Set-Cookie", "ap_admin=" + encodeURIComponent(token) + "; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax");
  return res.status(200).json({ ok: true });
};
