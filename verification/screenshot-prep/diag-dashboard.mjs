// Diagnostics round 4: ordered dump of rounded-2xl / rounded-xl / text-2xl elements with parents.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const COOKIE_FILE = path.join(os.tmpdir(), "mm-capture-cookie.txt");
const ck = fs.readFileSync(COOKIE_FILE, "utf8").split("; ").map((p) => {
  const i = p.indexOf("=");
  return { name: p.slice(0, i), value: p.slice(i + 1) };
}).filter((c) => c.name && c.value);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 816, height: 418 }, colorScheme: "dark" });
await ctx.addCookies(ck.map((c) => ({ ...c, domain: "localhost", path: "/" })));
const pg = await ctx.newPage();
await pg.goto("http://localhost:3000/dashboard", { waitUntil: "load" });
await pg.waitForTimeout(3000);
const r = await pg.evaluate(() => {
  const dump = (sel, max) => [...document.querySelectorAll(sel)].slice(0, max).map((el) => {
    const s = getComputedStyle(el);
    return {
      sel, cls: String(el.className).slice(0, 90),
      fs: s.fontSize, fw: s.fontWeight, padT: s.paddingTop,
      txt: (el.textContent || "").trim().slice(0, 24),
      vis: el.getBoundingClientRect().width + "x" + el.getBoundingClientRect().height,
    };
  });
  return {
    r2xl: dump('[class*="rounded-2xl"]', 20),
    byLabel: [...document.querySelectorAll("p,span")].filter((el) => {
      const t = (el.textContent || "").trim();
      return t.length < 40 && /Remaining|Tracked|Liquid|Safe to Spend|outstanding/.test(t);
    }).slice(0, 20).map((el) => ({
      tag: el.tagName, txt: (el.textContent || "").trim().slice(0, 30),
      cls: String(el.className).slice(0, 80), fs: getComputedStyle(el).fontSize,
      hidden: getComputedStyle(el).display === "none",
    })),
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();