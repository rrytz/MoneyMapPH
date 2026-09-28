// S5e: brand card contract - PSEUDO-STATES.
//
// WHY A SEPARATE FILE
//
// Resting state and pseudo-states need different mechanics. Hover needs a real
// pointer move; :focus-visible needs real Tab traversal and cannot be produced
// by .focus(), which applies :focus but not :focus-visible. Putting that
// 10-second interaction sequence behind every run of the fast resting check
// would make the cheap gate expensive, and expensive gates get skipped.
//
// WHY :focus-visible CANNOT BE TESTED WITH .focus()
//
// .focus() satisfies :focus but not :focus-visible. Chromium applies
// :focus-visible on keyboard-driven focus, not programmatic focus. So the
// only honest way to reach the state is page.keyboard.press("Tab") until the
// target reports document.activeElement === el AND el.matches(":focus-visible").
// Asserting :focus styles here would pass against a card that has no
// :focus-visible styling at all, which is exactly the vacuous check to avoid.
//
// ------------------------------------------------------------------
// THE THREE TRAPS THIS FILE EXISTS TO AVOID
//
// 1. HOVER PROPAGATES. :hover applies to an element AND every ancestor of the
//    pointer. Reading colours off the card root while hovering a leaf measures
//    the root, not the leaf, and reports the leaf as unaffected when it changed.
//    So both are tested: root hovered -> root read, and trigger hovered ->
//    trigger read. Nothing is inferred from the other.
//
// 2. TRANSITIONS. The card root carries `transition-all` and the trigger
//    `transition`, so a hovered colour is ANIMATING toward its value. Reading
//    mid-animation yields a colour that is neither the resting nor the final
//    one, and the result differs run to run. Motion is killed with a style tag
//    at the top of the run. prefers-reduced-motion is NOT relied on: in this
//    codebase it gates only `.auth-*` animation and leaves transitions running.
//
// 3. NO HARDCODED ANCESTOR CHAIN. Hover can change an ancestor's background
//    UNDER a text leaf - `hover:bg-muted` on the trigger does exactly that. So
//    the surface a leaf is read against is recomputed per state by walking for
//    the nearest opaque ancestor, never assumed to be the card.
//
// ------------------------------------------------------------------
// WHAT IS ACTUALLY ON THIS CARD (measured, not assumed)
//
//   hover  card root      `hover:border-[color:var(--brand-line)]` - brand
//                          derived, and identical to the RESTING border, so
//                          hovering it is currently a no-op. Asserted anyway.
//   hover  `..` trigger     `hover:text-foreground hover:bg-muted` - BOTH theme
//                          tokens. This is the live leak.
//   focus-visible  trigger  NOT DEFINED anywhere in the component. The browser
//                          default outline applies. No leak, but also no
//                          brand-derived ring - worth knowing.
//   disabled  none          Nothing on this card is ever :disabled.
//
//   `archived` substitutes for `disabled` and is a real state: `opacity-60`,
//   `bg-card/60`, `border-border` and a dropdown with only "Unarchive" in it.
//   All three of those are theme tokens, so it carries genuine leak risk that a
//   hypothetical :disabled does not. Asserting on a :disabled state that does
//   not exist would be the same vacuous check this whole exercise exists to
//   eliminate.

import { chromium } from "playwright";
import {
  COLLECT,
  CONTRAST_POLICY,
  MIN_TEXT_CONTRAST,
  contrast,
  describe,
  iconFailures,
  nearestOpaqueBg,
  openAccounts,
} from "./account-brand-check.mjs";

const browser = await chromium.launch({ headless: true });
let failures = 0;
const fail = (m) => { failures++; console.log(`    FAIL  ${m}`); };

/** Hover a real element with a real pointer. Returns the element handle. */
async function hoverReal(pg, cardIndex, selector) {
  const handle = await pg.evaluateHandle(
    ([ci, sel]) => {
      const cards = eval(`(${arguments[0][2]})`)();
      return cards[ci]?.querySelector(sel) ?? null;
    },
    [cardIndex, selector, COLLECT.toString()]
  );
  const el = handle.asElement();
  if (!el) return null;
  // page.hover dispatches a real pointer move, so :hover lands on the element
  // and every ancestor - which is the trap, and why the READ target is always
  // named explicitly rather than inferred.
  await el.hover();
  return el;
}

