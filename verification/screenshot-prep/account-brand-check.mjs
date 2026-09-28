// S5d: brand card legibility contract - RESTING state.
//
// Pseudo-states (hover / focus-visible / archived) live in
// account-brand-states-check.mjs, which this script's gate:all entry runs
// immediately after. They are split because they need different mechanics -
// real pointer movement and real Tab traversal - and merging them would put a
// 10s interaction sequence behind every run of the fast resting check.
//
// WHY A BROWSER AND NOT jsdom
//
// The palette's unit tests verify the VALUES. The bug this gate exists for was
// not a bad value - every contrast ratio in the palette was correct and all 52
// tests passed. The component never CONSUMED the palette: text resolved
// `text-card-foreground`, which is dark in light mode, so a dark brand base got
// 1.01:1 text. jsdom cannot catch that - it does not resolve custom properties
// or cascade from the real stylesheet, so getComputedStyle there returns the
// declared value and every assertion passes on broken code.
//
// THE INVARIANT
//
// Not "the contrast is fine" - that is the palette test again, and it is
// instance knowledge: you must know which elements exist, what they sit on and
// what the threshold is.
//
//     A brand-coloured card is theme-proof by definition, so every colour on it
//     must be IDENTICAL in light and dark.
//
// Any element still resolving a theme token changes between the two schemes,
// and that difference IS the bug whether or not it fails contrast today.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

export const MIN_TEXT_CONTRAST = 4.5;

export const CONTRAST_POLICY =
  "WCAG AA applied UNIFORMLY at 4.5:1 - stricter than WCAG, which allows 3:1 for " +
  "large text (>=24px, or >=18.66px bold). Deliberate: every label on this card is " +
  "small, and one floor for the whole card removes a per-element judgement. A " +
  "future palette that cannot clear 4.5 on a LARGE display figure is a real " +
  "decision - change the brand or lower the floor deliberately, not silently.";

// DETERMINISM. This is a hard dependency in the gate chain; a flaky gate gets
// disabled, and a disabled gate is the control-in-intent-not-enforcement this
// was written to replace. So: no waitForTimeout, no animation waits, no
// reliance on layout timing, and no reliance on prefers-reduced-motion - which
// in this codebase gates only `.auth-*` animation and leaves `transition-all`
// on the card root running.
export const KILL_MOTION =
  "* { transition: none !important; animation: none !important; }";

export async function loadAuthCookies() {
  const cookieText = fs.readFileSync(
    path.join(os.tmpdir(), "mm-capture-cookie.txt"),
    "utf8"
  );
  return cookieText
    .split("; ")
    .map((p) => {
      const i = p.indexOf("=");
      return { name: p.slice(0, i), value: decodeURIComponent(p.slice(i + 1)) };
    })
    .filter((c) => c.name && c.value);
}

/** Open the accounts page in a real browser with motion killed and a settled DOM. */
export async function openAccounts(browser, { scheme, width = 375, height = 667, url = "http://localhost:3000/accounts" }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  await ctx.addCookies(
    (await loadAuthCookies()).map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" }))
  );
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(30000);
  // Motion is killed AFTER navigation, not before. `addStyleTag` injects into
  // the CURRENT document, and `goto` replaces that document wholesale - so the
  // tag added first is silently discarded, every transition stays live, and
  // hover readings come back mid-animation. That is not theoretical: it is why
  // the cleanup click in this file's own fixture path timed out on a moving
  // element. The order is the fix.
  await pg.goto(url, { waitUntil: "networkidle" });
  await pg.addStyleTag({ content: KILL_MOTION });
  // Deterministic settling: fonts resolved, then the cards themselves present.
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForFunction(
    () => document.querySelector("[data-account-card]") !== null,
    null,
    { timeout: 15000 }
  );
  return { ctx, pg };
}

export const toRgb = (css) => {
  const m = String(css).match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : null;
};

export const toRgba = (css) => {
  const m = String(css).match(/[\d.]+/g);
  if (!m || m.length < 3) return null;
  return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 };
};

