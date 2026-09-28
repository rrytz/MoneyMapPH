// S5d: brand card legibility contract.
//
// WHY THIS IS A BROWSER CHECK AND NOT A UNIT TEST
//
// The brand palette's own tests verify the VALUES. This bug was not a bad
// value - every contrast ratio in the palette was correct and all 52 tests
// passed. The bug was that account-card.tsx never CONSUMED the palette: the
// text still used `text-card-foreground` and `text-muted-foreground`, which
// resolve dark in light mode, so a dark brand base got near-black text. A test
// on the palette cannot see that, and jsdom cannot either - it does not resolve
// CSS custom properties or cascade from the real stylesheet, so getComputedStyle
// there returns the declared value and every assertion passes on broken code.
//
// So: a real browser, real cascade, both colour schemes.
//
// ------------------------------------------------------------------
// THE ASSERTION THAT MATTERS
//
// Not "the contrast is fine" - that is the palette test again. This asserts
//
//     the card's computed colours are IDENTICAL in light and dark
//
// A brand-coloured card is theme-proof by definition: the base is a fixed dark
// brand colour in both schemes, so every colour on it must be too. Any element
// still resolving a theme token changes value between the two schemes - and
// that difference IS the bug, whether or not it happens to fail contrast today.
// This catches the class, not the instance, and it does not need to know which
// brands the user happens to have created.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

// DETERMINISM: this is a hard dependency in the gate chain. A flaky gate gets
// disabled, and a disabled gate is the same "control that exists in intent but
// not in enforcement" this check was written to replace. So: no waitForTimeout,
// no animation waits, no reliance on layout timing. Everything below is read
// from getComputedStyle after an explicit networkidle + a fonts-ready signal.
const MIN_TEXT_CONTRAST = 4.5;
const CONTRAST_POLICY =
  "WCAG AA, applied UNIFORMLY at 4.5:1 - stricter than WCAG, which allows 3:1 for " +
  "large text (>=24px, or >=18.66px bold). Deliberate: every label on this card is " +
  "small, and one floor for the whole card removes a judgement call per element. " +
  "A future palette that cannot clear 4.5 on a LARGE display figure is a real " +
  "decision - change the brand or lower the floor deliberately, not silently.";
const SCHEMES = ["light", "dark"];

const cookieText = fs.readFileSync(path.join(os.tmpdir(), "mm-capture-cookie.txt"), "utf8");
const pairs = cookieText
  .split("; ")
  .map((p) => {
    const i = p.indexOf("=");
    return { name: p.slice(0, i), value: decodeURIComponent(p.slice(i + 1)) };
  })
  .filter((c) => c.name && c.value);

let failures = 0;
const fail = (m) => {
  failures++;
  console.log(`    FAIL  ${m}`);
};

// Runs in the page. Collects every text-bearing element inside a brand card,
// with the colours the browser ACTUALLY resolved.
const COLLECT = () => {
  const visible = (el) => {
    if (el.checkVisibility) return el.checkVisibility({ checkVisibilityCSS: true });
    let n = el;
    while (n && n !== document.documentElement) {
      if (getComputedStyle(n).display === "none") return false;
      n = n.parentElement;
    }
    return true;
  };

  const roots = [];
  for (const el of document.querySelectorAll("main div")) {
    if (!visible(el)) continue;
    // the card root is the one carrying the inline brand background
    if (!el.style.backgroundColor) continue;
    if (!/Starting Balance/i.test(el.textContent || "")) continue;
    roots.push(el);
  }
  const cards = roots.filter((e) => !roots.some((o) => o !== e && o.contains(e)));

  return cards.map((card) => {
    const cs = getComputedStyle(card);
    const texts = [];
    for (const el of card.querySelectorAll("*")) {
      if (el.children.length) continue; // leaf text only
      const t = (el.textContent || "").trim();
      if (!t) continue;
      const b = el.getBoundingClientRect();
      if (b.height === 0 || b.width === 0) continue;
      texts.push({
        t: t.slice(0, 24),
        color: getComputedStyle(el).color,
        // the NEAREST opaque ancestor background, which is the surface this
        // text is actually read against - not the page behind the card
        bg: (() => {
          let n = el;
          while (n && n !== card.parentElement) {
            const s = getComputedStyle(n);
            if (s.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor)) return s.backgroundColor;
            n = n.parentElement;
          }
          return cs.backgroundColor;
        })(),
      });
    }
    return {
      name: (card.querySelector("h3") || {}).textContent || "(unnamed)",
      base: cs.backgroundColor,
      border: cs.borderTopColor,
      divider: (() => {
        const d = [...card.querySelectorAll("*")].find((e) => {
          const s = getComputedStyle(e);
          return s.borderTopWidth !== "0px" && s.borderTopStyle !== "none";
        });
        return d ? getComputedStyle(d).borderTopColor : null;
      })(),
      texts,
      geometry: `${Math.round(card.getBoundingClientRect().width)}x${Math.round(card.getBoundingClientRect().height)}`,
      clipped: [...card.querySelectorAll("*")].filter(
        (e) =>
          e.children.length === 0 &&
          (e.textContent || "").trim() &&
          e.getBoundingClientRect().right > card.getBoundingClientRect().right - 0.5
      ).length,
    };
  });
};