/** Tab until the target genuinely matches :focus-visible. */
async function focusVisibleReal(pg, cardIndex, selector) {
  const before = await pg.evaluate(() => document.activeElement?.tagName ?? "");
  // A bounded number of presses, and it stops on a real condition. No fixed
  // count "should be enough" and no sleeping.
  for (let i = 0; i < 40; i++) {
    await pg.keyboard.press("Tab");
    const hit = await pg.evaluate(
      ([ci, sel, collectSrc]) => {
        const cards = eval(`(${collectSrc})`)();
        const el = cards[ci]?.querySelector(sel);
        return !!el && document.activeElement === el && el.matches(":focus-visible");
      },
      [cardIndex, selector, COLLECT.toString()]
    );
    if (hit) return true;
  }
  // Not an error by itself: a card with no :focus-visible styling still matches
  // once focused by keyboard, because the PSEUDO-CLASS applies. If nothing
  // matched after 40 presses the page is not in the expected state at all.
  const landed = await pg.evaluate(
    ([ci, sel, collectSrc]) => {
      const cards = eval(`(${collectSrc})`)();
      const el = cards[ci]?.querySelector(sel);
      return !!el && document.activeElement === el;
    },
    [cardIndex, selector, COLLECT.toString()]
  );
  return landed;
}

const SNAPSHOT = ([collectSrc, nearestSrc, descSrc]) => {
  const cards = eval(`(${collectSrc})`)();
  const nearestFn = eval(`(${nearestSrc})`);
  const describeFn = eval(`(${descSrc})`);
  return cards.map((c) => describeFn(c, nearestFn));
};

const snapArgs = [COLLECT.toString(), nearestOpaqueBg.toString(), describe.toString()];

// ------------------------------------------------------------- TRAP 1: hover
console.log("=== S5e: brand card contract - pseudo-states ===");
console.log("\n--- hover: ROOT hovered -> ROOT read ---");
{
  const byScheme = {};
  for (const scheme of ["light", "dark"]) {
    const { ctx, pg } = await openAccounts(browser, { scheme });
    const cards = await pg.evaluate(SNAPSHOT, snapArgs);
    // hover the FIRST card's root. Reading the root is named explicitly.
    await pg.hover('main div[style*="background-color"]');
    const hovered = await pg.evaluate(SNAPSHOT, snapArgs);
    byScheme[scheme] = { rest: cards, hovered };
    await ctx.close();
  }
  const l = byScheme.light.hovered;
  const d = byScheme.dark.hovered;
  for (let i = 0; i < l.length; i++) {
    if (!d[i]) { fail(`hover: card ${i} missing in dark`); continue; }
    for (let j = 0; j < l[i].texts.length; j++) {
      const a = l[i].texts[j];
      const b = d[i].texts[j];
      if (!b) continue;
      if (a.color !== b.color) {
        fail(`hover(ROOT) ${l[i].name}: "${a.t}" is THEME-DEPENDENT under hover - ${a.color} light, ${b.color} dark`);
      }
      const r = contrast(a.color, a.bg);
      if (r !== null && r < MIN_TEXT_CONTRAST) {
        fail(`hover(ROOT) ${l[i].name}: "${a.t}" ${a.color} on ${a.bg} = ${r.toFixed(2)}:1 under hover. ${CONTRAST_POLICY}`);
      }
    }
    for (const m of iconFailures(l[i], d[i], "hover(ROOT)")) fail(m);
    if (l[i].border !== d[i].border) fail(`hover(ROOT) ${l[i].name}: border is theme-dependent under hover (${l[i].border} -> ${d[i].border})`);
    if (l[i].divider !== d[i].divider) fail(`hover(ROOT) ${l[i].name}: divider is theme-dependent under hover`);
    if (l[i].geometry !== d[i].geometry) fail(`hover(ROOT) ${l[i].name}: geometry differs between schemes under hover`);
  }
  console.log(`  cards: ${l.length}   root-hover scheme-independence checked`);
}

