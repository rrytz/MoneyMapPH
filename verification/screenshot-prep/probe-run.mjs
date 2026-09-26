// Probe runner — Slice-gate DOM matrix.
// Widths (S5b): the old 816px "desktop" column is iPad-portrait width, BELOW
// the lg breakpoint (1024), so it renders a tablet layout with the bottom-nav
// and never exercises the desktop top-nav. Added `wide` 1280 so the primary
// navigation is actually in the matrix. 816 stays as the tablet column.
//   wide   = headless 1280x800 (desktop; top-nav visible, all 9 destinations)
//   tablet = headless 816x418  (harness physical window; bottom-nav)
//   mobile = headless 390x844
//   light  = OS-default column (colorScheme: 'light')
//   dark   = class-toggle column (add .dark to <html>)
// Assert (g) is width-aware: exactly one nav at any width; top-nav (9 links)
// only at >=1024; sidebar + breadcrumb gone everywhere.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HERE = import.meta.dirname;
const COOKIE_FILE = path.join(os.tmpdir(), "mm-capture-cookie.txt");
const OUT_DIR = path.join(HERE, "..", "evidence", "probes");
const PAGES = ["/dashboard", "/expenses", "/accounts", "/settings"];
const BASE = "http://localhost:3000";
const VIEWPORTS = [
  { name: "wide", width: 1280, height: 800 },
  { name: "tablet", width: 816, height: 418 },
  { name: "mobile", width: 390, height: 844 },
];

if (!fs.existsSync(COOKIE_FILE)) {
  console.error("NO_COOKIE_FILE");
  process.exit(1);
}
const cookieText = fs.readFileSync(COOKIE_FILE, "utf8");
const cookiePairs = cookieText.split("; ").map((p) => {
  const i = p.indexOf("=");
  return { name: p.slice(0, i), value: p.slice(i + 1) };
}).filter((c) => c.name && c.value);

const PROBE = fs.readFileSync(path.join(HERE, "probe-dom.js"), "utf8");

const browser = await chromium.launch({ headless: true });
const results = {};

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    colorScheme: "light",
  });
  await ctx.addCookies(cookiePairs.map((c) => ({
    name: c.name, value: c.value, domain: "localhost", path: "/",
  })));
  for (const page of PAGES) {
    const r = { page, viewport: vp.name };
    const pg = await ctx.newPage();
    await pg.goto(BASE + page, { waitUntil: "load" });
    // Settle before probing: `load` fires before client hydration, and the
    // balance block (the dominant figure assert c measures) is client-rendered.
    // Wait for loading pulses to clear, matching the capture scripts, so the
    // probe and the shots observe the same settled state.
    await pg.waitForFunction(() => !document.querySelector(".animate-pulse"), null, { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(800);
    // Light (OS-default) column — S5a light-first inverted the convention
    r.light = await pg.evaluate(PROBE);
    // Dark (class-toggle) column — now the *additive* direction
    await pg.evaluate(`(() => { document.documentElement.classList.add('dark'); return document.documentElement.className; })()`);
    r.dark = await pg.evaluate(PROBE);
    await pg.close();
    results[`${vp.name}:${page}`] = r;
  }
  await ctx.close();
}
await browser.close();

fs.mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(OUT_DIR, `probes-${stamp}.json`);
fs.writeFileSync(outFile, JSON.stringify(results, null, 2), "utf8");

// Compact asserts table
const cell = (v) => (v ? "PASS" : "FAIL").padEnd(4);
console.log("CONFIG                    a     b     c     d     e     f     g     h     i     j     ALL");
for (const [key, r] of Object.entries(results)) {
  for (const theme of ["dark", "light"]) {
    const A = r[theme].asserts;
    console.log(
      `${key.padEnd(14)} ${theme.padEnd(5)} ${cell(A.a.pass)} ${cell(A.b.pass)} ${cell(A.c.pass)} ${cell(A.d.pass)} ${cell(A.e.pass)} ${cell(A.f.pass)} ${cell(A.g.pass)} ${cell(A.h.pass)} ${cell(A.i.pass)} ${cell(A.j.pass)} ${cell(A.allPass)}`
    );
  }
}
console.log("SAVED=" + outFile);

// Rich evidence per surface for the ledger
for (const [key, r] of Object.entries(results)) {
  const A = r.dark.asserts;
  console.log(`--- ${key} (dark) ---`);
  if (A.c.sizes.length) console.log("  c sizes:", JSON.stringify(A.c.sizes));
  if (A.b.large.length) console.log("  b large:", JSON.stringify(A.b.large.slice(0, 5)));
  if (A.a.violations.length) console.log("  a first:", JSON.stringify(A.a.violations.slice(0, 4)));
  if (A.d.violations.length) console.log("  d first:", JSON.stringify(A.d.violations.slice(0, 4)));
  const AL = r.light.asserts;
  if (AL.e.world === "light(toggle)" && AL.e.violations.length) {
    console.log(`  e light-world first:`, JSON.stringify(AL.e.violations.slice(0, 5)));
  }
  if (r.dark.asserts.f.found.length) {
    console.log(`  f EMOJI dark:`, JSON.stringify(r.dark.asserts.f.found.slice(0, 5)));
  }
  if (AL.f.found.length) {
    console.log(`  f EMOJI light:`, JSON.stringify(AL.f.found.slice(0, 5)));
  }
  console.log("  e worlds:", AL.e.world, "| dark bodyInk:", JSON.stringify(A.e.bodyInk), "| light bodyInk:", JSON.stringify(AL.e.bodyInk));
  const G = A.g;
  if (!G.pass) {
    console.log(`  g NAV:`, JSON.stringify(G));
  }
  if (!A.h.pass) {
    console.log(`  h H1:`, JSON.stringify(A.h));
  }
  if (!A.i.pass) {
    console.log(`  i FIGURES:`, JSON.stringify(A.i));
  }
  if (!A.j.pass) {
    console.log(`  j FACE COHERENCE:`, JSON.stringify(A.j));
  }
}
console.log("DONE");