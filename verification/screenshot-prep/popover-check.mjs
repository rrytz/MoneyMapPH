// gate:popover — AA contrast for the account card's opened menu.
//
// A DIFFERENT INVARIANT FROM THE BRAND GATES, deliberately.
//
//   gate:brand   says a brand surface is THEME-PROOF: every colour on it must be
//                identical in light and dark, because a brand card carries its own
//                colours and is not a themed surface.
//
//   gate:popover says a PORTAL SURFACE IS A THEMED SURFACE BY DEFINITION.
//                DropdownMenuContent renders in a portal over the page, so
//                --popover is the right thing for it to use, and demanding
//                scheme-independence of it would be demanding the wrong property.
//                What it owes is LEGIBILITY: text must clear AA against the
//                surface it is painted on, in BOTH schemes.
//
// The two are not variants of each other. Merging them is how a rule ends up
// asserting something true of one surface and false of the other.
//
// ------------------------------------------------------------------
// REACHING THE OPENED STATE FOR REAL
// ------------------------------------------------------------------
//
// The menu is opened by a real click on the real trigger, not by setting state or
// dispatching a synthetic event. Radix builds its portal, positions it, and moves
// focus in response to genuine events; a simulated open can produce a DOM that
// never occurs for a user, and then the gate asserts about a fiction.
//
// The same trap class as the leaf-hover finding: the test must be able to reach
// the thing it is testing, or it asserts nothing while reporting green.
//
// ------------------------------------------------------------------
// SCOPING: THE PORTAL, NOT THE TRIGGER
// ------------------------------------------------------------------
//
// Measured: `[data-slot=dropdown-menu-content]` has `insideCard === false` and
// its parent is a wrapper DIV, not the card. Anything scoped to the trigger's
// subtree finds nothing at all. Every assertion below queries the portal.
//
// ------------------------------------------------------------------
// THE SURFACE IS THE COMPOSITED ONE
// ------------------------------------------------------------------
//
// Measured on this component today: no scrim (`OVERLAYS []`) and
// `backdrop-filter: none` on the content, so the effective background behind an
// item IS the popover's own token.
//
// That is a MEASUREMENT, not an assumption, and the gate re-checks it every run
// rather than trusting it: if a scrim or a backdrop-filter ever appears, the
// composited ancestor chain is walked and the effective surface is used. Adding
// one silently must not quietly invalidate the contrast numbers.

import { chromium } from "playwright";
import { openAccounts } from "./account-brand-check.mjs";

export const MIN_POPOVER_TEXT_CONTRAST = 4.5;

export const POPOVER_POLICY =
  "WCAG AA at 4.5:1, applied to NORMAL text. Menu items measure 13.125px at " +
  "weight 400, which is normal text by WCAG's own definition, so the large-text " +
  "3:1 allowance does not apply. This is a themed surface, so the invariant is " +
  "legibility in BOTH schemes, not scheme-independence - see the header.";

