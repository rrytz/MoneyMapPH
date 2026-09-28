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

/**
 * Motion suppression, injected AFTER every navigation.
 *
 * This gate asserts on geometry, and both bars carry transitions, so without it
 * every box is read mid-animation. The order matters and is not incidental:
 * `addStyleTag` writes into the current document, `goto` replaces that
 * document, so injecting first discards the tag with no error at all. The brand
 * gate shipped that bug for two commits.
 */
const KILL_MOTION = "* { transition: none !important; animation: none !important; }";

const REACHABILITY_WIDTHS = [1440, 1280, 1100, 1024, 900];
const MOBILE_WIDTHS = [375, 390];
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
  // Motion suppressed AFTER navigation. `addStyleTag` writes into the CURRENT
  // document and `goto` replaces that document, so injecting before the
  // navigation discards the tag silently - which is what the brand gate did for
  // two commits until a menu click timed out on a moving element and sent me
  // looking at why.
  //
  // This gate measures geometry, and both bars carry transitions, so without
  // this it has been reading boxes mid-animation and calling the result a
  // layout.
  await pg.addStyleTag({ content: KILL_MOTION });
  // The previous line after goto was `waitForTimeout(800)`, immediately after a
  // `waitForFunction` that the spinner had already gone. The condition implies
  // the content is ready; the sleep was superstition, and it was on the hot
  // path - once per viewport, and again once per destination.
  await settled(pg);
  return { ctx, pg };
}

/**
 * The one settling condition, shared by every opener.
 *
 * Waits for the nav to exist AND for the page to stop growing, which is the
 * thing a fixed sleep was standing in for. `requestAnimationFrame` twice is not
 * a sleep: it yields until the compositor has presented, so a box measured
 * afterwards corresponds to a frame the user could actually see.
 */
async function settled(pg, navSelector = "[data-desktop-nav], [data-mobile-nav]") {
  // `state: "attached"`, NOT the default "visible". At any given width exactly
  // one of the two bars is legitimately hidden - the desktop nav carries
  // `hidden ... lg:flex` - so waiting for visibility either hangs forever or
  // waits for the wrong bar. What this needs to know is that the app has
  // rendered, not which breakpoint it landed on; which bar is showing is
  // precisely what the phases assert.
  await pg.waitForSelector(navSelector, { state: "attached", timeout: 20000 });
  await pg.waitForFunction(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true)))),
    null,
    { timeout: 5000 }
  );
}

// Phase D needs a real device height. `openAt` hardcodes 800, which is not
// short: the overlap it guards against was found at 375x667, where the page
// had to scroll, and asserting at 800 passes by having more room. Measuring the
// width while ignoring the height is the same class of error as comparing to
// the wrong frame.
async function openAtViewport(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: "dark" });
  await ctx.addCookies(pairs.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })));
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(30000);
  await pg.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  await pg.addStyleTag({ content: KILL_MOTION });
  // Was a bare 1200ms. Replaced by the same observed condition every other
  // opener uses, so the two cannot drift into disagreeing about what "ready"
  // means.
  await settled(pg);
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
  const top = document.querySelector('[data-desktop-nav]');
  const bottom = document.querySelector("[data-mobile-nav]");
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
    const top = document.querySelector('[data-desktop-nav]');
    const bottom = document.querySelector("[data-mobile-nav]");
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


// ---------------------------------------------------------------- Phase C
// The mobile bar's CONTENT and its active state.
//
// Phases A and B both assert the bottom nav PAINTS at a mobile width. Neither
// says what is IN it, so swapping two destinations - or a slot going silently
// missing - passed the gate completely. That gap is why this phase exists.
//
// Added with the IA change that moved /accounts onto the bar and /income
// behind More, which has one non-obvious consequence: `isMoreActive` derives
// from `secondaryItems`, so More must now highlight on Income. That is exactly
// the kind of behaviour that renders correctly and asserts nothing.
console.log("\n=== PHASE C - mobile slot identity, order and active state ===");

