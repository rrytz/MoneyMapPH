// S5c navigation gate.
//
// Phase A — desktop reachability (1440/1280/1100/1024/900)
//   Proves the nine destinations stay reachable, the nav never wraps, and
//   horizontal overflow has a visible affordance at the compact desktop tier.
//
// Phase B — tier visibility sweep (12 widths, incl. 320 and the 1023/1024 edge)
//   Proves the "<1024px -> bottom nav only" rule actually holds, that exactly
//   ONE nav paints at any width, and that the nav row never overlaps the
//   topbar. This is coverage the original nav check lacked: it asserted a
//   selector existed at five widths but never asserted mutual exclusivity or
//   non-overlap, so a shell rendering both navs stacked on the topbar could
//   pass green. Same class of gap as the Rule D label-vs-result lesson.
//
//   NOT a bug, do not chase: a top nav at >=1024px is correct. That includes
//   iOS Safari "Request Desktop Website" (forces a desktop viewport) and a
//   tablet in landscape. Both are the user asking for the desktop layout at a
//   desktop width, so the top nav is the right answer.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REACHABILITY_WIDTHS = [1440, 1280, 1100, 1024, 900];
const VISIBILITY_WIDTHS = [320, 360, 375, 390, 414, 430, 540, 768, 900, 1023, 1024, 1280];

const cookieText = fs.readFileSync(path.join(os.tmpdir(), "mm-capture-cookie.txt"), "utf8");
const pairs = cookieText
  .split("; ")
  .map((p) => {
    const i = p.indexOf("=");
    return { name: p.slice(0, i), value: p.slice(i + 1) };
  })
  .filter((c) => c.name && c.value);

const browser = await chromium.launch({ headless: true });
let failures = 0;

async function openAt(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: "light" });
  await ctx.addCookies(pairs.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })));
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:3000/dashboard", { waitUntil: "load" });
  await pg.waitForFunction(() => !document.querySelector(".animate-pulse"), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(800);
  return { ctx, pg };
}

/**
 * Visibility means "painted", not a literal display keyword. The bottom <nav>
 * computes to `block` (its inner div is the flex row) and the top nav to
 * `flex`; asserting either keyword directly produced false failures. Measure
 * geometry + display:none instead. Shared by both phases so they cannot drift
 * into disagreeing about what "visible" means.
 */
const PROBE = () => {
  const top = document.querySelector('nav[aria-label="Primary navigation"], nav[aria-label="Primary"]');
  const bottom = document.querySelector("nav.fixed.bottom-0");
  const box = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) };
  };
  const shown = (el) => {
    if (!el) return false;
    if (getComputedStyle(el).display === "none") return false;
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  };
  const header = document.querySelector("header");
  const headerBox = box(header);
  const topBox = box(top);
  // The desktop nav renders directly below the topbar. Any intersection of the
  // two boxes is a shell collision.
  const overlap = !!(topBox && headerBox && topBox.w > 0 && topBox.top < headerBox.bottom && topBox.bottom > headerBox.top);
  return { top, bottom, topBox, headerBox, topShown: shown(top), bottomShown: shown(bottom), overlap };
};