/** Composite a possibly-translucent colour over an opaque backdrop. */
export const over = (fg, bg) => {
  const f = toRgba(fg);
  if (!f) return bg;
  if (f.a >= 1) return `rgb(${f.r}, ${f.g}, ${f.b})`;
  const b = toRgba(bg) || { r: 255, g: 255, b: 255, a: 1 };
  return `rgb(${Math.round(f.r * f.a + b.r * (1 - f.a))}, ${Math.round(
    f.g * f.a + b.g * (1 - f.a)
  )}, ${Math.round(f.b * f.a + b.b * (1 - f.a))})`;
};

/**
 * The fully-composited colour a text leaf or icon is actually painted against.
 *
 * An earlier version returned the NEAREST element with any non-transparent
 * background, which is wrong whenever that background is translucent. The
 * trigger's hover sets a 12%-alpha brand wash; reading it as if it were opaque
 * reported the icon at 1.00:1 against a 100%-white-ish colour, and the honest
 * surface is that wash composited over the card base underneath. Measuring a
 * value the user never sees is the same class of error as the original bug, so
 * the whole ancestor chain is composited rather than stopped at the first hit.
 */
export const paintedBg = `(leaf, card) => {
  const toRgba = ${toRgba.toString()};
  const over = ${over.toString()};
  const stack = [];
  let n = leaf;
  while (n && n !== card.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) stack.push(c);
    n = n.parentElement;
  }
  let out = getComputedStyle(card).backgroundColor;
  for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
  return out;
}`;