// MEMBERSHIP comes from PRIMARY_MOBILE_HREFS; RENDERED ORDER comes from
// NAV_ITEMS, because `primaryItems = NAV_ITEMS.filter(...)` preserves it. Those
// are two different lists and this expectation asserts the second one.
//
// So this is NOT the order of PRIMARY_MOBILE_HREFS. Accounts sits second
// because that is where NAV_ITEMS declares it, and it is the only list that
// orders anything - on desktop as well as mobile. Reordering NAV_ITEMS would
// reorder both navs, and sorting primaryItems would put ordering in two places
// and make the two navs disagree. Neither was done; this expectation simply
// records what the shared constant actually produces.
const EXPECTED_MOBILE_SLOTS = ["/dashboard", "/accounts", "/expenses", "/budgets"];
const MORE_SCOPES_ACTIVE = [
  "/income", "/savings", "/transactions", "/forecasting", "/simulator", "/settings",
];
const DIRECT_ACTIVE = ["/dashboard", "/expenses", "/budgets", "/accounts"];

// "Visible" cannot be a display keyword read off the element: a child of a
// display:none subtree still computes its own display. Hence the ancestor walk.
//
// The bar is identified by `[data-mobile-nav]`, NOT by "the first visible
// <nav> in the document". The old finder was the blanket
// `querySelectorAll("nav").find(visible && height > 0)`, and I proved what that
// costs by deleting the `data-mobile-nav` attribute: the gate still reported
// `375px bar --- PASS` and exited 0, because with the attribute gone it simply
// found the mobile nav by being the first visible <nav> on the page. The
// rewrite had fixed the individual queries and left the finder, so the gate was
// measuring a bar it had no handle to - the archived-card defect, in the file I
// was rewriting specifically to remove it.
//
// Document order is not identity either: both bars are <nav>, so "first
// visible" is a statement about layout that changes with the breakpoint.
const FIND_VISIBLE_NAV = `(() => {
  const vis = (el) => {
    if (el.checkVisibility) return el.checkVisibility({ checkVisibilityCSS: true });
    let n = el;
    while (n && n !== document.documentElement) {
      if (getComputedStyle(n).display === "none") return false;
      n = n.parentElement;
    }
    return true;
  };
  const el = document.querySelector("[data-mobile-nav]");
  return el && vis(el) ? el : null;
})()`;

