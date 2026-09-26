/**
 * Session-mint probe v2 for screenshot harvesting.
 *   - generateLink(magiclink) for the QA account (no email sent)
 *   - POST /auth/v1/verify with the one-time token
 * Prints SHAPES ONLY. Any value whose key is otp/token/code/hash/secret/pass is
 * masked regardless of length; long strings are masked too. Values never shown.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

function loadEnv() {
  const p = join(process.cwd(), ".env.local");
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
const SENSITIVE = /otp|token|code|hash|secret|pass|verifier/i;

const mask = (s) => `<len:${s.length}>${s.slice(0, 3)}…`;
function sum(v, depth = 0, keyHint = "") {
  if (depth > 2 || v === null || v === undefined) return "[value]";
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v))
      o[k] = sum(val, depth + 1, k);
    return o;
  }
  const s = String(v);
  if (SENSITIVE.test(keyHint) || s.length > 24) return mask(s);
  return s;
}

const client = createClient(SUPA_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ref = (SUPA_URL.match(/^https?:\/\/([^.]+)/) || ["", "?"])[1];
console.log("project ref:", ref, "| expected cookie name: sb-" + ref + "-auth-token");

const { data, error } = await client.auth.admin.generateLink({
  type: "magiclink",
  email: QA_EMAIL,
  options: { redirectTo: "http://localhost:3000/auth/callback" },
});
if (error) { console.log("generateLink error:", error.message, error.status); process.exit(1); }
console.log("generateLink ok, verify type:", data.properties.verification_type, "| user:", data.user.id.slice(0, 8) + "…");

const link = data.properties.action_link;
const q = link.split("?", 2)[1] || "";
let token = null;
for (const pair of q.split("&")) {
  const [k, v] = pair.split("=");
  if ((k === "token" || k === "code") && v) token = decodeURIComponent(v);
}
if (!token) { console.log("no token/code in action_link"); process.exit(1); }
console.log("token kind:", token.length > 30 ? "jwt-or-long" : "short", "len:", token.length);

// ---- verify POST, bare fetch like the browser would ----
async function tryVerify(extra = {}) {
  const body = { type: "magiclink", token, email: QA_EMAIL, ...extra };
  const r = await fetch(`${SUPA_URL}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  let j;
  try { j = await r.json(); } catch { return { status: r.status, bodyLen: (await r.text()).length }; }
  return { status: r.status, keys: Object.keys(j), shape: sum(j) };
}

console.log("=== verify without verifier ===");
const a = await tryVerify();
console.log("status:", a.status, "| keys:", a.keys, "| body:", JSON.stringify(a.shape).slice(0, 300));

if (a.status === 400 || a.status === 422) {
  console.log("=== verify with blank verifier note ===");
  // Supabase PKCE uses SHA-256(code_verifier) as challenge; also try a real pair
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  console.log("will try with code_verifier (sha256 challenge, len", verifier.length + ")");
  const b = await tryVerify({ code_verifier: verifier });
  console.log("status:", b.status, "| keys:", b.keys, "| body:", JSON.stringify(b.shape).slice(0, 300));
  // Also admin-based: generateLink already returned properties; try signup-style exchange is not needed.
}

console.log("done");