const toRgb = (css) => {
  const m = String(css).match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : null;
};
const luminance = (css) => {
  const c = toRgb(css);
  if (!c) return null;
  const [r, g, b] = c.map((v) => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  if (l1 === null || l2 === null) return null;
  const [hi, lo] = l1 < l2 ? [l2, l1] : [l1, l2];
  return (hi + 0.05) / (lo + 0.05);
};

const browser = await chromium.launch({ headless: true });
const byScheme = {};

for (const scheme of SCHEMES) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, colorScheme: scheme });
  await ctx.addCookies(pairs.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })));
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(30000);
  await pg.goto("http://localhost:3000/accounts", { waitUntil: "networkidle" });
  // Determinism: fonts.ready is the real "text has its final metrics" signal.
  // A timeout here would hide a layout shift, and layout timing is what makes a
  // rendered check flaky.
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForFunction(
    () => [...document.querySelectorAll("main div")].some(
      (el) => el.style.backgroundColor && /Starting Balance/i.test(el.textContent || "")
    ),
    null,
    { timeout: 15000 }
  );
  byScheme[scheme] = await pg.evaluate(COLLECT);
  await ctx.close();
}

const light = byScheme.light;
const dark = byScheme.dark;

console.log("=== S5d: brand card legibility contract ===");
console.log(`  cards found: ${light.length} (light) / ${dark.length} (dark)`);
if (light.length === 0) {
  fail("no brand cards found - the check would pass vacuously on an empty page");
}

for (const [i, lc] of light.entries()) {
  const dc = dark[i];
  if (!dc) {
    fail(`${lc.name}: present in light, absent in dark`);
    continue;
  }
  console.log(`\n  ${lc.name}  base ${lc.base}  ${lc.geometry}`);

  // 1. The card base is brand-fixed, so it must not change with the theme.
  if (lc.base !== dc.base) fail(`${lc.name}: base changes with the theme (${lc.base} -> ${dc.base})`);

  // 2. Every text element must also be theme-independent. THIS is the assertion
  //    that would have caught the original bug.
  for (const [j, lt] of lc.texts.entries()) {
    const dt = dc.texts[j];
    if (!dt) {
      fail(`${lc.name}: "${lt.t}" present in light, absent in dark`);
      continue;
    }
    if (dt.t !== lt.t) {
      fail(`${lc.name}: text order differs between schemes at index ${j}`);
      continue;
    }
    if (lt.color !== dt.color) {
      fail(
        `${lc.name}: "${lt.t}" is THEME-DEPENDENT - ${lt.color} in light, ${dt.color} in dark. ` +
          `A brand card must carry its own colours; it is not a themed surface.`
      );
    }
    const ratio = contrast(lt.color, lt.bg);
    if (ratio !== null && ratio < MIN_TEXT_CONTRAST) {
      fail(`${lc.name}: "${lt.t}" ${lt.color} on ${lt.bg} is ${ratio.toFixed(2)}:1, below the ${MIN_TEXT_CONTRAST}:1 floor. ${CONTRAST_POLICY}`);
    }
  }

  // 3. The hairline must come from the brand, not `border-border` - that token is
  //    dark in light mode and would vanish against a dark brand base.
  if (lc.divider && lc.divider !== dc.divider) {
    fail(`${lc.name}: divider colour is theme-dependent (${lc.divider} -> ${dc.divider})`);
  }
  if (lc.border && lc.border !== dc.border) {
    fail(`${lc.name}: card border is theme-dependent (${lc.border} -> ${dc.border})`);
  }
  const borderRatio = lc.divider ? contrast(lc.divider, lc.base) : null;
  if (borderRatio !== null && borderRatio < 1.2) {
    fail(`${lc.name}: divider is invisible against its own base (${borderRatio.toFixed(2)}:1)`);
  }

  // 4. Geometry and clipping are unchanged by colour.
  if (lc.geometry !== dc.geometry) fail(`${lc.name}: geometry differs between schemes`);
  if (lc.clipped > 0) fail(`${lc.name}: ${lc.clipped} clipped text element(s)`);
}

const names = light.map((c) => c.name);
console.log(`\n  brands exercised: ${names.join(", ")}`);
if (new Set(light.map((c) => c.base)).size !== light.length) {
  fail("two cards share a base - the brand is not reaching the card");
}

await browser.close();
console.log(failures === 0 ? "\nBRAND GATE PASS" : `\nBRAND GATE FAIL - ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
