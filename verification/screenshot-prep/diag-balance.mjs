// One-off: inspect the balance block in the headless probe context at read time.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cookieText = fs.readFileSync(path.join(os.tmpdir(), "mm-capture-cookie.txt"), "utf8");
const pairs = cookieText
  .split("; ")
  .map((p) => {
    const i = p.indexOf("=");
    return { name: p.slice(0, i), value: p.slice(i + 1) };
  })
  .filter((c) => c.name && c.value);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
await ctx.addCookies(pairs.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })));
const pg = await ctx.newPage();
await pg.goto("http://localhost:3000/dashboard", { waitUntil: "load" });
await pg.waitForFunction(() => !document.querySelector(".animate-pulse"), null, { timeout: 20000 }).catch(() => {});
await pg.waitForTimeout(800);

const r = await pg.evaluate(() => {
  const sec = document.querySelector('section[aria-label="Your balance"]');
  const cs = (el) => getComputedStyle(el);
  const vis = (el) => {
    const b = el.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), display: cs(el).display, visible: b.width > 0 && b.height > 0 && cs(el).display !== "none" };
  };
  const tabs = [...document.querySelectorAll('[class*="tabular-nums"]')];
  const inSec = sec ? tabs.filter((e) => sec.contains(e)) : [];
  return {
    sectionFound: !!sec,
    sectionChildren: sec ? sec.querySelectorAll("*").length : 0,
    totalTabular: tabs.length,
    inSectionTabular: inSec.length,
    inSectionInfo: inSec.map((e) => ({ fs: parseFloat(cs(e).fontSize), txt: (e.textContent || "").trim().slice(0, 12), ...vis(e) })),
    headerText: document.querySelector("header")?.innerText.replace(/\n+/g, " | "),
  };
});
console.log(JSON.stringify(r, null, 2));
await browser.close();
