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
  // SEMANTIC SELECTION, from the a26fa31 audit.
  //
  // The audit found five places in this gate identifying an element by a VISUAL
  // property rather than a semantic one. The archived false-pass proved the
  // class: a card was found by its inline `backgroundColor`, so a selector meant
  // to reach archived cards landed on active ones and reported the result as
  // coverage. All five are now structural handles:
  //
  //   card         [data-account-card]              was inline backgroundColor
  //   toggle       [data-archived-toggle]           was input[type=checkbox]
  //   trigger      [data-slot=dropdown-menu-trigger] was a bare `button`
  //   divider      [data-account-divider]           was "first element with a
  //                                                    non-zero top border"
  //   menu action  [data-account-action=archive]     was text=Archive Account
  //
  // The last two are the instructive ones. A "divider" found by scanning for a
  // visible border is a DEFINITION, not an identification: it would happily
  // return the card's own outer border and fail SILENTLY by reporting a
  // plausible value. A menu item found by label text breaks when the copy
  // changes, and Playwright's `text=` is substring-based - "Archive" also
  // matches inside "Unarchive".
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
  //
  // SCOPE is per-hazard and it matters:
  //   "self"  - read on the element itself only. For INHERITED colour
  //             properties (color, backgroundColor are not inherited, but the
  //             declared value is what paints) the element's own value is
  //             the whole story.
  //   "chain" - read on EVERY ancestor up to and including the card. These are
  //             the ones that are NOT inherited, so a `filter` on a wrapper
  //             changes how the descendant renders while the descendant's own
  //             computed `filter` still reads "none". Checking the leaf alone
  //             would pass a card whose PARENT is filtered - which is the same
  //             blindness as the leaf-hover case, one property over.
  { prop: "backdropFilter", scope: "chain", test: 'v && v !== "none"' },
  { prop: "mixBlendMode", scope: "chain", test: 'v && v !== "normal"' },
  { prop: "filter", scope: "chain", test: 'v && v !== "none"' },
  // `opacity` is a separate compositing step from alpha in `backgroundColor`.
  // The compositor folds background alpha into `over()`; the `opacity`
  // property scales the element's ENTIRE rendered result - text included -
  // after its children are composited. `paintedBg` does not model that at all,
  // so an `opacity-60` card would be measured at full strength and the
  // contrast numbers would be fiction. The archived card used exactly this and
  // measured 1.28:1; asserting its absence stops it coming back.
  { prop: "opacity", scope: "chain", test: 'v !== "" && parseFloat(v) < 1' },
  { prop: "color", scope: "self", test: '/oklch|oklab|lab\\(|lch\\(|color\\(/.test(v || "")' },
  { prop: "backgroundColor", scope: "self", test: '/oklch|oklab|lab\\(|lch\\(|color\\(/.test(v || "")' },
];

/**
 * The chain a `chain`-scoped hazard is read over.
 *
 * Deliberately walks to the DOCUMENT ROOT, not just to the card. A
 * `mix-blend-mode` or `filter` on any ancestor changes how everything inside
 * renders, including the card's own background - and the card's background is
 * exactly the value the contrast maths terminates on. Stopping at the card
 * would assert the absence of a property that is doing the damage one level up.
 */
