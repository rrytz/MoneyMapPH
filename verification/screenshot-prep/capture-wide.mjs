// Wide-desktop capture pass — headless Chromium at 1280x800.
//
// Why this exists (S5b): the shell's desktop navigation only renders above the
// lg breakpoint (1024px), but the gate's historical "desktop" column is 816px
// (iPad portrait). So the 816 captures screenshot a tablet layout with the
// bottom-nav and the desktop top-nav — the shell's primary navigation — was
// never in the shot matrix. This pass captures the real desktop layout.
//
//   light = OS-default column (colorScheme: 'light')
//   dark  = class-toggle column (add .dark to <html>)
// The cookie is read from a temp file (never logged); probes print shapes only.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const COOKIE_FILE = path.join(os.tmpdir(), "mm-capture-cookie.txt");
const OUT_DIR = path.join(import.meta.dirname, "..", "evidence", "shots", "wide");
const PAGES = ["/dashboard", "/expenses", "/accounts", "/settings"];
const BASE = "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 800 };

if (!fs.existsSync(COOKIE_FILE)) {
  console.error("NO_COOKIE_FILE");
  process.exit(1);
}
const cookieText = fs.readFileSync(COOKIE_FILE, "utf8");
const cookiePairs = cookieText
  .split("; ")
  .map((p) => {
    const i = p.indexOf("=");
    return { name: p.slice(0, i), value: p.slice(i + 1) };
  })
  .filter((c) => c.name && c.value);

const NAV_PROBE = `(() => {
  const cs = (el) => getComputedStyle(el);
  const top = document.querySelector('nav[aria-label="Primary navigation"], nav[aria-label="Primary"]');
  const bottom = document.querySelector('nav.fixed.bottom-0');
  const topBox = top ? top.getBoundingClientRect() : null;
  return {
    themeClass: document.documentElement.className,
    bodyBg: cs(document.body).backgroundColor,
    topNavVisible: !!topBox && topBox.height > 0,
    topNavLinks: top ? top.querySelectorAll('a').length : 0,
    topNavGroups: top ? [...top.querySelectorAll('span')].map(s => s.textContent.trim()).filter(Boolean) : [],
    bottomNavVisible: !!bottom && cs(bottom).display !== 'none',
    // Match the legacy sticky full-height sidebar, not semantic <aside> content
    // such as the attention strip.
    sidebarPresent: !!document.querySelector('aside.h-screen, aside[class*="h-screen"]'),
    breadcrumbPresent: /Workspace\\s*.?\\s*Overview/.test(document.body.innerText),
    shellAnchor: (() => { const h = document.querySelector('header'); return h ? h.innerText.replace(/\\n+/g, ' | ') : ''; })(),
  };
})()`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VIEWPORT, colorScheme: "light" });
await ctx.addCookies(cookiePairs.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })));
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = {};
for (const page of PAGES) {
  const r = { page };
  const pg = await ctx.newPage();
  await pg.goto(BASE + page, { waitUntil: "load" });
  await pg.waitForFunction(() => !document.querySelector(".animate-pulse"), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(500);
  // Light (OS-default) column
  r.light = await pg.evaluate(NAV_PROBE);
  await pg.screenshot({ path: path.join(OUT_DIR, page.slice(1) + "-wide-light.png"), fullPage: true });
  // Dark (class-toggle) column
  await pg.evaluate(`(() => { document.documentElement.classList.add('dark'); return document.documentElement.className; })()`);
  r.dark = await pg.evaluate(NAV_PROBE);
  await pg.screenshot({ path: path.join(OUT_DIR, page.slice(1) + "-wide-dark.png"), fullPage: true });
  await pg.close();
  results[page] = r;
  const nav = r.dark;
  console.log(
    JSON.stringify({
      page,
      topNav: nav.topNavVisible,
      links: nav.topNavLinks,
      bottomNav: nav.bottomNavVisible,
      sidebar: nav.sidebarPresent,
      breadcrumb: nav.breadcrumbPresent,
    })
  );
}
await browser.close();
console.log("DONE");
