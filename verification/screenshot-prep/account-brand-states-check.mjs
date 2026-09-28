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
  COMPOSITING_HAZARDS,
  COMPOSITING_SCOPE,
  CONTRAST_POLICY,
  MIN_TEXT_CONTRAST,
  contrast,
  describe,
  hazardScan,
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
/**
 * Tab until the INTENDED element is focused, then prove identity before any
 * style is read.
 *
 * The obvious version - "keep pressing Tab until activeElement matches the
 * selector" - is not sufficient, for the same structural reason the leaf-hover
 * case exposed: identifying the target by a selector evaluated at assert-time
 * means a shifted Tab order, a reordered list, or a new focusable element can
 * silently substitute a DIFFERENT node, and the assertion then passes against
 * the wrong control while reporting success. `:focus-visible` also has the
 * ancestor/descendant asymmetry in reverse - focusing the card root does not
 * focus a child - so the target must be the element actually tabbed to.
 *
 * So: mark the node with a unique data attribute FIRST, tab, then assert the
 * focused element both carries the mark and matches :focus-visible. The mark is
 * assigned before any tabbing, so it identifies the node rather than
 * re-locating it.
 */
async function focusVisibleReal(pg, cardIndex, selector) {
  const mark = `mm-fv-${cardIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const marked = await pg.evaluate(
    ([ci, sel, collectSrc, m]) => {
      const cards = eval(`(${collectSrc})`)();
      const el = cards[ci]?.querySelector(sel);
      if (!el) return false;
      el.setAttribute("data-mm-fv-target", m);
      return true;
    },
    [cardIndex, selector, COLLECT.toString(), mark]
  );
  if (!marked) return { ok: false, reason: `no element matching ${selector} inside card ${cardIndex}` };

  // Bounded, and it stops on a real condition: no fixed "40 should be enough"
  // and no sleeping.
  let presses = 0;
  for (; presses < 60; presses++) {
    await pg.keyboard.press("Tab");
    const onMark = await pg.evaluate(
      (m) => document.activeElement?.getAttribute?.("data-mm-fv-target") === m,
      mark
    );
    if (onMark) break;
  }

  // IDENTITY FIRST. Only now are styles read.
  const verdict = await pg.evaluate(
    (m) => {
      const el = document.activeElement;
      if (!el || el.getAttribute?.("data-mm-fv-target") !== m) {
        return { ok: false, reason: `Tab never reached the marked target within the bound (landed on <${el?.tagName?.toLowerCase() ?? "none"}>)` };
      }
      if (!el.matches(":focus-visible")) {
        return { ok: false, reason: "the target is focused but does NOT match :focus-visible - reading :focus styles here would assert something the keyboard user never sees" };
      }
      return { ok: true, presses: 0 };
    },
    mark
  );
  if (verdict.ok) verdict.presses = presses + 1;
  // Leave the page as we found it.
  await pg.evaluate((m) => document.querySelector(`[data-mm-fv-target="${m}"]`)?.removeAttribute("data-mm-fv-target"), mark).catch(() => {});
  return verdict;
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
    await pg.hover('[data-account-card]');
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
    // The trigger, identified by its Radix role slot. The comma fallback to a
    // bare `button` is gone on purpose: it would silently hover whichever
    // button came first, which is the archived selector defect again in a
    // different costume.
    const target = await pg.$('[data-account-card] [data-slot="dropdown-menu-trigger"]');
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
    const name = await pg.$('[data-account-card] h3');
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
    if (!reached.ok) fail(`focus-visible (${scheme}): ${reached.reason}`);
    else console.log(`  ${scheme}: marked target reached in ${reached.presses} Tab press(es), identity and :focus-visible both confirmed`);
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
  // NO SKIP PATH. A previous version printed SKIPPED when this ledger had no
  // archived account, and that is a bypass wearing a warning label: the skip
  // condition was the DATA, not the state of the code, so archiving an account
  // tomorrow would change nothing about whether the assertion ran. The gate
  // would keep printing SKIPPED forever, and the assertion underneath would be
  // dead code that reads as coverage. That is the same control-in-intent-not-
  // enforcement this work exists to remove, so the fixture is now created by
  // the gate: it archives a real account through the real UI, asserts, and
  // un-archives in a `finally` so the ledger is left as found.
  //
  // This also makes the state assertion unconditional - there is no longer a
  // branch in which the archived assertions do not execute.
  // A WIDER VIEWPORT FOR THIS BLOCK ONLY, and the reason is mechanical rather
  // than cosmetic: at 375x667 the archived card's trigger sits at y=669, one
  // pixel below the fold, and the accounts page does not scroll at that height,
  // so the click can never land. The gate's fixture path is therefore not
  // reachable at the mobile size it measures everywhere else. Colours and
  // contrast are viewport-independent, and the geometry assertion compares light
  // against dark at the SAME viewport, so the contract this block enforces is
  // unaffected - but the viewport is stated rather than assumed.
  const FIXTURE_VIEWPORT = { width: 1280, height: 900 };
  const byScheme = {};
  const restorers = [];
  try {
    for (const scheme of ["light", "dark"]) {
      const { ctx, pg } = await openAccounts(browser, { scheme, ...FIXTURE_VIEWPORT });

      // How many archived accounts does this ledger have RIGHT NOW? Read from
      // the live page, not assumed.
      const archivedCount = await pg.evaluate(() => {
        const cb = document.querySelector('input[type="checkbox"]');
        const label = cb ? (cb.closest("label") || cb.parentElement)?.textContent || "" : "";
        const m = label.match(/\((\d+)\)/);
        return m ? +m[1] : 0;
      });

      if (archivedCount === 0) {
        // Create the fixture through the real UI, so the state under test is
        // the one a user reaches rather than one synthesised here.
        const trigger = await pg.$('[data-account-card] [data-slot="dropdown-menu-trigger"]');
        if (!trigger) { fail(`archived (${scheme}): no card trigger to archive from`); await ctx.close(); continue; }
        await trigger.click();
        const item = await pg.waitForSelector('[data-account-action="archive"]', { timeout: 10000 }).catch(() => null);
        if (!item) { fail(`archived (${scheme}): could not open the Archive menu item - the gate cannot create its own fixture`); await ctx.close(); continue; }
        await item.click();
        // The write is real; the restore is registered BEFORE the assertion so
        // a failure below still leaves the ledger clean.
        restorers.push(async () => {
          const { ctx: c2, pg: p2 } = await openAccounts(browser, { scheme, ...FIXTURE_VIEWPORT });
          try {
            const cb = await p2.$('input[type="checkbox"]');
            if (cb) await cb.check();
            // Target the ARCHIVED card's own trigger. Selecting the first card on
            // the page is wrong: with the toggle on, archived cards sit after the
            // active ones, so "first card" is an active account whose menu says
            // "Archive Account" and never "Unarchive Account" - which is exactly
            // how the first restore attempt timed out.
            await p2.waitForFunction(
              () => [...document.querySelectorAll('[data-account-card]')].some(
                (c) => c.hasAttribute("data-account-archived")
              ),
              null,
              { timeout: 15000 }
            );
            const t2 = await p2.$('[data-account-archived] button');
            if (!t2) throw new Error("could not locate the archived card's trigger");
            await t2.click();
            const un = await p2.waitForSelector('[data-account-action="unarchive"]', { timeout: 10000 });
            await un.click();
            // Confirm the restore rather than assuming it: the count must fall.
            const back = await p2
              .waitForFunction(
                () => {
                  const cb = document.querySelector('input[type="checkbox"]');
                  const label = cb ? (cb.closest("label") || cb.parentElement)?.textContent || "" : "";
                  const m = label.match(/\((\d+)\)/);
                  return !!m && +m[1] === 0;
                },
                null,
                { timeout: 15000 }
              )
              .then(() => true)
              .catch(() => false);
            if (!back) throw new Error("clicked Unarchive but the archived count never returned to 0");
          } finally { await c2.close(); }
        });
        // Wait on the real condition: the toggle now reports one archived.
        const ok = await pg
          .waitForFunction(
            () => {
              const cb = document.querySelector('input[type="checkbox"]');
              const label = cb ? (cb.closest("label") || cb.parentElement)?.textContent || "" : "";
              const m = label.match(/\((\d+)\)/);
              return !!m && +m[1] >= 1;
            },
            null,
            { timeout: 15000 }
          )
          .then(() => true)
          .catch(() => false);
        if (!ok) { fail(`archived (${scheme}): archived an account but the count never moved`); await ctx.close(); continue; }
      }

      // Now reveal them.
      const cb = await pg.$('input[type="checkbox"]');
      if (!cb) { fail(`archived (${scheme}): no archived toggle found`); await ctx.close(); continue; }
      await cb.check();
      const got = await pg
        .waitForFunction(
          () => document.querySelectorAll("[data-account-archived]").length > 0,
          null,
          { timeout: 15000 }
        )
        .then(() => true)
        .catch(() => false);
      if (!got) {
        // An archived account EXISTS (count >= 1) but no Archived pill rendered.
        // That is a defect, not a missing fixture, and it must fail.
        fail(`archived (${scheme}): the ledger reports archived accounts but no card rendered the Archived pill - the toggle is not actually revealing them`);
        await ctx.close();
        continue;
      }
      byScheme[scheme] = await pg.evaluate(SNAPSHOT, snapArgs);
      await ctx.close();
    }
  } finally {
    for (const restore of restorers) {
      await restore().catch((e) => fail(`archived: RESTORE FAILED - the gate left an account archived: ${e.message}`));
    }
    if (restorers.length) console.log(`  fixture: archived a real account and restored it (${restorers.length} restore(s))`);
  }
  const l = byScheme.light || [];
  const d = byScheme.dark || [];
  // AN ARCHIVED CARD IS NOW A BRAND SURFACE, AND THE GATE SAYS SO.
  //
  // It was not. `showTone = !is_negative && !is_archived` meant an archived card
  // painted no brand base, defined no CSS variables, and fell back to
  // `bg-card/60` + `border-border` + `opacity-60` - which measured 1.28:1 in
  // light mode. This block caught it precisely because the archived check had
  // been a vacuous pass until the collector was made structural: it was
  // re-measuring seven ACTIVE cards and calling that archived coverage.
  //
  // Archived now keeps the brand ground and brand text, and is de-emphasised by
  // the Archived pill instead. So the full invariant applies here - base, text,
  // icons, divider, border, geometry - and none of it is exempt.
  console.log("  archived cards are brand surfaces; the full invariant applies (no exemptions).");
  if (l.length === 0) {
    fail("archived: no archived cards were measured in EITHER scheme - the assertions below did not run");
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
      if (l[i].divider && l[i].divider !== d[i].divider) fail(`archived ${l[i].name}: divider is theme-dependent when archived (${l[i].divider} -> ${d[i].divider})`);
      if (l[i].border && l[i].border !== d[i].border) fail(`archived ${l[i].name}: border is theme-dependent when archived (${l[i].border} -> ${d[i].border})`);
      if (l[i].geometry !== d[i].geometry) fail(`archived ${l[i].name}: geometry differs between schemes when archived`);
    }
    console.log(`  cards: ${l.length} (${l.map((c) => c.name).join(", ")})   archived scheme-independence checked`);
  }
}

// -------------------------------------------------- pseudo-elements, and the menu
console.log("\n--- known boundaries (asserted, not assumed) ---");
{
  // THE OPENED MENU IS NOT COVERED, AND THAT IS SEPARATE WORK - NOT AN EXCUSE.
  //
  // `DropdownMenuContent` is `bg-popover` / `text-popover-foreground` /
  // `border-border`, with `text-muted-foreground` on its group labels. The
  // brand invariant correctly does NOT apply there: the menu renders in a
  // portal over the page background, so it is a themed surface by definition,
  // not a brand surface. Nothing in this file is wrong about that.
  //
  // What IS uncovered is a different and real question: the popover is its own
  // accessibility surface and it has a contrast story that no gate checks. It
  // is keyboard-navigable, it opens on focus, its items carry a muted-foreground
  // label at small size, and it is dismissed by Escape. None of that is
  // measured anywhere. Written down so it cannot rot into silence.
  //
  //   TODO(popover-contrast): assert WCAG contrast for DropdownMenuContent and
  //   DropdownMenuItem against `bg-popover` in BOTH schemes, and assert
  //   keyboard reachability + Escape dismissal, using
  //   [data-slot=dropdown-menu-content] as the structural handle. Separate
  //   script and a separate gate entry: it is a different invariant (contrast,
  //   not scheme-independence) on a different surface (a portal, not a card).
  console.log("  popover: NOT covered - themed surface by design, brand invariant n/a.");
  console.log("            TODO(popover-contrast): its own contrast + keyboard contract. Named, not silent.");
  // (2) PSEUDO-ELEMENTS. A text-leaf walk cannot see `::before` / `::after` -
  // CSS-generated content has no DOM node - so a themed colour there would be
  // invisible to every check in this file. That is the same blindness as the
  // SVG-only trigger, one layer down.
  //
  // The card uses no pseudo-element today: no `before:` / `after:` variant in
  // account-card.tsx and no rule in globals.css targeting it. Rather than leave
  // that as a comment that silently rots, the scan below reads
  // getComputedStyle(node, "::before") / "::after" over every element these
  // gates measure, so the day one is added with a colour the scan sees it and
  // the compositing guard fails naming it. The boundary is enforced, not
  // documented.
  const hazArgs = [COLLECT.toString(), COMPOSITING_SCOPE.toString(), COMPOSITING_HAZARDS];
  for (const scheme of ["light", "dark"]) {
    const { ctx, pg } = await openAccounts(browser, { scheme });
    const { hazards, coverage } = await pg.evaluate(hazardScan, hazArgs);
    // Coverage before absence - the audit's finding. An empty hazard list is
    // evidence only if the scan actually looked at something; otherwise a
    // renamed selector produces the same green as a clean app.
    if (coverage.cards === 0 || coverage.leaves === 0) {
      fail(`compositing-model guard (${scheme}) did not run: scanned ${coverage.cards} card(s), ${coverage.leaves} leaves. An empty hazard list means nothing when the scan saw nothing.`);
    } else if (hazards.length === 0) {
      console.log(`  ${scheme}: PASS  no backdrop-filter / blend / filter / sub-1 opacity / non-sRGB — scanned ${coverage.cards} cards, ${coverage.nodes} chain nodes, ${coverage.pseudos} pseudo-element(s)`);
    } else {
      for (const h of hazards) {
        fail(`compositing model (${scheme}): ${h.card} ${h.el} has ${h.prop}: ${h.value} (${h.where}). The sRGB compositing in paintedBg() is wrong for this element.`);
      }
    }
    await ctx.close();
  }
}

await browser.close();
console.log(failures === 0 ? "\nBRAND STATES GATE PASS" : `\nBRAND STATES GATE FAIL - ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