// ---------------------------------------------------------------- Phase A
console.log("=== PHASE A — desktop reachability ===");
for (const width of REACHABILITY_WIDTHS) {
  const { ctx, pg } = await openAt(width);

  const result = await pg.evaluate(() => {
    const top = document.querySelector('nav[aria-label="Primary navigation"], nav[aria-label="Primary"]');
    const bottom = document.querySelector("nav.fixed.bottom-0");
    const shown = (el) => {
      if (!el || getComputedStyle(el).display === "none") return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    };
    const topVisible = shown(top);
    const bottomVisible = shown(bottom);
    const links = top ? [...top.querySelectorAll("a")] : [];
    const groupEls = top ? [...top.querySelectorAll("span")].filter((el) => el.textContent.trim()) : [];
    const reachable = [];

    if (topVisible && top) {
      for (const link of links) {
        link.scrollIntoView({ block: "nearest", inline: "nearest" });
        const linkBox = link.getBoundingClientRect();
        const navBox = top.getBoundingClientRect();
        if (linkBox.right >= navBox.left - 1 && linkBox.left <= navBox.right + 1) {
          reachable.push(link.getAttribute("href"));
        }
      }
      top.scrollLeft = 0;
    }

    return {
      topVisible,
      bottomVisible,
      links: links.map((link) => link.getAttribute("href")),
      reachable,
      groups: groupEls.map((el) => el.textContent.trim()),
      navRole: links.length > 0 && links.every((el) => el.classList.contains("type-nav")),
      groupRole: groupEls.every((el) => el.classList.contains("type-nav-group")),
      overflow: !!top && top.scrollWidth > top.clientWidth + 1,
      overflowAffordance: !!top?.parentElement?.querySelector('[class*="bg-gradient-to-l"]'),
      noWrap: !!top && top.scrollHeight <= top.clientHeight + 1,
      breadcrumbGone: !document.body.innerText.includes("Workspace"),
      sidebarGone: !document.querySelector('aside.h-screen, aside[class*="h-screen"]'),
    };
  });

  const isDesktopTier = width >= 1024;
  const pass = isDesktopTier
    ? result.topVisible && !result.bottomVisible && result.links.length === 9 &&
      result.reachable.length === 9 && result.navRole && result.groupRole && result.noWrap &&
      (!result.overflow || result.overflowAffordance)
    : !result.topVisible && result.bottomVisible && result.sidebarGone;

  if (!pass) failures++;
  console.log(`--- ${width}px --- ${pass ? "PASS" : "FAIL"}`);
  console.log(`  top nav: ${result.topVisible}  bottom nav: ${result.bottomVisible}`);
  console.log(`  links (${result.links.length}): ${result.links.join(", ")}`);
  console.log(`  reachable (${result.reachable.length}): ${result.reachable.join(", ")}`);
  console.log(`  groups: ${result.groups.join(" / ")}`);
  console.log(`  nav roles: ${result.navRole} / ${result.groupRole}`);
  console.log(`  overflow: ${result.overflow}  affordance: ${result.overflowAffordance}  no-wrap: ${result.noWrap}`);
  console.log(`  sidebar gone: ${result.sidebarGone}  breadcrumb gone: ${result.breadcrumbGone}`);

  await ctx.close();
}

// ---------------------------------------------------------------- Phase B
console.log("\n=== PHASE B — tier visibility / exclusivity / overlap ===");
for (const width of VISIBILITY_WIDTHS) {
  const { ctx, pg } = await openAt(width);
  const r = await pg.evaluate(PROBE);
  const hScroll = await pg.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );

  const isDesktopTier = width >= 1024;
  const exactlyOne = r.topShown !== r.bottomShown;
  const correctTier = r.topShown === isDesktopTier && r.bottomShown === !isDesktopTier;
  const pass = exactlyOne && correctTier && !r.overlap && !hScroll;
  if (!pass) failures++;

  console.log(
    `${String(width).padStart(4)}px ${pass ? "PASS" : "FAIL"}  ` +
      `topNav=${r.topShown ? "VISIBLE" : "hidden "}  ` +
      `bottomNav=${r.bottomShown ? "VISIBLE" : "hidden "}  ` +
      `exactlyOne=${exactlyOne}  ` +
      `header=${r.headerBox ? r.headerBox.top + "-" + r.headerBox.bottom : "-"}  ` +
      `navRow=${r.topBox ? r.topBox.top + "-" + r.topBox.bottom : "-"}  ` +
      `overlap=${r.overlap}  hScroll=${hScroll}`
  );
  if (!pass) console.log(`    expected tier: ${isDesktopTier ? "top nav only" : "bottom nav only"}`);
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nNAV GATE PASS" : `\nNAV GATE FAIL — ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
