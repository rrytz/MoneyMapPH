import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Resolve from this file location, not process.cwd() (gate-hygiene rule).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

// Load .env.local if env vars aren't already set
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const req = createRequire(path.join(ROOT, "package.json"));
const { createServerClient } = req("@supabase/ssr");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function getGateCookies() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env");
  }
  const email = process.env.GATE_USER_EMAIL;
  const password = process.env.GATE_USER_PASSWORD;
  if (!email || !password) {
    throw new Error("Missing GATE_USER_EMAIL or GATE_USER_PASSWORD in env");
  }

  const captured = [];
  const store = new Map();

  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return [...store.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          if (value) {
            store.set(name, value);
            captured.push({ name, value });
          } else {
            store.delete(name);
          }
        });
      },
    },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error("Gate auth failed: " + error.message);
  }
  if (!data.session) {
    throw new Error("Gate auth succeeded but no session returned");
  }

  // Deduplicate: setAll may be called multiple times; keep the last value per name
  const deduped = new Map();
  for (const c of captured) {
    deduped.set(c.name, c.value);
  }
  const cookies = [...deduped.entries()].map(([name, value]) => ({ name, value }));

  if (cookies.length === 0) {
    throw new Error("Gate auth succeeded but no cookies were captured. Check @supabase/ssr cookie handling.");
  }

  return cookies;
}

// Convenience: load cookies the same way loadAuthCookies() did, but from env auth.
// Drop-in replacement for loadAuthCookies() in gate scripts.
export async function loadAuthCookies() {
  return getGateCookies();
}