for (const width of MOBILE_WIDTHS) {
  const { ctx, pg } = await openAt(width);

  // 1. five slots, in order, nothing clipped, no overflow
  const bar = await pg.evaluate((finder) => {
    const nav = eval(finder);
    // Presence is reported, not assumed. The old shape returned
    // `{ err: "no visible bottom nav" }` and the very next line did
    // `bar.links.map(...)` on it - so a missing nav produced a TypeError, an
    // unhandled crash and a non-zero exit that says nothing about what was
    // wrong. A crash is not a false pass, but it is an unnamed one.
    if (!nav) return { navFound: false };
    const more = nav.querySelector("[data-mobile-nav-more]");
    return {
      navFound: true,
      links: [...nav.querySelectorAll("a")].map((a) => ({
        href: a.getAttribute("href"),
        w: Math.round(a.getBoundingClientRect().width),
        clipped: a.scrollWidth > a.clientWidth + 1,
      })),
      more: more
        ? { label: (more.innerText || "").trim(), clipped: more.scrollWidth > more.clientWidth + 1 }
        : null,
      navH: Math.round(nav.getBoundingClientRect().height),
      overflow: nav.scrollWidth > nav.clientWidth + 1,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  }, FIND_VISIBLE_NAV);

  if (!bar.navFound) {
    // FAIL LOUDLY AND SPECIFICALLY rather than dereferencing a missing nav.
    failures++;
    console.log(`--- ${width}px bar --- FAIL (no [data-mobile-nav] rendered - nothing to assert on)`);
    continue;
  }

  const hrefs = bar.links.map((l) => l.href);
  // Presence before equality, stated as its own term. `slotMatch` alone is
  // false for an empty bar, so this is belt-and-braces - but the audit's rule
  // is that the absence of a subject must be visible in the output, and
  // `bar.links.length === 0` is exactly the condition a renamed selector would
  // produce.
  const barPresent = bar.links.length > 0 && !!bar.more;
  const slotMatch =
    barPresent &&
    hrefs.length === EXPECTED_MOBILE_SLOTS.length &&
    EXPECTED_MOBILE_SLOTS.every((h, i) => hrefs[i] === h);
  const noClip = bar.links.every((l) => !l.clipped) && !(bar.more && bar.more.clipped);
  const barOk = slotMatch && noClip && !bar.overflow && !bar.hScroll;
  if (!barOk) failures++;
  console.log(`--- ${width}px bar --- ${barOk ? "PASS" : "FAIL"}${barPresent ? "" : " (bar incomplete - nothing to compare)"}`);
  console.log(`  slots:    ${hrefs.join(" . ")} . ${bar.more ? bar.more.label : "(no More)"}`);
  console.log(`  expected: ${EXPECTED_MOBILE_SLOTS.join(" . ")} . More  -> ${slotMatch ? "match" : "MISMATCH"}`);
  console.log(`  height ${bar.navH}px  clipped ${noClip ? "none" : "YES"}  navOverflow ${bar.overflow}  hScroll ${bar.hScroll}`);

  // 2. each daily destination activates ITS OWN slot, via aria-current
  for (const href of DIRECT_ACTIVE) {
    await pg.goto(`http://localhost:3000${href}`, { waitUntil: "networkidle" });
    await pg.addStyleTag({ content: KILL_MOTION });
    await settled(pg);
    const active = await pg.evaluate((finder) => {
      const nav = eval(finder);
      const a = nav && nav.querySelector('a[aria-current="page"]');
      return a ? a.getAttribute("href") : null;
    }, FIND_VISIBLE_NAV);
    const pass = active === href;
    if (!pass) failures++;
    console.log(`  ${href.padEnd(13)} -> active slot ${String(active).padEnd(13)} ${pass ? "PASS" : `FAIL (expected ${href})`}`);
  }

  // 3. every secondary destination highlights MORE and leaves no direct slot
  for (const href of MORE_SCOPES_ACTIVE) {
    await pg.goto(`http://localhost:3000${href}`, { waitUntil: "networkidle" });
    await pg.addStyleTag({ content: KILL_MOTION });
    await settled(pg);
    const st = await pg.evaluate((finder) => {
      const nav = eval(finder);
      if (!nav) return { active: null, more: false, moreFound: false, navFound: false };
      const more = nav.querySelector("[data-mobile-nav-more]");
      const a = nav.querySelector('a[aria-current="page"]');
      // The state is `data-active`, and nothing else.
      //
      // This used to fall back to regexing `bg-sulpot|text-sulpot|...` out of
      // className and innerHTML. That is the archived-card defect verbatim -
      // inferring a state from how it is painted - and it is what would have
      // rotted silently on the next theme rename, leaving "More must light up"
      // asserting against a string that no longer appears anywhere. The
      // `data-active` signal was already in the same object one line up; the
      // fallback made the correct answer optional.
      const moreActive = !!(more && more.querySelector("[data-active='true']"));
      return { active: a ? a.getAttribute("href") : null, more: moreActive, moreFound: !!more, navFound: true };
    }, FIND_VISIBLE_NAV);
    // /income is the one this slice changed: it was a direct slot and is now
    // secondary, so More must light up where it previously did not.
    //
    // Presence before equality. `st.more === true` already implies the trigger
    // was found, so this cannot pass by having nothing to assert on - but the
    // reasons are separated so that a FAIL says which of the two things broke.
    const pass = st.more === true && st.active === null;
    if (!st.navFound) {
      failures++;
      console.log(`  ${href.padEnd(13)} -> NO NAV FOUND  FAIL (nothing to assert on)`);
    } else if (!st.moreFound) {
      failures++;
      console.log(`  ${href.padEnd(13)} -> no [data-mobile-nav-more]  FAIL (nothing to assert on)`);
    } else if (!pass) {
      failures++;
      console.log(`  ${href.padEnd(13)} -> More ${String(st.more).padEnd(6)} direct ${String(st.active).padEnd(11)} FAIL`);
    } else {
      console.log(`  ${href.padEnd(13)} -> More ${String(st.more).padEnd(6)} direct ${String(st.active).padEnd(11)} PASS`);
    }
  }

  await ctx.close();
}


// ---------------------------------------------------------------- Phase D
// Mobile end-of-scroll reachability: can the last thing on the page actually be
// seen, or is it behind the fixed bottom nav?
//
// Phase C asserts what is IN the bar. This asserts what is UNDER it.
//
// WHY A SEPARATE OPENER: `openAt` hardcodes height 800, which is not short. An
// earlier version of this phase passed at 375 and 390 while opening at 800
// tall - it measured the width and ignored the height, which is the same class
// of error as comparing against the wrong frame. Hence openAtViewport.
//
// WHY A SYNTHETIC NEGATIVE CASE: with the real dashboard - one short bills row -
// the last content sits 114px+ above the bar, so the real assertion has nothing
// to catch and passes vacuously. A check that has never been observed to fail is
// not evidence of anything. The synthetic case below forces an unsafe state
// INSIDE the probe and requires the assertion to REJECT it. If someone weakens
// the assertion, this case fails, which is the only thing that makes it worth
// having.
//
// Both cases call the SAME function and the SAME scroll-to-end behaviour, on
// the REAL scroll container and the REAL nav element. Nothing is mocked.
console.log("\n=== PHASE D - mobile end-of-scroll reachability ===");

// 1px tolerance: sub-pixel layout can put a descender a fraction below a
// boundary it visually clears. Note how small this is - it is the number a
// weakened assertion would inflate, and the synthetic case below exists to
// catch exactly that.
const REACHABILITY_TOLERANCE_PX = 1;

/**
 * The one assertion. True when the lowest content is clear of the nav.
 * Both the real and the synthetic case call this, so weakening it here fails
 * the synthetic case rather than silently passing both.
 */
function contentClearsNav(lastContentBottom, navTop) {
  if (lastContentBottom === null || navTop === null) return false;
  return lastContentBottom <= navTop + REACHABILITY_TOLERANCE_PX;
}

// The lowest visible leaf text inside the scroller. A BLOCK can be mostly
// padding and still read as "clears the nav" while its content does not, so
// the measurement target is text, not a container.
const PROBE_LOWEST_TEXT = `(scroller) => {
  let lowest = null;
  for (const el of scroller.querySelectorAll("*")) {
    if (el.children.length) continue;
    const t = (el.textContent || "").trim();
    if (!t) continue;
    const b = el.getBoundingClientRect();
    if (b.height === 0 || b.width === 0) continue;
    if (!lowest || b.bottom > lowest.bottom) lowest = { bottom: b.bottom, t: t.slice(0, 28) };
  }
  return lowest;
}`;

// The two real device sizes this was reported against. Height matters: the
// defect was found at 375x667, and an 800px-tall viewport passes vacuously.
const MOBILE_DEVICES = [[375, 667], [390, 844]];

const SCROLL_TO_END = `(scroller) => {
  scroller.scrollTop = scroller.scrollHeight;
}`;


// ------------------------------------------------------------------ REAL
console.log("\n--- REAL ---");
for (const [width, height] of MOBILE_DEVICES) {
  const { ctx, pg } = await openAtViewport(width, height);
  const r = await pg.evaluate(
    ([finder, probe, scrollerSel]) => {
      const nav = eval(finder);
      const scroller = document.querySelector(scrollerSel) || document.scrollingElement;
      const navBox = nav ? nav.getBoundingClientRect() : null;
      return {
        isBottom: !!navBox && navBox.top > window.innerHeight * 0.6,
        navTop: navBox ? Math.round(navBox.top) : null,
        lowest: eval(probe)(scroller),
        scrolledTo: scroller.scrollTop,
        contentH: scroller.scrollHeight,
      };
    },
    [FIND_VISIBLE_NAV, PROBE_LOWEST_TEXT, "main"]
  );

  // SCROLL FIRST, then measure. The rect is viewport-relative, so an unscrolled
  // reading answers a different question and reports a false failure for any
  // page taller than its viewport.
  await pg.evaluate((s) => { const sc = document.querySelector("main") || document.scrollingElement; return eval(s)(sc); }, SCROLL_TO_END);
  // Was 400ms. A scroll is an event with a real completion condition, not a
  // duration: wait until the container is actually at the end, then yield a
  // frame so the measurement corresponds to a presented frame rather than a
  // scroll position the compositor has not drawn yet.
  await pg.waitForFunction(() => {
    const sc = document.querySelector("main") || document.scrollingElement;
    return sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
  }, null, { timeout: 5000 });
  await settled(pg);
  const after = await pg.evaluate(
    ([finder, probe]) => {
      const nav = eval(finder);
      const scroller = document.querySelector("main") || document.scrollingElement;
      const navBox = nav ? nav.getBoundingClientRect() : null;
      return { navTop: navBox ? Math.round(navBox.top) : null, lowest: eval(probe)(scroller) };
    },
    [FIND_VISIBLE_NAV, PROBE_LOWEST_TEXT]
  );

  const pass = after.isBottom !== false && contentClearsNav(after.lowest?.bottom ?? null, after.navTop);
  if (!pass) failures++;
  console.log(`  ${width}x${height} ... ${pass ? "PASS" : "FAIL"}`);
  console.log(`    nav top ${after.navTop}, lowest content "${after.lowest?.t ?? "-"}" bottom ${after.lowest ? Math.round(after.lowest.bottom) : "-"}`);
  await ctx.close();
}

// ----------------------------------------------------------- SYNTHETIC
// Force an unsafe state INSIDE the probe: strip the scroll container's bottom
// clearance and append a sentinel tall enough that the end of the scroll
// necessarily reaches the nav. Then require the assertion to REJECT it.
console.log("\n--- SYNTHETIC NEGATIVE (assertion must reject an unsafe state) ---");
for (const [width, height] of MOBILE_DEVICES) {
  const { ctx, pg } = await openAtViewport(width, height);

  const unsafe = await pg.evaluate((finder) => {
    const nav = eval(finder);
    const scroller = document.querySelector("main") || document.scrollingElement;
    // 1. no bottom clearance on the scroll container
    scroller.style.paddingBottom = "0px";
    // 2. a sentinel that guarantees the end of the scroll reaches the nav area
    const sentinel = document.createElement("div");
    sentinel.id = "__reachability_sentinel";
    sentinel.style.cssText = "height:900px;background:transparent;";
    sentinel.textContent = "sentinel";
    scroller.appendChild(sentinel);
    return { isBottom: !!nav && nav.getBoundingClientRect().top > window.innerHeight * 0.6 };
  }, FIND_VISIBLE_NAV);

  // 3. scroll fully to the end
  await pg.evaluate(() => {
    const s = document.querySelector("main") || document.scrollingElement;
    s.scrollTop = s.scrollHeight;
  });
  // Was 400ms. Same condition as the real case: wait for the scroll to actually
  // arrive, then yield a frame. The synthetic negative exists to prove this
  // assertion can reject an unsafe state, and a measurement taken before the
  // scroll lands would not be testing what it claims to test.
  await pg.waitForFunction(() => {
    const s = document.querySelector("main") || document.scrollingElement;
    return s.scrollTop + s.clientHeight >= s.scrollHeight - 1;
  }, null, { timeout: 5000 });
  await settled(pg);

  const m = await pg.evaluate(
    ([finder, probe]) => {
      const nav = eval(finder);
      const scroller = document.querySelector("main") || document.scrollingElement;
      const navBox = nav ? nav.getBoundingClientRect() : null;
      const sentinel = document.getElementById("__reachability_sentinel");
      return {
        navTop: navBox ? Math.round(navBox.top) : null,
        sentinelBottom: sentinel ? sentinel.getBoundingClientRect().bottom : null,
        lowest: eval(probe)(scroller),
      };
    },
    [FIND_VISIBLE_NAV, PROBE_LOWEST_TEXT]
  );

  const measured = m.sentinelBottom ?? m.lowest?.bottom ?? null;
  const assertionSaysClear = contentClearsNav(measured, m.navTop);
  const overlap = m.navTop !== null && measured !== null ? Math.round(measured - m.navTop) : 0;

  // The synthetic case PASSES only when the assertion correctly REJECTS.
  // If it accepts an unsafe state, the assertion has been weakened and THE GATE
  // FAILS - which is the entire purpose of this block.
  const detected = assertionSaysClear === false && overlap > 0;
  if (!detected) failures++;
  console.log(`  ${width}x${height} ... ${detected ? "expected assertion failure detected ... PASS" : "*** ASSERTION ACCEPTED AN UNSAFE STATE - FAIL ***"}`);
  console.log(`    nav top ${m.navTop}, sentinel bottom ${m.sentinelBottom !== null ? Math.round(m.sentinelBottom) : "-"}, overlap ${overlap > 0 ? overlap + "px behind the nav" : "none"}`);

  await ctx.close();
}

// The desktop conditional, proving the skip path rather than assuming it.
{
  const { ctx, pg } = await openAt(1280);
  const r = await pg.evaluate((finder) => {
    const mobile = eval(finder);
    const desktop = document.querySelector("[data-desktop-nav]");
    const vis = (el) => {
      if (!el) return false;
      if (el.checkVisibility) return el.checkVisibility({ checkVisibilityCSS: true });
      return getComputedStyle(el).display !== "none";
    };
    const b = mobile && vis(mobile) ? mobile.getBoundingClientRect() : null;
    return {
      desktopPresent: vis(desktop),
      mobilePresent: !!(mobile && vis(mobile)),
      h: b ? Math.round(b.height) : 0,
      top: b ? Math.round(b.top) : null,
      isBottom: !!b && b.top > window.innerHeight * 0.6,
    };
  }, FIND_VISIBLE_NAV);
  // This used to be `r.isBottom === false`, and it passed for the wrong reason.
  // `isBottom` is `!!b && ...`, so a nav that was never rendered also yields
  // false - meaning "the mobile bar is not pinned to the bottom" was satisfied by
  // "there is no mobile bar", which is a different claim. The printed line said
  // so outright: `nav 0px at y=null ... PASS`.
  //
  // That is the archived-skip defect in its purest form: the condition producing
  // the pass is the ABSENCE of the thing under test, so a mobile nav that
  // silently stopped rendering would have been reported as correct.
  //
  // The subject at 1280px is the DESKTOP nav. So assert it is present, and
  // separately that the mobile bar is not pinned - two complementary facts about
  // one breakpoint, rather than one fact with two possible meanings.
  const pass = r.desktopPresent && !r.isBottom;
  if (!pass) failures++;
  const why = !r.desktopPresent
    ? "no [data-desktop-nav] rendered - nothing to assert on"
    : r.isBottom
      ? "mobile nav pinned to the bottom at a desktop width"
      : "desktop nav shown, mobile nav not pinned";
  console.log(`\n  1280px conditional ... ${pass ? "PASS" : "FAIL"}  (${why}; mobile present=${r.mobilePresent} ${r.h}px at y=${r.top})`);
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nNAV GATE PASS" : `\nNAV GATE FAIL — ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