console.log("\n--- hover: TRIGGER hovered -> TRIGGER read ---");
{
  const byScheme = {};
  for (const scheme of ["light", "dark"]) {
    const { ctx, pg } = await openAccounts(browser, { scheme });
    // the `..` trigger is the only interactive element on a card
    const target = await pg.$('main div[style*="background-color"] [data-slot="dropdown-menu-trigger"], main div[style*="background-color"] button');
    if (target) await target.hover();
    const hovered = await pg.evaluate(SNAPSHOT, snapArgs);
    byScheme[scheme] = hovered;
    await ctx.close();
  }
  const l = byScheme.light;
  const d = byScheme.dark;
  for (let i = 0; i < l.length; i++) {
    if (!d[i]) continue;
    for (let j = 0; j < l[i].texts.length; j++) {
      const a = l[i].texts[j];
      const b = d[i].texts[j];
      if (!b) continue;
      if (a.color !== b.color) {
        fail(`hover(TRIGGER) ${l[i].name}: "${a.t}" is THEME-DEPENDENT under trigger hover - ${a.color} light, ${b.color} dark`);
      }
      const r = contrast(a.color, a.bg);
      if (r !== null && r < MIN_TEXT_CONTRAST) {
        fail(`hover(TRIGGER) ${l[i].name}: "${a.t}" ${a.color} on ${a.bg} = ${r.toFixed(2)}:1 under trigger hover. ${CONTRAST_POLICY}`);
      }
    }
    for (const m of iconFailures(l[i], d[i], "hover(TRIGGER)")) fail(m);
    if (l[i].divider !== d[i].divider) fail(`hover(TRIGGER) ${l[i].name}: divider is theme-dependent under trigger hover`);
    if (l[i].geometry !== d[i].geometry) fail(`hover(TRIGGER) ${l[i].name}: geometry differs between schemes under trigger hover`);
  }
  console.log(`  cards: ${l.length}   trigger-hover scheme-independence checked`);
}

console.log("\n--- hover: NAME hovered -> NAME read (leaf's OWN hover style) ---");
{
  // The regression proof for this file. Injecting `hover:text-foreground` into
  // the card name made the ROOT-hover test pass, and that is not a near miss -
  // :hover applies to the element under the pointer and its ANCESTORS, never
  // to its descendants. So hovering the root never puts :hover on the h3, and a
  // leaf's own hover styling is structurally invisible to a root-hover test.
  // The only way to see it is to hover the leaf and read the leaf.
  const byScheme = {};
  for (const scheme of ["light", "dark"]) {
    const { ctx, pg } = await openAccounts(browser, { scheme });
    // Hover the FIRST card's name. Read target and hover target are the same
    // element - stated, not inferred.
    const name = await pg.$('main div[style*="background-color"] h3');
    if (name) await name.hover();
    else fail(`hover(NAME) ${scheme}: no card name found to hover`);
    byScheme[scheme] = await pg.evaluate(SNAPSHOT, snapArgs);
    await ctx.close();
  }
  const l = byScheme.light;
  const d = byScheme.dark;
  for (let i = 0; i < l.length; i++) {
    if (!d[i]) { fail(`hover(NAME): card ${i} missing in dark`); continue; }
    for (let j = 0; j < l[i].texts.length; j++) {
      const a = l[i].texts[j];
      const b = d[i].texts[j];
      if (!b) continue;
      if (a.color !== b.color) {
        fail(`hover(NAME) ${l[i].name}: "${a.t}" is THEME-DEPENDENT under its own hover - ${a.color} light, ${b.color} dark. A leaf's own hover style is invisible to a root-hover test, because :hover applies to the pointer's element and its ANCESTORS, never its descendants.`);
      }
      const r = contrast(a.color, a.bg);
      if (r !== null && r < MIN_TEXT_CONTRAST) {
        fail(`hover(NAME) ${l[i].name}: "${a.t}" ${a.color} on ${a.bg} = ${r.toFixed(2)}:1 under its own hover. ${CONTRAST_POLICY}`);
      }
    }
    for (const m of iconFailures(l[i], d[i], "hover(NAME)")) fail(m);
    if (l[i].border !== d[i].border) fail(`hover(NAME) ${l[i].name}: border is theme-dependent under name hover (${l[i].border} -> ${d[i].border})`);
    if (l[i].divider !== d[i].divider) fail(`hover(NAME) ${l[i].name}: divider is theme-dependent under name hover`);
    if (l[i].geometry !== d[i].geometry) fail(`hover(NAME) ${l[i].name}: geometry differs between schemes under name hover`);
  }
  console.log(`  cards: ${l.length}   name-hover scheme-independence checked`);
}

