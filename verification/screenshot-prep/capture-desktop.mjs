// Desktop capture pass — headless Chromium at 816x418 with the session cookie.
// Methodology mirrors the harness desktop pass:
//   dark  = OS-default column (colorScheme: 'dark', like the harness osDark)
//   light = class-toggle column (remove .dark from <html>)
// Evidence labeling: light is token-render proof, NOT system-detection proof.
// The cookie is read from a temp file (never logged); probes print shapes only.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const COOKIE_FILE = path.join(os.tmpdir(), "mm-capture-cookie.txt");
const OUT_DIR = path.join(import.meta.dirname, "..", "evidence", "shots", "desktop");
const PAGES = ["/dashboard", "/expenses", "/accounts", "/settings"];
const BASE = "http://localhost:3000";

if (!fs.existsSync(COOKIE_FILE)) {
  console.error("NO_COOKIE_FILE");
  process.exit(1);
}
const cookieText = fs.readFileSync(COOKIE_FILE, "utf8");
const cookiePairs = cookieText.split("; ").map((p) => {
  const i = p.indexOf("=");
  return { name: p.slice(0, i), value: p.slice(i + 1) };
}).filter((c) => c.name && c.value);

const PROBE = `(() => {
  const cs = (el) => getComputedStyle(el);
  const out = { w: innerWidth, url: location.pathname, themeClass: document.documentElement.className };
  out.bodyBg = cs(document.body).backgroundColor;
  // Account-card bypass check: any element using the hard-coded slate-900 classes
  out.bypassElements = [...document.querySelectorAll('[class*="slate-900"], [class*="bg-slate-900"]')].slice(0, 6).map((el) => {
    const s = cs(el);
    return { cls: el.className.split(' ').filter(c => c.includes('slate-900') || c.includes('rounded')).slice(0, 3).join(' '), bg: s.backgroundColor, color: s.color };
  });
  out.cardSamples = [...document.querySelectorAll('[class*="rounded-2xl"]')].slice(0, 4).map((el) => {
    const s = cs(el); const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), radius: s.borderRadius, bg: s.backgroundColor, shadow: s.boxShadow === "none" ? "none" : "shadow" };
  });
  out.radiusCounts = { square: document.querySelectorAll('[class*="rounded-none"]').length, sm: document.querySelectorAll('[class*="rounded-sm"]').length, lg: document.querySelectorAll('[class*="rounded-lg"]').length, xl: document.querySelectorAll('[class*="rounded-xl"]').length, x2l: document.querySelectorAll('[class*="rounded-2xl"]').length };
  out.mobileNav = !!document.querySelector('nav.fixed.bottom-0');
  const bs = cs(document.body);
  out.fontFamilies = [...new Set([...document.querySelectorAll('h1,h2,h3,h4')].map(el => cs(el).fontFamily.split(',')[0]))];
  let em = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = walker.nextNode())) {
    const t = n.nodeValue || "";
    const emojis = [...t].filter((c) => c.codePointAt(0) > 0x1F000 || (c.codePointAt(0) >= 0x2600 && c.codePointAt(0) <= 0x27BF));
    if (emojis.length) { em.push(emojis.join("")); if (em.length > 8) break; }
  }
  out.emojis = em.slice(0, 6);
  return out;
})()`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 816, height: 418 },
  colorScheme: "light",
});
await ctx.addCookies(cookiePairs.map((c) => ({
  name: c.name, value: c.value, domain: "localhost", path: "/",
})));
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = {};
for (const page of PAGES) {
  const r = { page };
  const pg = await ctx.newPage();
  await pg.goto(BASE + page, { waitUntil: "load" });
  // Settle before capture: `load` fires before client hydration, and the
  // slowest surfaces (settings) were being screenshotted as skeleton
  // shells. Wait for the loading pulses to clear so the dark column
  // captures the same settled state as the light column.
  await pg.waitForFunction(() => !document.querySelector('.animate-pulse'), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(500);
  // Light (OS-default) column
  r.lightProbe = await pg.evaluate(PROBE);  await pg.screenshot({ path: path.join(OUT_DIR, page.slice(1) + "-desktop-light.png"), fullPage: true });
  // Dark (class-toggle) column
  await pg.evaluate(`(() => { document.documentElement.classList.add('dark'); return document.documentElement.className; })()`);
  r.darkProbe = await pg.evaluate(PROBE);
  await pg.screenshot({ path: path.join(OUT_DIR, page.slice(1) + "-desktop-dark.png"), fullPage: true });
  await pg.close();
  results[page] = r;
  console.log(JSON.stringify({ page, darkBg: r.darkProbe.bodyBg, lightBg: r.lightProbe.bodyBg }));
}
// Bypass constancy headline (Accounts, both themes)
const acct = results["/accounts"];
console.log("ACCOUNTS_DARK_BYPASS=" + JSON.stringify(acct.darkProbe.bypassElements.map(b => b.bg)));
console.log("ACCOUNTS_LIGHT_BYPASS=" + JSON.stringify(acct.lightProbe.bypassElements.map(b => b.bg)));
console.log("BYTE_LIGHT=" + fs.statSync(path.join(OUT_DIR, "accounts-desktop-light.png")).size);
console.log("BYTE_DARK=" + fs.statSync(path.join(OUT_DIR, "accounts-desktop-dark.png")).size);
await browser.close();
console.log("DONE");