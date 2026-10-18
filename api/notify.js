const crypto = require("crypto");
const OWNER = "sachinqzqz-web";
const REPO = "vega-app";
const PATH = "provider-config.json";
function validCookie(req, secret) {
  const raw = (req.headers.cookie || "").split(";").map(v => v.trim()).find(v => v.startsWith("ap_admin="));
  if (!raw) return false;
  let decoded;
  try { decoded = decodeURIComponent(raw.slice("ap_admin=".length)); } catch { return false; }
  const parts = decoded.split(".");
  if (parts.length !== 2 || !/^\d+$/.test(parts[0])) return false;
  const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest("hex");
  const a = Buffer.from(parts[1]); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const issued = Number(parts[0]);
  return issued <= Date.now() && Date.now() - issued < 30 * 24 * 60 * 60 * 1000;
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  const token = process.env.GITHUB_TOKEN;
  const password = process.env.ADMIN_PASSWORD;
  if (!token || !password) return res.status(503).json({error:"Admin setup incomplete. Configure GITHUB_TOKEN and ADMIN_PASSWORD in Vercel."});
  if (!validCookie(req, password)) return res.status(401).json({error:"Admin session expired. Sign in again."});
  const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0,100) : "";
  const body = typeof req.body?.body === "string" ? req.body.body.trim().slice(0,500) : "";
  if (!title || !body) return res.status(400).json({error:"Enter both notification title and message."});
  try {
    const headers = {Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
    const url = "https://api.github.com/repos/"+OWNER+"/"+REPO+"/contents/"+PATH;
    const currentResponse = await fetch(url+"?ref=main",{headers});
    if (!currentResponse.ok) throw new Error("Could not read current config from GitHub.");
    const currentFile = await currentResponse.json();
    const config = JSON.parse(Buffer.from(currentFile.content,"base64").toString("utf8"));
    const notification = {id:crypto.randomUUID(),title,body,createdAt:new Date().toISOString()};
    const next = {...config, notification};
    const saveResponse = await fetch(url,{method:"PUT",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({message:"Admin: publish AnimePlex notification",content:Buffer.from(JSON.stringify(next,null,2)+"\n").toString("base64"),sha:currentFile.sha,branch:"main"})});
    const saved = await saveResponse.json();
    if (!saveResponse.ok) throw new Error(saved.message || "GitHub rejected the notification.");
    return res.status(200).json({ok:true,notification,commitUrl:saved.commit?.html_url});
  } catch(error) { return res.status(502).json({error:error.message || "Failed to publish notification."}); }
};
