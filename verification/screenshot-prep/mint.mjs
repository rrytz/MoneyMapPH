/**
 * mint+verify variants. NEVER prints secrets. Writes the raw action_link to a
 * temp file for an in-browser GET test. Prints shapes/statuses only.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

function loadEnv() {
  // Resolved from this script's location, not process.cwd(). Reading
  // .env.local relative to the working directory meant this only worked when
  // invoked from the repo root — the same cwd-dependency the capture scripts
  // had. A verification script that silently finds no env from another
  // directory fails as "env missing", which reads like a config problem
  // rather than a path problem.
  const p = join(import.meta.dirname, "..", "..", ".env.local");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8").split(/\r?\n/);
  for (const line of raw) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[1] && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPA_URL || !SERVICE_KEY || !ANON_KEY) throw new Error("env missing");

const QA_EMAIL = "qa.dashboard.latency@example.com";
const client = createClient(SUPA_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await client.auth.admin.generateLink({
  type: "magiclink",
  email: QA_EMAIL,
  options: { redirectTo: "http://localhost:3000/auth/callback" },
});
if (error) { console.log("generateLink error:", error.message); process.exit(1); }

const link = data.properties.action_link;
const q = link.split("?", 2)[1] || "";
let token = null;
for (const pair of q.split("&")) {
  const [k, v] = pair.split("=");
  if (k === "token" && v) token = decodeURIComponent(v);
}
if (!token) { console.log("no token"); process.exit(1); }

// raw link on disk for the browser-GET test (never echoed)
writeFileSync(join(import.meta.dirname, "..", "evidence", "link.tmp"), link, "utf8");
console.log("link written to link.tmp (len", link.length + ")");

async function verifyTry(label, body) {
  const r = await fetch(`${SUPA_URL}/auth/v1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify(body),
  });
  let j;
  try { j = await r.json(); } catch { j = null; }
  const acc = j && j.access_token ? j.access_token.length : 0;
  console.log(
    `${label}: status=${r.status} keys=${j ? Object.keys(j).join(",") : "nonjson"} access=${acc ? acc : "-"} code=${j && j.code ? "yes" : "-"} err=${j && j.error_code ? j.error_code : "-"}`
  );
  if (j && j.access_token) writeFileSync(join(import.meta.dirname, "..", "evidence", "session.tmp"), JSON.stringify(j), "utf8");
  return j;
}

await verifyTry("no-verifier-no-redirect", { type: "magiclink", token, email: QA_EMAIL });
await verifyTry("no-verifier+redirect", { type: "magiclink", token, email: QA_EMAIL, redirect_to: "http://localhost:3000/auth/callback" });
const v = randomBytes(32).toString("base64url");
await verifyTry("verifier+redirect", { type: "magiclink", token, email: QA_EMAIL, redirect_to: "http://localhost:3000/auth/callback", code_verifier: v });
console.log("done");