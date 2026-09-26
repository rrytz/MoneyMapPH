/**
 * otp-probe.mjs — does /auth/v1/otp accept a CLIENT-SUPPLIED PKCE challenge?
 * Raw fetch, anon key, owns a verifier/challenge pair. SHAPES ONLY.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

function loadEnv() {
  // Anchored to this script, not the working directory. Resolving .env.local
  // from process.cwd() meant this only ran from the repo root and otherwise
  // threw "env missing", which reads as a config problem rather than a path
  // problem. Enforced by src/tests/gate-hygiene.test.ts.
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
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPA_URL || !ANON_KEY) throw new Error("env missing");

const QA_EMAIL = "qa.dashboard.latency@example.com";
const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const ref = (SUPA_URL.match(/^https?:\/\/([^.]+)/) || ["", "?"])[1];
console.log("ref:", ref, "| verifier len:", verifier.length, "| challenge len:", challenge.length);

const body = {
  email: QA_EMAIL,
  options: {
    emailRedirectTo: "http://localhost:3000/auth/callback",
  },
  // PKCE params the client would send:
  code_challenge: challenge,
  code_challenge_method: "S256",
};
const resp = await fetch(`${SUPA_URL}/auth/v1/otp`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  },
  body: JSON.stringify(body),
});
const text = await resp.text();
console.log("otp status:", resp.status);
let j;
try { j = JSON.parse(text); } catch { console.log("non-json body len:", text.length); process.exit(0); }
console.log("otp body keys:", Object.keys(j));
if (j.error_code) console.log("error_code:", j.error_code);
if (j.msg) console.log("msg (masked):", j.msg.slice(0, 12) + "…");
if (j.data) {
  console.log("data keys:", Object.keys(j.data));
  if (j.data.action_link) {
    const link = j.data.action_link;
    const q = link.split("?", 2)[1] || "";
    console.log("action_link returned, length:", link.length);
    for (const pair of q.split("&")) {
      const [k, v] = pair.split("=");
      console.log(`  ?${k}: len=${v ? v.length : 0}`);
    }
    // The link must carry OUR challenge binding; try verify now with OUR verifier
    const tokM = q.split("&").find((p) => p.startsWith("token="));
    if (tokM) {
      const token = decodeURIComponent(tokM.split("=")[1]);
      const vb = { type: "magiclink", token, email: QA_EMAIL, code_verifier: verifier };
      const vresp = await fetch(`${SUPA_URL}/auth/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify(vb),
      });
      const vj = await vresp.json();
      const hasTok = (k) => k === "access_token" || k === "refresh_token";
      console.log("verify-with-verifier status:", vresp.status, "| keys:", Object.keys(vj),
        "| access len:", vj.access_token ? vj.access_token.length : null,
        "| refresh len:", vj.refresh_token ? vj.refresh_token.length : null,
        "| session present:", !!vj.access_token,
        "| code present (pkce):", !!vj.code);
      if (!vj.access_token && vj.error_code) console.log("verify error_code:", vj.error_code);
    }
  }
}
console.log("done");