export const COMPOSITING_SCOPE = `(leaf, card) => {
  const nodes = [];
  let n = leaf;
  while (n) { nodes.push(n); if (n === card) break; n = n.parentElement; }
  // keep going past the card: ancestors above it composite the card too
  let above = card ? card.parentElement : null;
  while (above) { nodes.push(above); above = above.parentElement; }
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
  // COVERAGE, returned alongside the findings.
  //
  // This function used to return a bare array of hazards, and the caller
  // printed PASS when that array was empty. That is the archived false-pass
  // shape in new code: if the card collector returns nothing - a renamed
  // selector, a changed route, a failed load - the guard reports that no
  // backdrop-filter, blend or sub-1 opacity exists anywhere in the app.
  //
  // Asserting absence is the one place an empty result is most dangerous,
  // because "found nothing" and "nothing exists" are indistinguishable and only
  // one of them is the desired answer. So the scan now reports how much it
  // actually looked at, and the caller treats zero coverage as a FAILURE of the
  // scan rather than a clean bill of health.
  const coverage = { cards: cards.length, leaves: 0, nodes: 0, pseudos: 0 };
  // Predicates arrive as source text and are compiled here, inside the page.
  // The parameter is supplied HERE: each `test` is a bare boolean EXPRESSION
  // over `v`, and the wrapper is what turns it into a function. Wrapping it in
  // the page rather than in the module is also what makes the regex escapes
  // survive - they are written for the page's parser, not this one's.
  const checks = hazards.map((h) => ({ prop: h.prop, scope: h.scope, unsafe: eval(`((v) => ${h.test})`) }));
  const out = [];
  for (const card of cards) {
    const cname = card.getAttribute("data-account-card") || "(unnamed)";
    const leaves = [];
    for (const el of card.querySelectorAll("*")) {
      const isTextLeaf = el.children.length === 0 && (el.textContent || "").trim();
      const isControl = el.tagName === "BUTTON" || el.getAttribute("role") === "button" || el.tagName === "A";
      if (isTextLeaf || isControl) leaves.push(el);
    }
    for (const leaf of leaves) {
      coverage.leaves++;
      for (const node of scope(leaf, card)) {
        coverage.nodes++;
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
          if (pseudo) coverage.pseudos++;
          for (const h of checks) {
            // A "chain" hazard is asserted on EVERY node in the walked chain;
            // a "self" hazard only on the element the walk started from. The
            // distinction is the whole point: `filter` and `opacity` are not
            // inherited, so only the ancestor can hold them.
            if (h.scope === "self" && node !== leaf) continue;
            if (h.unsafe(cs[h.prop])) {
              out.push({
                card: cname,
                el: label + (pseudo || ""),
                prop: h.prop,
                value: cs[h.prop],
                where: h.scope === "self" ? "self" : node === leaf ? "leaf" : "ancestor",
              });
            }
          }
        }
      }
    }
  }
  return { hazards: out, coverage };
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
    // From the card's own attribute, not by hunting for an `h3` and assuming
    // that is the name. An `h3` is a HEADING, and a card that grew a second
    // heading would silently change which one the gate reports on.
    name: card.getAttribute("data-account-card") || "(unnamed)",
    base: cs.backgroundColor,
    border: cs.borderTopColor,
    // The divider is identified BY ROLE now. The previous version searched
    // every descendant for "an element with a non-zero top border" - which is a
    // definition rather than an identification, and it matches the card's OWN
    // outer border too. On a card whose inner divider was removed it would
    // return the outer border, compare it across schemes, find them equal, and
    // report PASS for a divider that no longer exists. Silent, plausible, wrong.
    // THE MARK SLOT, measured for UNIQUENESS and for COVERAGE.
    //
    // The fallback path once rendered a legacy account-TYPE icon (a bank
    // pictogram, an e-wallet glyph, a dollar sign) BESIDE the monogram, so a
    // fallback card showed two marks. This check passed throughout, because
    // every previous assertion was a PRESENCE assertion: two elements satisfy
    // "present and non-empty" exactly as one does, and the legacy icon carried
    // no data-* at all, so no selector in this file ever saw it.
    //
    // Two things are therefore asserted, and they are different:
    //
    //   uniqueness  the slot has EXACTLY ONE visible child - not "at least one"
    //   coverage    that child is a recognised mark, and no sibling in the slot
    //               renders anything visible whatever it is called
    //
    // The second is the scope gap: a selector defines what the verifier sees, and
    // anything outside it renders unmeasured. `unmatched` is the list of visible
    // children the mark selectors do not account for, which is how an unlabelled
    // legacy icon becomes visible to a gate instead of invisible to one.
    markSlot: (() => {
      const slots = card.querySelectorAll("[data-mark-slot]");
      if (slots.length !== 1) {
        return { ok: false, why: `expected exactly 1 [data-mark-slot], found ${slots.length}` };
      }
      const slot = slots[0];
      // THE CHIP MUST EXIST BEFORE ANY CONTRAST IS MEASURED AGAINST IT.
      //
      // The background walker below resolves an icon's surface by walking up to
      // the nearest non-transparent ancestor. With the chip present that is the
      // chip, which is correct. With the chip MISSING it walks past, finds the
      // card, measures mark-vs-card, and passes. The contrast assertion would be
      // satisfied by the exact defect it exists to detect.
      //
      // So the chip is asserted FIRST, and separately. Coverage before absence:
      // "the chip is there" and "the chip is the right size" are both real
      // claims about a known population, not one claim standing in for another.
      const chip = card.querySelector("[data-mark-chip]");
      if (!chip) {
        return { ok: false, why: "no [data-mark-chip] rendered - mark contrast would silently fall through to the card base and pass on the wrong subject" };
      }
      const chipBox = chip.getBoundingClientRect();
      const chipStyle = getComputedStyle(chip);
      const chipTransparent = /rgba\(0, 0, 0, 0\)|transparent/.test(chipStyle.backgroundColor);
      if (chipTransparent) {
        return { ok: false, why: "[data-mark-chip] has no background - it is not a chip, and contrast would be measured against the card" };
      }
      // The identity row is the chip's PARENT: the chip now occupies the position
      // the bare mark used to, so `slot.parentElement` would scope the
      // "nothing unlabelled in the row" check to the chip alone and quietly stop
      // seeing the name block beside it.
      const row = chip.parentElement;
      const vis = (el) => {
        if (el.checkVisibility) return el.checkVisibility({ checkVisibilityCSS: true });
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      };
      const describe = (el) => {
        const hasSvg = el.querySelectorAll("svg").length;
        const cs = getComputedStyle(el);
        return `<${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).trim().split(/\s+/)[0] : ""}>` +
          (hasSvg ? ` containing ${hasSvg} <svg>` : "") +
          ` (${Math.round(el.getBoundingClientRect().width)}px, bg ${cs.backgroundColor})`;
      };
      // The slot's own child must be the mark and nothing else.
      const marks = [...slot.children].filter(vis).filter((el) =>
        el.matches("[data-brand-logo]") || el.matches("[data-account-logo-mono]")
      );
      const extraInSlot = [...slot.children].filter(vis).filter((el) =>
        !el.matches("[data-brand-logo]") && !el.matches("[data-account-logo-mono]")
      );
      // AND the ROW is the real container: the legacy type icon was a SIBLING
      // of the mark slot, not a child, so a slot-scoped check never saw it.
      // Everything visible in the row must be the mark or the name block.
      const rowKids = [...row.children].filter(vis);
      const rowUnmatched = rowKids.filter(
        (el) =>
          !el.matches("[data-mark-slot]") &&
          !el.matches("[data-mark-chip]") &&
          !el.matches("[data-account-name-block]")
      );
      return {
        ok: true,
        marks: marks.length,
        extraInSlot: extraInSlot.map(describe),
        rowUnmatched: rowUnmatched.map(describe),
        kind: marks[0] ? (marks[0].matches("[data-brand-logo]") ? "mark" : "monogram") : null,
      };
    })(),
    //
    // Measured, not inferred: `color` is the resolved value of the container's
    // `[color:var(--brand-on)]`, which is what a `fill="currentColor"` path
    // inherits. `present` is separate from every equality so the assertions
    // below can fail on absence rather than on a null-vs-null comparison that
    // is trivially satisfied.
    logo: (() => {
      const el = card.querySelector("[data-account-logo]");
      if (!el) return { present: false, kind: "none" };
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      const mono = !!el.querySelector("[data-account-logo-mono]");
      return {
        present: true,
        kind: mono ? "monogram" : "mark",
        // Enough identity to NAME the element in a failure. A mark and a
        // monogram are different elements and must be told apart: the monogram
        // holds a text leaf, so it is also covered by the text walk, while a
        // mark is covered by nothing else. A failure message that only said
        // "the logo" would hide which assertion actually caught it.
        el: mono
          ? "span[data-account-logo-mono]"
          : `svg[data-brand-logo="${el.querySelector("svg")?.getAttribute("data-brand-logo") ?? "?"}"]`,
        color: cs.color,
        height: Math.round(b.height),
        width: Math.round(b.width),
        // A real mark must actually paint something.
        nonEmpty: mono ? (el.textContent || "").trim().length > 0 : !!el.querySelector("svg, path"),
        bg: nearestFn(el, card),
      };
    })(),
    divider: (() => {
      const d = card.querySelector("[data-account-divider]");
      return d ? getComputedStyle(d).borderTopColor : null;
    })(),
    dividerPresent: !!card.querySelector("[data-account-divider]"),
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
  const logos = [];
  console.log(`  cards found: ${light.length} (light) / ${byScheme.dark.length} (dark)`);
  if (light.length === 0) fail("no brand cards found - the check would pass vacuously");

  // A MISSING CARD IS A FAILURE, NOT A SHORTER LIST.
  //
  // This check used to assert only `length > 0`, so a card that vanished from
  // the ledger reduced the list and every remaining assertion still passed on
  // seven cards. That is not hypothetical: Maribank was found ARCHIVED while a
  // prior gate run's archive/restore fixture had not put it back, and the only
  // symptom was this line printing 7. The gate reported its own reduced
  // population and nobody read it.
  //
  // The expected count is what the brand table actually has. It is derived, not
  // typed, so adding a brand does not require editing this line - and a stale
  // count fails loudly rather than quietly shrinking coverage.
// The expected count is DERIVED from the palette source, not typed here: adding
// a brand must not require editing this line, and a count maintained by hand is
// a count that will drift.
function countBrandsInPalette() {
  const src = fs.readFileSync(
    path.join(process.cwd(), "src", "lib", "utils", "account-brand.ts"),
    "utf8"
  );
  const start = src.indexOf("export const ACCOUNT_BRANDS");
  if (start < 0) throw new Error("ACCOUNT_BRANDS not found in account-brand.ts - the expected-card count cannot be derived");
  const block = src.slice(start, src.indexOf("};", start));
  // Entries sit at two spaces; their properties are at four. The last entry,
  // `neutral`, references NEUTRAL_PALETTE rather than opening an object, so the
  // pattern must not require a brace - getting that wrong counted 7 of 8 and
  // the new assertion caught it on its first run.
  const keys = [...block.matchAll(/^ {2}([a-z]+):/gm)].map((m) => m[1]);
  if (keys.length === 0) throw new Error("no brand keys parsed from ACCOUNT_BRANDS - refusing to assert a count of 0");
  return keys.length;
}
  const EXPECTED_CARDS = countBrandsInPalette();
  if (light.length !== EXPECTED_CARDS) {
    fail(
      `expected EXACTLY ${EXPECTED_CARDS} brand cards, found ${light.length}` +
      ` - a card is missing from the ledger or is ARCHIVED. Every other assertion` +
      ` below just passed on a shorter list, which is the vacuous pass this line exists to stop.` +
      ` Found: ${light.map((c) => c.name).join(", ")}`
    );
  }
  if (byScheme.dark.length !== EXPECTED_CARDS) {
    fail(`expected EXACTLY ${EXPECTED_CARDS} brand cards in dark, found ${byScheme.dark.length}`);
  }

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
    // The divider must EXIST as well as agree. A null divider compared against
    // a null divider is trivially equal, so without this a card that lost its
    // divider would pass the theme-dependence check by having nothing to
    // compare.
    if (!lc.dividerPresent) fail(`${lc.name}: no [data-account-divider] found - the divider assertion cannot run`);
    else if (lc.divider !== dc.divider) fail(`${lc.name}: divider is theme-dependent (${lc.divider} -> ${dc.divider})`);

    // ---- THE LOGO -----------------------------------------------------
    // Presence FIRST, before any equality. `lc.logo && lc.logo.color !== ...`
    // would let a missing logo skip the comparison entirely, and two missing
    // logos would compare equal to each other - null vs null, the exact shape
    // that let a card with no divider pass.
    if (!lc.logo.present) {
      fail(`${lc.name}: no [data-account-logo] rendered - the logo assertions cannot run`);
    } else if (!lc.logo.nonEmpty) {
      fail(`${lc.name}: [data-account-logo] is present but empty - a mark with no path and no monogram is a hole in the card, not a logo`);
    } else {
      if (!dc.logo || !dc.logo.present) {
        fail(`${lc.name}: logo present in light, absent in dark`);
      } else {
        if (lc.logo.color !== dc.logo.color) {
          fail(`${lc.name}: ${lc.logo.el} is THEME-DEPENDENT - ${lc.logo.color} light, ${dc.logo.color} dark. A brand mark must inherit the card's text token; a theme token or a hardcoded fill is the cause.`);
        }
        // Graphical element, so WCAG non-text 3:1, not the 4.5:1 text floor.
        const lr = contrast(lc.logo.color, lc.logo.bg);
        if (lr !== null && lr < MIN_ICON_CONTRAST) {
          fail(`${lc.name}: ${lc.logo.el} (${lc.logo.kind}) ${lc.logo.color} on ${lc.logo.bg} = ${lr.toFixed(2)}:1, below the ${MIN_ICON_CONTRAST}:1 graphical-object floor.`);
        }
        if (lc.logo.height !== dc.logo.height) {
          fail(`${lc.name}: logo height differs between schemes (${lc.logo.height} vs ${dc.logo.height})`);
        }
      }
    }
    // UNICITY AND COVERAGE, asserted before anything is compared. A presence
    // assertion cannot see a second mark; this is the check that can.
    if (!lc.markSlot.ok) {
      fail(`${lc.name}: ${lc.markSlot.why} - the mark slot must be a single structural container`);
    } else if (lc.markSlot.marks !== 1) {
      fail(`${lc.name}: mark slot has ${lc.markSlot.marks} marks, expected EXACTLY 1. Presence is not uniqueness - two elements satisfy "present and non-empty" exactly as one does.`);
    } else if (lc.markSlot.extraInSlot.length > 0) {
      fail(`${lc.name}: mark slot contains ${lc.markSlot.extraInSlot.length} visible element(s) that are not a mark: ${lc.markSlot.extraInSlot.join(", ")}. A selector defines what the verifier sees - anything outside it renders UNMEASURED.`);
    } else if (lc.markSlot.rowUnmatched.length > 0) {
      fail(`${lc.name}: the identity row renders ${lc.markSlot.rowUnmatched.length} visible element(s) that are neither the mark nor the name block: ${lc.markSlot.rowUnmatched.join(", ")}. The mark slot's PARENT is the real container - the legacy type icon lived beside it, not inside it, so a slot-scoped check never saw it.`);
    } else if (lc.markSlot.kind !== (lc.logo.kind === "mark" ? "mark" : "monogram")) {
      fail(`${lc.name}: mark slot holds a ${lc.markSlot.kind} but the measured logo is a ${lc.logo.kind} - the slot and the measurement disagree`);
    }
    logos.push(lc.logo);
    if (lc.border !== dc.border) fail(`${lc.name}: border is theme-dependent (${lc.border} -> ${dc.border})`);
    if (lc.geometry !== dc.geometry) fail(`${lc.name}: geometry differs between schemes`);
    if (lc.clipped > 0) fail(`${lc.name}: ${lc.clipped} clipped text element(s)`);
  }

  // ---- the compositing guard -------------------------------------------
  // `paintedBg` assumes plain sRGB alpha blending. That assumption is asserted
  // here, over every element and pseudo-element both gates measured, so the day
  // someone adds a backdrop-filter the MEASUREMENT stops being trustworthy and
  // this says so instead of quietly reporting a plausible number.
  // ---- the logo lockup, across cards ---------------------------------
  // Rendered HEIGHT must be identical for every card. Width is NOT asserted:
  // it is intrinsic and is expected to vary, because each mark keeps its own
  // natural aspect ratio and nothing is padded to a square.
  //
  // Height is the whole point of the lockup. If marks render at different
  // heights, the bank names sit on different baselines across the grid and the
  // row stops reading as one row.
  {
    const withLogo = logos.filter((l) => l && l.present);
    if (withLogo.length !== logos.length) {
      fail(`${logos.length - withLogo.length} card(s) had no logo at all - see the presence failures above`);
    }
    const heights = [...new Set(withLogo.map((l) => l.height))];
    if (heights.length > 1) {
      fail(`logo lockup: rendered heights differ across cards (${withLogo.map((l) => `${l.kind}:${l.height}`).join(", ")}). The container height is fixed precisely so these match.`);
    } else if (heights.length === 1) {
      console.log(`  lockup: ${withLogo.length} logo(s) at a uniform ${heights[0]}px height; widths ${[...new Set(withLogo.map((l) => l.width))].sort((a, b) => a - b).join("/")}px (intrinsic, expected to vary)`);
    }

    // THE FALLBACK MUST ACTUALLY RENDER. A fallback that never renders is a
    // fallback that does not work, and the fixture set has to prove it - so if
    // no card resolved to the monogram, that is a FAILURE of coverage, not a
    // pass. Cash has no mark by design, so the natural fixture exists; if a
    // future data set has one, this is what stops the path rotting unnoticed.
    const monos = withLogo.filter((l) => l.kind === "monogram");
    if (monos.length === 0) {
      fail("logo fallback: no card in the fixture set resolved to the monogram, so the fallback path was never exercised. A fallback that never renders is a fallback that does not work - add a brand with no mark, or a fixture that produces one.");
    } else {
      console.log(`  fallback: ${monos.length} card(s) rendered the monogram (${monos.map((l) => l.height + "px").join(", ")}) and were held to the same four assertions`);
    }
  }

  console.log("\n=== compositing-model guard ===");
  {
    const args = [COLLECT.toString(), COMPOSITING_SCOPE.toString(), COMPOSITING_HAZARDS];
    const haz = {};
    for (const scheme of ["light", "dark"]) {
      const { ctx, pg } = await openAccounts(browser, { scheme });
      haz[scheme] = await pg.evaluate(hazardScan, args);
      await ctx.close();
    }
    // COVERAGE BEFORE ABSENCE. An empty hazard list is only evidence if the
    // scan actually looked at something. This is the fix for the vacuous pass
    // the audit found here: a renamed selector or a failed load used to produce
    // the same green as a clean app.
    const cov = haz.light.coverage;
    if (cov.cards === 0 || cov.leaves === 0) {
      fail(`compositing-model guard did not run: scanned ${cov.cards} card(s) and ${cov.leaves} leaf/leaves. An empty hazard list means nothing when the scan saw nothing - fix the collector, do not read this as an absence.`);
    } else {
      const all = [...haz.light.hazards, ...haz.dark.hazards];
      console.log(`  scanned ${cov.cards} card(s), ${cov.leaves} leaves, ${cov.nodes} chain nodes, ${cov.pseudos} pseudo-element(s) per scheme`);
      if (all.length === 0) {
        console.log("  PASS  no backdrop-filter, mix-blend-mode, filter, sub-1 opacity or non-sRGB colour");
        console.log("        anywhere in any measured chain, up to the document root.");
        console.log("        sRGB alpha compositing is therefore a valid model for paintedBg().");
      } else {
      for (const h of all) {
        fail(`compositing model: ${h.card} ${h.el} has ${h.prop}: ${h.value} (${h.where}). paintedBg() composites in sRGB and does not model this. ${h.prop === "opacity" ? "The opacity property scales the element's ENTIRE rendered result - text included - after its children are composited, so every contrast number on it is fiction." : "Filter, blend and backdrop-filter are not inherited, so only an ancestor can hold them, and they change how the card's own background paints."} Fix the maths or exclude the element - do not leave it measuring.`);
      }
      }
    }
  }

  console.log(`\n  brands exercised: ${light.map((c) => c.name).join(", ")}`);
  if (new Set(light.map((c) => c.base)).size !== light.length) fail("two cards share a base");

  await browser.close();
  console.log(failures === 0 ? "\nBRAND GATE PASS" : `\nBRAND GATE FAIL - ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}