export const luminance = (css) => {
  const c = toRgb(css);
  if (!c) return null;
  const [r, g, b] = c.map((v) => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a, b) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  if (l1 === null || l2 === null) return null;
  const [hi, lo] = l1 < l2 ? [l2, l1] : [l1, l2];
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * The card roots: the elements carrying the inline brand background.
 * Selected by that inline style rather than by a class, so a change to the card's
 * class list cannot silently make this check vacuous.
 */
export const COLLECT = () => {
  const visible = (el) => {
    if (el.checkVisibility) return el.checkVisibility({ checkVisibilityCSS: true });
    let n = el;
    while (n && n !== document.documentElement) {
      if (getComputedStyle(n).display === "none") return false;
      n = n.parentElement;
    }
    return true;
  };
  // Selected by the card's own structural marker, NOT by an inline background.
  // The first version filtered on `el.style.backgroundColor`, which meant a card
  // that did not paint a brand base was invisible to the whole gate - and the
  // archived state does not paint one. So the archived "check" was silently
  // re-measuring seven ACTIVE cards and reporting them as archived coverage. A
  // selector that cannot distinguish the state under test is not a selector.
  const roots = [];
  for (const el of document.querySelectorAll("[data-account-card]")) {
    if (!visible(el)) continue;
    roots.push(el);
  }
  return roots;
};

/**
 * The surface a leaf is actually read against, fully composited - see
 * `paintedBg`. Recomputed per state, never a hardcoded chain, because hover can
 * put a translucent wash UNDER a text leaf and change what it is painted on.
 */
export const nearestOpaqueBg = paintedBg;

export const MIN_ICON_CONTRAST = 3;

/**
 * Scheme-independence for icon-only controls, shared by the resting and
 * pseudo-state gates so both apply the identical rule. A themed icon colour is
 * the same defect as a themed text colour; only the contrast floor differs,
 * because an icon is a graphical object (WCAG non-text 3:1), not text.
 */
export const iconFailures = (lc, dc, label) => {
  const out = [];
  for (let j = 0; j < lc.icons.length; j++) {
    const a = lc.icons[j];
    const b = dc.icons && dc.icons[j];
    if (!b) { out.push(`${label} ${lc.name}: icon-only control #${j} present in light, absent in dark`); continue; }
    if (a.color !== b.color) {
      out.push(`${label} ${lc.name}: icon-only control "${a.t}" is THEME-DEPENDENT - ${a.color} light, ${b.color} dark. Icon-only controls carry no text, so a text-leaf walk never sees them; this is where theme tokens hide.`);
    }
    if (a.svgFill && b.svgFill && a.svgFill !== b.svgFill) {
      out.push(`${label} ${lc.name}: icon "${a.t}" fill is THEME-DEPENDENT - ${a.svgFill} light, ${b.svgFill} dark`);
    }
    const r = contrast(a.color, a.bg);
    if (r !== null && r < MIN_ICON_CONTRAST) {
      out.push(`${label} ${lc.name}: icon "${a.t}" ${a.color} on ${a.bg} = ${r.toFixed(2)}:1, below the ${MIN_ICON_CONTRAST}:1 graphical-object floor (WCAG non-text contrast).`);
    }
  }
  return out;
};

/**
 * THE COMPOSITING MODEL IS sRGB "over", AND THIS IS WHAT MAKES THAT CLAIM
 * CHECKABLE RATHER THAN ASSUMED.
 *
 * `paintedBg` composites the ancestor chain with plain sRGB alpha blending.
 * That is only correct while nothing in the chain does its own colour maths.
 * Four things break it, and none of them announce themselves:
 *
 *   backdrop-filter    the backdrop is sampled, filtered, then composited -
 *                      the effective backdrop is not the ancestor's declared
 *                      colour, so the blend result differs from `over()`
 *   mix-blend-mode     the element blends with what is already painted
 *                      BENEATH it, which `over()` never consults
 *   filter             a filter chain can alter colour before compositing
 *   non-sRGB colour    oklch/oklab/color() interpolate and convert; a
 *                      declared value is not the value the eye sees
 *
 * Rather than handle those - the brief does not ask for it, and no card uses
 * them today - the gate ASSERTS their absence over every element it measured.
 * The moment one is introduced, this fails and names it, because a guard that
 * cannot fail is exactly the control-in-intent-not-enforcement this work exists
 * to remove. Absence is the thing being proven, and absence is testable.
 */
export const COMPOSITING_HAZARDS = [
  // Each carries its own PREDICATE AS SOURCE, because a function cannot cross
  // the Playwright evaluate boundary - it is not serialisable. The first
  // attempt passed the functions and failed with "Attempting to serialize
  // unexpected value ... unsafe", which is the evaluate boundary being honest
  // about what it can carry.
  { prop: "backdropFilter", test: 'v && v !== "none"' },
  { prop: "mixBlendMode", test: 'v && v !== "normal"' },
  { prop: "filter", test: 'v && v !== "none"' },
  { prop: "color", test: '/oklch|oklab|lab\\(|lch\\(|color\\(/.test(v || "")' },
  { prop: "backgroundColor", test: '/oklch|oklab|lab\\(|lch\\(|color\\(/.test(v || "")' },
];

/**
 * Every element the contrast maths depends on: each measured leaf, each of its
 * ancestors up to and including the card, and the card's own pseudo-elements.
 * Pseudo-elements are included deliberately - see the pseudo-element note in
 * account-brand-states-check.mjs.
 */
export const COMPOSITING_SCOPE = `(leaf, card) => {
  const nodes = [];
  let n = leaf;
  while (n && n !== card.parentElement) { nodes.push(n); n = n.parentElement; }
  if (card) nodes.push(card);
  return nodes;
}`;

/**
 * Hazard scan, run per scheme. Also walks `::before` and `::after` on every
 * element in scope, for the reason in the states gate: CSS-generated content
 * has no DOM node, so no element walk can ever see it, and a colour applied to
 * a pseudo-element would be a theme token nothing inspects.
 */
export const hazardScan = ([collectSrc, scopeSrc, hazards]) => {
  const cards = eval(`(${collectSrc})`)();
  const scope = eval(`(${scopeSrc})`);
  // Predicates arrive as source text and are compiled here, inside the page.
  // The parameter is supplied HERE: each `test` is a bare boolean EXPRESSION
  // over `v`, and the wrapper is what turns it into a function. Wrapping it in
  // the page rather than in the module is also what makes the regex escapes
  // survive - they are written for the page's parser, not this one's.
  const checks = hazards.map((h) => ({ prop: h.prop, unsafe: eval(`((v) => ${h.test})`) }));
  const out = [];
  for (const card of cards) {
    const cname = (card.querySelector("h3") || {}).textContent || "(unnamed)";
    const leaves = [];
    for (const el of card.querySelectorAll("*")) {
      const isTextLeaf = el.children.length === 0 && (el.textContent || "").trim();
      const isControl = el.tagName === "BUTTON" || el.getAttribute("role") === "button" || el.tagName === "A";
      if (isTextLeaf || isControl) leaves.push(el);
    }
    for (const leaf of leaves) {
      for (const node of scope(leaf, card)) {
        const label =
          node.tagName.toLowerCase() +
          (typeof node.className === "string" && node.className.trim()
            ? "." + node.className.trim().split(/\\s+/).slice(0, 2).join(".")
            : "");
        // Real elements AND their pseudo-elements: the pseudo-element styles
        // are read through getComputedStyle(node, "::before"), which is the
        // only way to observe CSS-generated content at all.
        for (const pseudo of [null, "::before", "::after"]) {
          const cs = pseudo ? getComputedStyle(node, pseudo) : getComputedStyle(node);
          if (pseudo && (!cs.content || cs.content === "none" || cs.content === "normal")) continue;
          for (const h of checks) {
            if (h.unsafe(cs[h.prop])) {
              out.push({ card: cname, el: label + (pseudo || ""), prop: h.prop, value: cs[h.prop] });
            }
          }
        }
      }
    }
  }
  return out;
};

export const describe = (card, nearestFn) => {
  const cs = getComputedStyle(card);
  const texts = [];
  for (const el of card.querySelectorAll("*")) {
    if (el.children.length) continue;
    const t = (el.textContent || "").trim();
    if (!t) continue;
    const b = el.getBoundingClientRect();
    if (b.height === 0 || b.width === 0) continue;
    texts.push({
      t: t.slice(0, 24),
      color: getComputedStyle(el).color,
      bg: nearestFn(el, card),
    });
  }

  // ICON-ONLY controls, which carry no text and so are invisible to a
  // text-leaf walk. The `..` trigger is exactly this: its entire content is an
  // SVG, and it is also where `hover:text-foreground` and `hover:bg-muted`
  // live. A gate that only walks text therefore passes vacuously on the single
  // element most likely to leak a theme token - which is what happened the
  // first time this ran.
  //
  // Icons are graphical, not text, so they are held to 3:1 (WCAG non-text
  // contrast) rather than 4.5:1. They are still checked for SCHEME
  // INDEPENDENCE at the 4.5-equivalent rule of thumb used for text, because a
  // themed icon colour is the same defect regardless of its threshold.
  const icons = [];
  for (const el of card.querySelectorAll("button, [role='button'], a")) {
    const b = el.getBoundingClientRect();
    if (b.height === 0 || b.width === 0) continue;
    const s = getComputedStyle(el);
    const svg = el.querySelector("svg");
    const svgFill = svg ? getComputedStyle(svg).fill : null;
    icons.push({
      t: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 20) || "icon-only control",
      color: s.color,
      svgFill,
      bg: nearestFn(el, card),
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
    icons,
    geometry: `${Math.round(card.getBoundingClientRect().width)}x${Math.round(card.getBoundingClientRect().height)}`,
    clipped: [...card.querySelectorAll("*")].filter(
      (e) =>
        e.children.length === 0 &&
        (e.textContent || "").trim() &&
        e.getBoundingClientRect().right > card.getBoundingClientRect().right - 0.5
    ).length,
  };
};

// ------------------------------------------------------------------ resting
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const browser = await chromium.launch({ headless: true });
  let failures = 0;
  const fail = (m) => { failures++; console.log(`    FAIL  ${m}`); };

  const byScheme = {};
  for (const scheme of ["light", "dark"]) {
    const { ctx, pg } = await openAccounts(browser, { scheme });
    byScheme[scheme] = await pg.evaluate(
      ([collect, nearest, desc]) => {
        // Everything the collector needs is stringified in, because a function
        // sent via evaluate has no access to this module's scope - the first
        // version referenced `nearestOpaqueBg` from inside `describe` and died
        // with "is not defined" in the page, which is a good reminder that
        // serialised functions are not the same function.
        const nearestFn = eval(`(${nearest})`);
        const collectFn = eval(`(${collect})`);
        const describeFn = eval(`(${desc})`);
        const cards = collectFn();
        return cards.map((card) => describeFn(card, nearestFn));
      },
      [COLLECT.toString(), nearestOpaqueBg.toString(), describe.toString()]
    );
    await ctx.close();
  }

  console.log("=== S5d: brand card contract - resting state ===");
  const light = byScheme.light;
  console.log(`  cards found: ${light.length} (light) / ${byScheme.dark.length} (dark)`);
  if (light.length === 0) fail("no brand cards found - the check would pass vacuously");

  for (const [i, lc] of light.entries()) {
    const dc = byScheme.dark[i];
    if (!dc) { fail(`${lc.name}: present in light, absent in dark`); continue; }
    console.log(`\n  ${lc.name}  base ${lc.base}  ${lc.geometry}`);
    if (lc.base !== dc.base) fail(`${lc.name}: base changes with the theme (${lc.base} -> ${dc.base})`);
    for (const [j, lt] of lc.texts.entries()) {
      const dt = dc.texts[j];
      if (!dt) { fail(`${lc.name}: "${lt.t}" present in light, absent in dark`); continue; }
      if (dt.t !== lt.t) { fail(`${lc.name}: text order differs between schemes at ${j}`); continue; }
      if (lt.color !== dt.color) {
        fail(`${lc.name}: "${lt.t}" is THEME-DEPENDENT - ${lt.color} light, ${dt.color} dark. A brand card carries its own colours; it is not a themed surface.`);
      }
      const r = contrast(lt.color, lt.bg);
      if (r !== null && r < MIN_TEXT_CONTRAST) {
        fail(`${lc.name}: "${lt.t}" ${lt.color} on ${lt.bg} = ${r.toFixed(2)}:1, below the ${MIN_TEXT_CONTRAST}:1 floor. ${CONTRAST_POLICY}`);
      }
    }
    for (const m of iconFailures(lc, dc, "resting")) fail(m);
    if (lc.divider && lc.divider !== dc.divider) fail(`${lc.name}: divider is theme-dependent (${lc.divider} -> ${dc.divider})`);
    if (lc.border !== dc.border) fail(`${lc.name}: border is theme-dependent (${lc.border} -> ${dc.border})`);
    if (lc.geometry !== dc.geometry) fail(`${lc.name}: geometry differs between schemes`);
    if (lc.clipped > 0) fail(`${lc.name}: ${lc.clipped} clipped text element(s)`);
  }

  // ---- the compositing guard -------------------------------------------
  // `paintedBg` assumes plain sRGB alpha blending. That assumption is asserted
  // here, over every element and pseudo-element both gates measured, so the day
  // someone adds a backdrop-filter the MEASUREMENT stops being trustworthy and
  // this says so instead of quietly reporting a plausible number.
  console.log("\n=== compositing-model guard ===");
  {
    const args = [COLLECT.toString(), COMPOSITING_SCOPE.toString(), COMPOSITING_HAZARDS];
    const haz = {};
    for (const scheme of ["light", "dark"]) {
      const { ctx, pg } = await openAccounts(browser, { scheme });
      haz[scheme] = await pg.evaluate(hazardScan, args);
      await ctx.close();
    }
    const all = [...haz.light, ...haz.dark];
    if (all.length === 0) {
      console.log("  PASS  no backdrop-filter, mix-blend-mode, filter or non-sRGB colour on any measured chain.");
      console.log("        sRGB alpha compositing is therefore a valid model for paintedBg().");
    } else {
      for (const h of all) {
        fail(`compositing model: ${h.card} ${h.el} has ${h.prop}: ${h.value}. paintedBg() composites in sRGB and will report a wrong surface once a backdrop is filtered, blended, or non-sRGB. Fix the maths or exclude the element - do not leave it measuring.`);
      }
    }
  }

  console.log(`\n  brands exercised: ${light.map((c) => c.name).join(", ")}`);
  if (new Set(light.map((c) => c.base)).size !== light.length) fail("two cards share a base");

  await browser.close();
  console.log(failures === 0 ? "\nBRAND GATE PASS" : `\nBRAND GATE FAIL - ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}
