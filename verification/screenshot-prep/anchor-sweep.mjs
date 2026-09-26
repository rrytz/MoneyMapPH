// S5b — 9-route shell-anchor sweep.
// The balance readout is the S5b shell anchor: it must render the SAME
// correct value on every route, in both worlds, and must never show a
// hardcoded zero or a wrong number. This is read-only verification of the
// user-facing promise, run across all nine dashboard routes at desktop width.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROUTES = [
  "/dashboard",
  "/accounts",
  "/income",
  "/expenses",
  "/budgets",
  "/savings",
  "/transactions",
  "/forecasting",
  "/simulator",
  "/settings",
];

const cookieText = fs.readFileSync(path.join(os.tmpdir(), "mm-capture-cookie.txt"), "utf8");
const pairs = cookieText
  .split("; ")
  .map((p) => {
    const i = p.indexOf("=");
    return { name: p.slice(0, i), value: p.slice(i + 1) };
  })
  .filter((c) => c.name && c.value);

const READ = `(() => {
  const header = document.querySelector('header');
  if (!header) return { found: false };
  const text = header.innerText.replace(/\\n+/g, ' | ');
  // The anchor figure: the peso amount rendered in the header, plus the
  // account count and the safe-to-spend meter width.
  const peso = (text.match(/₱[\\d,]+\\.\\d{2}/) || [null])[0];
  const accounts = (text.match(/(\\d+)\\s+accounts?/i) || [null])[1];
  const meter = header.querySelector('div[style*="width"]');
  return {
    found: true,
    peso: peso,
    accounts: accounts ? Number(accounts) : null,
    meterWidth: meter ? meter.style.width : null,
    notZero: peso !== '₱0.00',
    world: document.documentElement.className.includes('dark') ? 'dark' : 'light',
  };
})()`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
await ctx.addCookies(pairs.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })));

const table = [];
for (const route of ROUTES) {
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:3000" + route, { waitUntil: "load" });
  await pg.waitForFunction(() => !document.querySelector(".animate-pulse"), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  const light = await pg.evaluate(READ);
  await pg.evaluate(`(() => { document.documentElement.classList.add('dark'); })()`);
  await pg.waitForTimeout(300);
  const dark = await pg.evaluate(READ);
  await pg.close();
  table.push({ route, light, dark });
}
await browser.close();

console.log("ROUTE            WORLD  HEADER  PESO         ACCTS  METER   NOT-ZERO");
let allOk = true;
for (const row of table) {
  for (const w of ["light", "dark"]) {
    const r = row[w];
    const ok = r.found && r.notZero && r.peso === table[0].light.peso && r.accounts === table[0].light.accounts;
    if (!ok) allOk = false;
    console.log(
      `${row.route.padEnd(15)} ${w.padEnd(6)} ${(r.found ? "yes" : "NO").padEnd(7)} ${String(r.peso || "—").padEnd(12)} ${String(r.accounts ?? "—").padEnd(6)} ${String(r.meterWidth || "—").padEnd(7)} ${r.notZero ? "yes" : "NO"} ${ok ? "" : "  <-- MISMATCH"}`
    );
  }
}
console.log("REFERENCE (dashboard light):", table[0].light.peso, "across", table[0].light.accounts, "accounts");
console.log(allOk ? "ALL_ROUTES_CONSISTENT" : "ROUTE_INCONSISTENCY_DETECTED");