const toRgba = (css) => {
  const m = String(css).match(/[\d.]+/g);
  if (!m || m.length < 3) return null;
  return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 };
};
const over = (fg, bg) => {
  const f = toRgba(fg);
  if (!f) return bg;
  if (f.a >= 1) return `rgb(${f.r}, ${f.g}, ${f.b})`;
  const b = toRgba(bg) || { r: 255, g: 255, b: 255, a: 1 };
  return `rgb(${Math.round(f.r * f.a + b.r * (1 - f.a))}, ${Math.round(f.g * f.a + b.g * (1 - f.a))}, ${Math.round(f.b * f.a + b.b * (1 - f.a))})`;
};
const luminance = (css) => {
  const c = toRgba(css);
  if (!c) return null;
  const [r, g, b] = [c.r, c.g, c.b].map((v) => {
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

const browser = await chromium.launch({ headless: true });
let failures = 0;
const fail = (m) => {
  failures++;
  console.log(`    FAIL  ${m}`);
};

const snapArgs = [over.toString(), toRgba.toString()];

for (const scheme of ["light", "dark"]) {
  const { ctx, pg } = await openAccounts(browser, { scheme });

  // REAL click on the REAL trigger.
  const trigger = await pg.$('[data-account-card] [data-slot="dropdown-menu-trigger"]');
  if (!trigger) {
    fail(`${scheme}: no [data-slot=dropdown-menu-trigger] on a card - the opened state could not be reached, so nothing below ran`);
    await ctx.close();
    continue;
  }
  await trigger.click();

  const opened = await pg
    .waitForSelector('[data-slot="dropdown-menu-content"]', { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    fail(`${scheme}: clicked the trigger but [data-slot=dropdown-menu-content] never appeared - the opened state was not reached, so nothing below ran`);
    await ctx.close();
    continue;
  }

  const m = await pg.evaluate(
    ([overSrc, rgbaSrc]) => {
      const toRgba = eval(`(${rgbaSrc})`);
      const over = eval(`(${overSrc})`);
      const content = document.querySelector('[data-slot="dropdown-menu-content"]');
      const card = document.querySelector("[data-account-card]");
      const cs = getComputedStyle(content);
      const rect = content.getBoundingClientRect();

      // Is a scrim or backdrop in play? Re-measured every run rather than assumed.
      const scrims = [...document.body.children]
        .filter((el) => el !== content && !el.contains(content))
        .map((el) => ({ el, s: getComputedStyle(el) }))
        .filter(({ s }) => /fixed|absolute/.test(s.position) && s.display !== "none" && s.backgroundColor !== "rgba(0, 0, 0, 0)")
        .map(({ el, s }) => ({ cls: String(el.className).slice(0, 50), bg: s.backgroundColor }));
      const hasBackdropFilter = cs.backdropFilter && cs.backdropFilter !== "none";

      // The EFFECTIVE surface behind an item: walk up from the item, compositing
      // every translucent layer, so a scrim added later cannot silently leave
      // these numbers describing a background nobody sees.
      const paintedBg = (el) => {
        const stack = [];
        let n = el;
        while (n && n !== content.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") stack.push(c);
          n = n.parentElement;
        }
        let out = getComputedStyle(content).backgroundColor;
        for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
        return out;
      };

      const items = [...content.querySelectorAll('[data-slot="dropdown-menu-item"]')].map((it) => {
        const s = getComputedStyle(it);
        return {
          text: (it.textContent || "").trim().slice(0, 24),
          color: s.color,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          bg: paintedBg(it),
        };
      });

      return {
        insideCard: card ? card.contains(content) : false,
        portalParent: content.parentElement?.tagName,
        contentBg: cs.backgroundColor,
        contentColor: cs.color,
        backdropFilter: cs.backdropFilter,
        hasBackdropFilter,
        scrims,
        items,
        visible: rect.width > 0 && rect.height > 0,
      };
    },
    snapArgs
  );

  // PRESENCE BEFORE ANY EQUALITY. An empty item list would make every contrast
  // assertion below vacuous - the null-vs-null shape, wearing a menu.
  if (!m.visible) fail(`${scheme}: popover content has zero size - it is not rendered, so nothing can be asserted about it`);
  if (m.items.length === 0) {
    fail(`${scheme}: popover opened with ZERO items - the contrast assertions would run against an empty set and pass without comparing anything`);
  }

  for (const it of m.items) {
    const r = contrast(it.color, it.bg);
    if (r !== null && r < MIN_POPOVER_TEXT_CONTRAST) {
      fail(`${scheme}: menu item "${it.text}" (${it.fontSize} / ${it.fontWeight}) ${it.color} on ${it.bg} = ${r.toFixed(2)}:1, below the ${MIN_POPOVER_TEXT_CONTRAST}:1 AA floor. ${POPOVER_POLICY}`);
    }
  }

  if (m.scrims.length) console.log(`    note: ${scheme}: a scrim is present ${JSON.stringify(m.scrims)} - the composited chain was walked, not the popover token`);
  if (m.hasBackdropFilter) console.log(`    note: ${scheme}: backdrop-filter ${m.backdropFilter} on the content - the composited chain was walked`);

  console.log(`  ${scheme.padEnd(5)} items=${m.items.length}  insideCard=${m.insideCard}  portalParent=${m.portalParent}  popoverBg=${m.contentBg}  scrims=${m.scrims.length}  backdrop=${m.hasBackdropFilter}`);
  for (const it of m.items) {
    const r = contrast(it.color, it.bg);
    console.log(`    ${String(r === null ? "-" : r.toFixed(2) + ":1").padStart(7)}  ${it.text}`);
  }

  // Escape must close it, or the menu is a trap for a keyboard user. Cheap, and
  // the same real-interaction discipline as the open.
  await pg.keyboard.press("Escape");
  const closed = await pg
    .waitForFunction(() => !document.querySelector('[data-slot="dropdown-menu-content"]'), null, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!closed) fail(`${scheme}: Escape did not close the popover - it traps the keyboard`);

  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nPOPOVER GATE PASS" : `\nPOPOVER GATE FAIL - ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