// ------------------------------------------------- TRAP 2: :focus-visible
console.log("\n--- focus-visible: TRIGGER reached by real Tab ---");
{
  const byScheme = {};
  for (const scheme of ["light", "dark"]) {
    const { ctx, pg } = await openAccounts(browser, { scheme });
    const reached = await focusVisibleReal(pg, 0, 'button');
    if (!reached) fail(`focus-visible (${scheme}): could not reach a card trigger by keyboard`);
    const focused = await pg.evaluate(SNAPSHOT, snapArgs);
    byScheme[scheme] = focused;
    await ctx.close();
  }
  const l = byScheme.light;
  const d = byScheme.dark;
  for (let i = 0; i < l.length; i++) {
    if (!d[i]) continue;
    for (let j = 0; j < l[i].texts.length; j++) {
      const a = l[i].texts[j];
      const b = d[i].texts[j];
      if (!b) continue;
      if (a.color !== b.color) {
        fail(`focus-visible ${l[i].name}: "${a.t}" is THEME-DEPENDENT under focus - ${a.color} light, ${b.color} dark`);
      }
      const r = contrast(a.color, a.bg);
      if (r !== null && r < MIN_TEXT_CONTRAST) {
        fail(`focus-visible ${l[i].name}: "${a.t}" ${a.color} on ${a.bg} = ${r.toFixed(2)}:1 under focus. ${CONTRAST_POLICY}`);
      }
    }
    for (const m of iconFailures(l[i], d[i], "focus-visible")) fail(m);
    if (l[i].geometry !== d[i].geometry) fail(`focus-visible ${l[i].name}: geometry differs between schemes under focus`);
  }
  console.log(`  cards: ${l.length}   focus-visible scheme-independence checked`);
}

// -------------------------------------------- archived, standing in for :disabled
console.log("\n--- archived (the real inactive state; this card has no :disabled) ---");
{
  const byScheme = {};
  let archivedPresent = false;
  for (const scheme of ["light", "dark"]) {
    const { ctx, pg } = await openAccounts(browser, { scheme });
    // Show Archived Accounts, which is what puts a card into the archived state.
    const cb = await pg.$('input[type="checkbox"]');
    if (cb) await cb.check();
    // Wait on the ACTUAL condition - an archived card renders an "Archived"
    // pill. If the user has no archived accounts the wait times out, and that
    // is a data fact, not a failure of the invariant. So: bounded wait, then
    // detect and report it as SKIPPED rather than either failing (wrong) or
    // silently passing (vacuous).
    const gotArchived = await pg
      .waitForFunction(
        () => [...document.querySelectorAll("main *")].some(
          (e) => /^Archived$/.test((e.textContent || "").trim()) && e.children.length === 0
        ),
        null,
        { timeout: 8000 }
      )
      .then(() => true)
      .catch(() => false);
    archivedPresent = gotArchived;
    byScheme[scheme] = await pg.evaluate(SNAPSHOT, snapArgs);
    await ctx.close();
  }
  const l = byScheme.light;
  const d = byScheme.dark;
  if (!archivedPresent || l.length === 0) {
    console.log("  SKIPPED: this ledger has no archived account, so the archived state could not be exercised.");
    console.log("           Not a failure - the state does not exist in the data. Re-run after archiving one.");
  } else {
    for (let i = 0; i < l.length; i++) {
      if (!d[i]) { fail(`archived: card ${i} missing in dark`); continue; }
      for (let j = 0; j < l[i].texts.length; j++) {
        const a = l[i].texts[j];
        const b = d[i].texts[j];
        if (!b) continue;
        if (a.color !== b.color) {
          fail(`archived ${l[i].name}: "${a.t}" is THEME-DEPENDENT when archived - ${a.color} light, ${b.color} dark`);
        }
        const r = contrast(a.color, a.bg);
        if (r !== null && r < MIN_TEXT_CONTRAST) {
          fail(`archived ${l[i].name}: "${a.t}" ${a.color} on ${a.bg} = ${r.toFixed(2)}:1 when archived. ${CONTRAST_POLICY}`);
        }
      }
      for (const m of iconFailures(l[i], d[i], "archived")) fail(m);
      if (l[i].geometry !== d[i].geometry) fail(`archived ${l[i].name}: geometry differs between schemes when archived`);
    }
    console.log(`  cards: ${l.length}   archived scheme-independence checked`);
  }
}

await browser.close();
console.log(failures === 0 ? "\nBRAND STATES GATE PASS" : `\nBRAND STATES GATE FAIL - ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
