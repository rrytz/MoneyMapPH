// Focused Accounts bypass check at 390x844 — dark (OS) vs light (class toggle).
// Selector targets the exact hard-coded bypass classes (bg-slate-900/80, /40).
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const COOKIE_FILE = path.join(os.tmpdir(), "mm-capture-cookie.txt");
const cookieText = fs.readFileSync(COOKIE_FILE, "utf8");
const cookiePairs = cookieText.split("; ").map((p) => {
  const i = p.indexOf("=");
  return { name: p.slice(0, i), value: p.slice(i + 1) };
}).filter((c) => c.name && c.value);

const PROBE = `(() => {
  const sel = '[class*="bg-slate-900/80"],[class*="bg-slate-900/40"],[class*="border-slate-800"]';
  return [...document.querySelectorAll(sel)].map((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      cls: el.className.split(' ').filter(c => c.includes('slate')).join(' '),
      bg: s.backgroundColor, border: s.borderColor, radius: s.borderRadius,
      w: Math.round(r.width), h: Math.round(r.height),
      text: (el.textContent || '').trim().slice(0, 18)
    };
  });
})()`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
await ctx.addCookies(cookiePairs.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })));

const pg = await ctx.newPage();
await pg.goto("http://localhost:3000/accounts", { waitUntil: "load" });
const dark = await pg.evaluate(PROBE);
await pg.evaluate(`(() => { document.documentElement.classList.remove('dark'); return document.documentElement.className; })()`);
const light = await pg.evaluate(PROBE);

console.log("DARK=" + JSON.stringify(dark, null, 1));
console.log("LIGHT=" + JSON.stringify(light, null, 1));
await browser.close();
console.log("DONE");