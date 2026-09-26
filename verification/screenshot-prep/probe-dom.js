// DOM probe for MoneyMap PH design diagnosis.
// Returns typography/radius/accent/grid facts + emoji scan. No PII dumps.
// Async on purpose: the light column removes `.dark` immediately before this
// runs, so CSS transitions (cards carry `transition-all`) are still tweening
// toward the light world's values. Sampling mid-tween reports the dark world's
// computed colors. Wait the transitions out before reading anything.
(async () => {
  await new Promise((r) => setTimeout(r, 250));
  const out = { width: innerWidth, height: innerHeight };
  const cs = (el) => getComputedStyle(el);
  const bs = cs(document.body);
  out.body = {
    fontFamily: bs.fontFamily.split(",").slice(0, 2).join(","),
    fontSize: bs.fontSize,
    lineHeight: bs.lineHeight,
    letterSpacing: bs.letterSpacing,
    bg: bs.backgroundColor,
    color: bs.color,
  };
  const radiusPatterns = [
    ["rounded-2xl", "r2xl"], ["rounded-xl", "rxl"], ["rounded-lg", "rlg"],
    ["rounded-full", "rfull"], ["rounded-none", "rsq"], ["rounded-sm", "rsm"],
  ];
  out.radiusCounts = {};
  for (const [cls, k] of radiusPatterns) {
    out.radiusCounts[k] = document.querySelectorAll('[class*="' + cls + '"]').length;
  }
  out.cardSamples = [...document.querySelectorAll('[class*="rounded-2xl"]')].slice(0, 6).map((el) => {
    const s = cs(el); const r = el.getBoundingClientRect();
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      radius: s.borderRadius, bg: s.backgroundColor,
      border: s.borderBottomWidth + " " + s.borderStyle + " " + s.borderColor,
      shadow: s.boxShadow === "none" ? "none" : "shadow",
      padding: s.padding, fontFamily: s.fontFamily.split(",")[0],
    };
  });
  out.headings = [...document.querySelectorAll("h1,h2,h3")].slice(0, 8).map((el) => {
    const s = cs(el);
    return {
      tag: el.tagName, txt: (el.textContent || "").trim().slice(0, 26),
      fs: s.fontSize, fw: s.fontWeight, ls: s.letterSpacing, ff: s.fontFamily.split(",")[0],
    };
  });
  out.figures = [...document.querySelectorAll('[class*="tabular-nums"]')].slice(0, 6).map((el) => {
    const s = cs(el);
    return {
      fs: s.fontSize, fw: s.fontWeight, ls: s.letterSpacing, color: s.color,
      txt: (el.textContent || "").trim().slice(0, 12),
    };
  });
  let em = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = walker.nextNode())) {
    const t = n.nodeValue || "";
    const emojis = [...t].filter((c) =>
      c.codePointAt(0) > 0x1F000 || (c.codePointAt(0) >= 0x2600 && c.codePointAt(0) <= 0x27BF)
    );
    if (emojis.length) { em.push(emojis.join("")); if (em.length > 24) break; }
  }
  out.emojis = em;
  const accentEl = [...document.querySelectorAll("button,[class*='bg-'],a")].slice(0, 12).map((el) => {
    const s = cs(el); const r = el.getBoundingClientRect();
    return {
      txt: (el.textContent || "").trim().slice(0, 16),
      bg: s.backgroundColor, color: s.color, radius: s.borderRadius,
      h: Math.round(r.height), ff: s.fontFamily.split(",")[0], fw: s.fontWeight, fs: s.fontSize,
    };
  });
  out.accentSurvey = accentEl;
  out.backgroundColors = [...new Set(accentEl.map((a) => a.bg).filter(Boolean))];
  out.grids = [...document.querySelectorAll('[class*="grid"]')].slice(0, 6).map((el) => {
    const s = cs(el);
    return { cols: s.gridTemplateColumns, gap: s.gap, display: s.display };
  });

  // ---------- Slice-gate asserts (plan Task 1 tests a-d) ----------
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && cs(el).display !== "none";
  };
  // Pill/circle exemption: computed radius >= half of min(w,h) OR explicit rounded-full.
  const isPill = (el, radiusPx) => {
    const r = el.getBoundingClientRect();
    const minDim = Math.min(r.width, r.height);
    return (radiusPx >= minDim / 2 - 0.5) || (el.className && String(el.className).includes("rounded-full"));
  };
  const radiusPx = (el) => {
    const v = parseFloat(cs(el).borderRadius);
    return Number.isFinite(v) ? v : 0;
  };

  // (a) controls: every button/input/select/textarea + role-equivalents sit in
  //     the S5a control radius (lg = 12px) except pills.
  const a = { pass: true, violations: [], checked: 0 };
  const controlSel =
    'button, input, select, textarea, [role="button"], [role="tab"], [role="combobox"], [role="menuitem"]';
  for (const el of document.querySelectorAll(controlSel)) {
    if (!visible(el)) continue;
    a.checked++;
    const rad = radiusPx(el);
    if (isPill(el, rad)) continue; // search pill, badge pills, avatar circles
    if (rad > 12.5) {
      a.pass = false;
      a.violations.push({
        tag: el.tagName, rad: Math.round(rad * 10) / 10,
        cls: String(el.className).slice(0, 64),
        txt: (el.textContent || "").trim().slice(0, 20),
      });
    }
  }

  // (b) cards: surfaces carrying rounded-xl/2xl/3xl with pad-top >= 16px + border/shadow.
  //     S5a radii: cards = 2xl (24px), the Financial Health hero = 3xl (32px) and
  //     must be the ONLY surface above 28px.
  const b = { pass: true, cards: [], violations: [], large: [] };
  for (const el of document.querySelectorAll('[class*="rounded-xl"],[class*="rounded-2xl"],[class*="rounded-3xl"]')) {
    if (!visible(el)) continue;
    const s = cs(el);
    const rad = radiusPx(el);
    if (isPill(el, rad)) continue;
    const padTop = parseFloat(s.paddingTop) || 0;
    const hasBorder = (parseFloat(s.borderTopWidth) || 0) > 0;
    const hasShadow = s.boxShadow !== "none";
    const w = el.getBoundingClientRect().width;
    if (padTop < 16 || (!hasBorder && !hasShadow) || w < 120) continue;
    b.cards.push({
      rad: Math.round(rad * 10) / 10, pad: Math.round(padTop),
      cls: String(el.className).slice(0, 64),
      txt: (el.textContent || "").trim().slice(0, 22),
    });
    if (rad > 28) {
      b.large.push(b.cards[b.cards.length - 1]);
    } else if (rad < 20) {
      b.violations.push(b.cards[b.cards.length - 1]);
    }
  }
  if (b.large.length > 1) {
    b.pass = false;
    b.violations.push(...b.large.slice(1).map((c) => ({ ...c, why: "second >28 card" })));
  }
  if (b.large.length === 1 && !String(b.large[0].cls).includes("rounded-3xl")) {
    b.pass = false;
    b.violations.push({ ...b.large[0], why: "large card lacks rounded-3xl" });
  }
  if (b.violations.length) b.pass = false;

  // (c) figures: on a dense surface, tabular-nums elements at >=24px computed
  //     size must share ONE size per surface.
  //     S5b: the balance block is deliberately larger — it is the single
  //     dominant figure and owns the "settle" register, while the topbar
  //     carries the "glance" one. The clamp is scoped to the dense region
  //     (everything below the balance block's own height) so both registers
  //     are still measured, just separately. A stale single-clamp would
  //     force the dominant figure down to secondary weight.
  const c = { pass: true, sizes: [], figures: [], dominant: null };
  const sizeSet = new Set();
  // The dominant figure lives in the balance block; measure everything below
  // it against one shared size, and the block itself separately.
  const dominantEl = document.querySelector('section[aria-label="Your balance"]');
  const dominantBottom = dominantEl ? dominantEl.getBoundingClientRect().bottom : 0;
  for (const el of document.querySelectorAll('[class*="tabular-nums"]')) {
    if (!visible(el)) continue;
    const fs = parseFloat(cs(el).fontSize) || 0;
    if (fs < 24) continue;
    const box = el.getBoundingClientRect();
    const inDominant = dominantEl && dominantEl.contains(el);
    if (inDominant) {
      c.dominant = { fs: Math.round(fs * 10) / 10, txt: (el.textContent || "").trim().slice(0, 14) };
      continue;
    }
    // Below the balance block only — ignore elements scrolled above it.
    if (box.bottom <= dominantBottom) continue;
    sizeSet.add(Math.round(fs * 10) / 10);
    c.figures.push({ fs: Math.round(fs * 10) / 10, txt: (el.textContent || "").trim().slice(0, 14) });
    if (c.figures.length > 40) break;
  }
  c.sizes = [...sizeSet].sort((x, y) => x - y);
  if (c.sizes.length > 1) c.pass = false;
  // Exactly one dominant figure per surface: a home with two competing
  // large figures has lost its hierarchy. Only meaningful once a dominant
  // figure was actually found — a null dominant (nothing ≥24px inside the
  // balance block yet) must NOT be compared against 0, which would flag
  // every figure as a competitor.
  if (dominantEl && c.dominant && c.figures.filter((f) => f.fs >= c.dominant.fs * 0.8).length > 0) {
    c.pass = false;
  }

  // (d) labels: small muted small-print (<=14.5px) must not be bold (fontWeight <= 500).
  //     Exclusions: interactive ancestors, headings, pills, and colored data chips
  //     (emerald/rose/amber text = data semantics, not label voice).
  const d = { pass: true, violations: [], checked: 0 };
  const labelSel = '[class*="text-muted-foreground"],[class*="text-slate-400"],[class*="text-slate-500"]';
  for (const el of document.querySelectorAll(labelSel)) {
    if (!visible(el)) continue;
    const s = cs(el);
    const fs = parseFloat(s.fontSize) || 0;
    if (fs > 14.5 || fs < 8) continue;
    const txt = (el.textContent || "").trim();
    if (!txt) continue;
    if (isPill(el, radiusPx(el))) continue;
    // S5c section labels are intentionally stronger than nav and are a
    // governed role; the old small-muted-label rule applies to unowned labels.
    if (el.classList.contains("type-section-label")) continue;
    if (el.closest('button, a, input, select, textarea, [role="button"], [role="tab"], [role="combobox"], [role="menuitem"]')) continue;
    if (el.closest('nav[class*="bottom-0"]')) continue; // off-limits mobile chrome
    if (/^[Hh][1-6]$/.test(el.tagName)) continue;
    if (/(text-(emerald|rose|red|green|amber|orange)-)/.test(String(el.className))) continue;
    d.checked++;
    const fw = parseInt(s.fontWeight, 10) || 400;
    if (fw > 500) {
      d.pass = false;
      d.violations.push({
        fw, fs: Math.round(fs * 10) / 10,
        cls: String(el.className).slice(0, 64),
        txt: txt.slice(0, 20),
      });
    }
  }

  // (e) light-world governance: in the light(toggle) column, no element may
  //     compute a hard dark-slate background or border (unconditional Rule-D
  //     literals are the only thing that could render dark there — dark:
  //     variants are inert without the .dark class), card surfaces must
  //     resolve to light token paper, and body ink must flip polarity.
  const e = {
    pass: true,
    world: document.documentElement.classList.contains("dark") ? "dark" : "light(toggle)",
    violations: [],
    checked: 0,
  };
  const isDarkWorld = e.world === "dark";
  const rgbOf = (str) => {
    const m = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(str || "");
    return m ? [+m[1], +m[2], +m[3]] : null;
  };
  const DARK_SLATE = [
    [2, 6, 23], [15, 23, 42], [30, 41, 59], [51, 65, 85], [71, 85, 105],
  ];
  const looksLike = (rgb, targets) => targets.some((t) =>
    Math.abs(rgb[0] - t[0]) <= 2 && Math.abs(rgb[1] - t[1]) <= 2 && Math.abs(rgb[2] - t[2]) <= 2);
  if (!isDarkWorld) {
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      // Floating chart tooltips are intentionally dark overlays in both worlds
      // (DESIGN.md elevation: the chart tooltip is dark by design).
      if (el.closest('[class*="recharts"], [role="tooltip"]')) continue;
      const bg = rgbOf(cs(el).backgroundColor);
      if (bg && looksLike(bg, DARK_SLATE)) {
        e.checked++;
        e.violations.push({ what: "bg", rgb: bg.join(","),
          cls: String(el.className).slice(0, 64), txt: (el.textContent || "").trim().slice(0, 18) });
      } else {
        // Only painted borders count; a 0-width border paints nothing.
        const bw = parseFloat(cs(el).borderTopWidth) || 0;
        if (bw <= 0) continue;
        const bd = rgbOf(cs(el).borderColor);
        if (bd && looksLike(bd, DARK_SLATE)) {
          e.checked++;
          e.violations.push({ what: "border", rgb: bd.join(","),
            cls: String(el.className).slice(0, 64), txt: (el.textContent || "").trim().slice(0, 18) });
        }
      }
      if (e.violations.length >= 8) break;
    }
    // Card surfaces (padTop >= 16 + border/shadow + width >= 120, same filter
    // as (b)) must resolve to light paper in the light world — token cores,
    // never literals.
    for (const el of document.querySelectorAll('[class*="rounded-2xl"],[class*="rounded-xl"]')) {
      if (!visible(el)) continue;
      const s = cs(el);
      if ((parseFloat(s.paddingTop) || 0) < 16) continue;
      if (!((parseFloat(s.borderTopWidth) || 0) > 0 || s.boxShadow !== "none")) continue;
      if (el.getBoundingClientRect().width < 120) continue;
      const bg = rgbOf(s.backgroundColor);
      if (!bg) continue;
      const lum = bg[0] + bg[1] + bg[2];
      if (lum < 560) {
        e.checked++;
        e.violations.push({ what: "dark-surface-in-light", rgb: bg.join(","), lum,
          cls: String(el.className).slice(0, 64), txt: (el.textContent || "").trim().slice(0, 18) });
        if (e.violations.length >= 8) break;
      }
    }
  }
  // Body ink polarity: light world => dark ink, dark world => light ink.
  const bodyColor = rgbOf(bs.color);
  if (bodyColor) {
    const bodyLum = bodyColor[0] + bodyColor[1] + bodyColor[2];
    e.bodyInk = { rgb: bodyColor.join(","), lum: bodyLum, world: e.world };
    if ((isDarkWorld && bodyLum < 300) || (!isDarkWorld && bodyLum > 500)) {
      e.pass = false;
      e.violations.push({ what: "body-ink-polarity", rgb: bodyColor.join(","), lum: bodyLum });
    }
  }
  if (e.violations.length) e.pass = false;

  // (f) zero raw emoji rendered as category identity. Pictographic blocks only
  //     (1F000+); the 2600-27BF dingbat block holds legitimate status glyphs
  //     like the income calendar's "✓" paid marker, which are not category
  //     identity and stay allowed. Slice 4 gate: no emoji, both themes.
  const f = { pass: true, checked: 0, found: [] };
  {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      // Only rendered text counts. The RSC flight payload (`self.__next_f.push`)
      // legitimately still carries the legacy emoji strings — that is the whole
      // point of a read-time migration — but it lives in a <script> and is
      // never painted.
      const el = n.parentElement;
      if (!el) continue;
      const tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE") continue;
      const t = n.nodeValue || "";
      const pictos = [...t].filter((c) => c.codePointAt(0) > 0x1F000);
      if (pictos.length) {
        f.checked++;
        f.found.push({ glyphs: pictos.join(""), near: (el.textContent || t).trim().replace(/\s+/g, " ").slice(0, 28) });
        if (f.found.length >= 10) break;
      }
    }
    if (f.found.length) f.pass = false;
  }

  // (h) S5c H1 contract: every visible page H1 uses the Bricolage-backed
  //     page-title role. This catches a font that is present in the document
  //     but not actually applied to the heading.
  const h = { pass: true, checked: 0, headings: [], violations: [] };
  for (const heading of document.querySelectorAll("h1")) {
    if (!visible(heading)) continue;
    const style = cs(heading);
    h.checked++;
    const family = style.fontFamily.toLowerCase();
    const classes = String(heading.className);
    const record = { text: (heading.textContent || "").trim().slice(0, 40), family: style.fontFamily.split(",")[0], classes };
    h.headings.push(record);
    if (!family.includes("bricolage") || !classes.includes("type-page-title")) {
      h.pass = false;
      h.violations.push(record);
    }
  }
  if (h.checked === 0) {
    h.none = true;
  }

  // (i) S5c figure roles, rendered. The source detector proves every
  //     <CurrencyDisplay> DECLARES a role; this proves the declaration
  //     actually resolves to the intended face at runtime. Catches a marker
  //     that is present in the class list but overridden by a later utility,
  //     and catches a figure that still inherits the identity face.
  //
  //     Currency is Instrument at every scale. A Bricolage hero beside
  //     Instrument row figures renders as two different apps on one screen,
  //     so assert (j) below guards the whole page for that incoherence rather
  //     than trusting each role to be individually correct.
  const i = { pass: true, checked: 0, faces: {}, violations: [] };
  {
    const EXPECTED = {
      "type-ledger": "instrument",
      "figure-inline": "instrument",
      "type-measurement": "martian",
    };
    for (const fig of document.querySelectorAll("span")) {
      const declared = ["type-ledger", "figure-inline", "type-measurement"].find((role) =>
        fig.classList.contains(role)
      );
      if (!declared) continue;
      // Only currency figures are marked; skip non-figure text that borrows a role.
      const text = (fig.textContent || "").trim();
      if (!text || !/[0-9]/.test(text)) continue;
      if (!visible(fig)) continue;
      i.checked++;
      const family = cs(fig).fontFamily.toLowerCase();
      const want = EXPECTED[declared];
      const got = family.includes("martian") ? "martian" : family.includes("bricolage") ? "bricolage" : "instrument";
      i.faces[declared + "->" + got] = (i.faces[declared + "->" + got] || 0) + 1;
      if (got !== want) {
        i.pass = false;
        i.violations.push({ declared, want, got, text: text.slice(0, 24) });
      }
    }
    if (i.checked === 0) {
      i.pass = false;
      i.violations.push({ why: "no marked figures rendered" });
    }
  }

  // (j) face coherence across a single surface. Every role can be individually
  //     correct and the page still read as two apps: that is exactly what a
  //     Bricolage currency hero beside Instrument row figures produced. This
  //     asserts the page speaks ONE currency voice, so the failure is caught
  //     where it is actually perceived rather than per component.
  const j = { pass: true, currencyFaces: {}, otherFaces: {}, violations: [] };
  {
    const MONEY = /[₱P]|PHP/;
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length > 0) continue; // leaf text nodes only
      if (!visible(el)) continue;
      const text = (el.textContent || "").trim();
      if (!text || !/\d/.test(text)) continue;
      const family = cs(el).fontFamily.toLowerCase();
      const face = family.includes("martian")
        ? "martian"
        : family.includes("bricolage")
          ? "bricolage"
          : "instrument";
      const isMoney = MONEY.test(text);
      if (isMoney) j.currencyFaces[face] = (j.currencyFaces[face] || 0) + 1;
      else j.otherFaces[face] = (j.otherFaces[face] || 0) + 1;
      // Money never renders in the identity or measurement face. A peso
      // amount in Bricolage next to Instrument pesos is the "two apps" bug.
      if (isMoney && face !== "instrument") {
        j.pass = false;
        j.violations.push({ text: text.slice(0, 24), face });
      }
    }
    const moneyTotal = Object.values(j.currencyFaces).reduce((a, b) => a + b, 0);
    if (moneyTotal === 0) {
      j.pass = false;
      j.violations.push({ why: "no currency text found to check" });
    }
  }

  // (g) shell navigation: exactly ONE nav at any width. The S5b shell removed
  //     the left sidebar and moved desktop nav above the lg breakpoint (1024),
  //     so the old 816px "desktop" gate column renders a tablet layout and
  //     never exercises the top-nav. This assert is width-aware: at >=1024 the
  //     grouped top-nav must be visible and the bottom-nav hidden; below it the
  //     reverse. Both the old sidebar and the fake breadcrumb must be gone at
  //     every width.
  const g = { pass: true, width: innerWidth, tier: innerWidth >= 1024 ? "desktop" : "below-lg", topNav: false, bottomNav: false, links: 0, groups: [] };
  {
    const top = document.querySelector('nav[aria-label="Primary navigation"], nav[aria-label="Primary"]');
    const bottom = document.querySelector("nav.fixed.bottom-0");
    const topBox = top ? top.getBoundingClientRect() : null;
    // Visibility means "painted", measured identically for both navs. The top
    // nav computes to `flex` and the bottom nav to `block` (its inner div is
    // the flex row), so measuring one by geometry and the other by display
    // keyword let the two disagree about what "visible" means.
    const shown = (el) => {
      if (!el || getComputedStyle(el).display === "none") return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    };
    g.topNav = shown(top);
    g.bottomNav = shown(bottom);
    g.links = top ? top.querySelectorAll("a").length : 0;
    const linkEls = top ? [...top.querySelectorAll("a")] : [];
    const groupEls = top ? [...top.querySelectorAll("span")].filter((s) => s.textContent.trim()) : [];
    g.groups = groupEls.map((s) => s.textContent.trim());
    g.navRole = linkEls.length > 0 && linkEls.every((el) => el.classList.contains("type-nav"));
    g.groupRole = groupEls.every((el) => el.classList.contains("type-nav-group"));
    // The legacy sidebar is gone (S5b deleted sidebar.tsx). Detect it by its
    // distinctive signature — a sticky full-height flex column with a right
    // border — NOT a bare <aside>, because semantic <aside> regions (e.g. the
    // attention strip) are legitimate content, not chrome.
    const hasSidebar = !!document.querySelector('aside.h-screen, aside[class*="h-screen"]');
    const hasBreadcrumb = /Workspace\s*›?\s*Overview/.test(document.body.innerText);
    g.sidebarGone = !hasSidebar;
    g.breadcrumbGone = !hasBreadcrumb;
    if (hasSidebar) g.pass = false;
    if (hasBreadcrumb) g.pass = false;
    // Exactly one nav visible.
    if (g.topNav && g.bottomNav) g.pass = false;
    if (!g.topNav && !g.bottomNav) g.pass = false;
    // The desktop nav must sit BELOW the topbar, never on top of it. This is
    // the collision a screenshot showed: nav row and topbar occupying the same
    // band. Assert (g) checked exclusivity but not geometry, so a stacked shell
    // passed green.
    const headerEl = document.querySelector("header");
    if (g.topNav && topBox && headerEl) {
      const hb = headerEl.getBoundingClientRect();
      g.headerBox = { top: Math.round(hb.top), bottom: Math.round(hb.bottom) };
      g.navBox = { top: Math.round(topBox.top), bottom: Math.round(topBox.bottom) };
      g.overlap = topBox.top < hb.bottom && topBox.bottom > hb.top;
      if (g.overlap) g.pass = false;
    }
    // Nothing may push the page wider than the viewport at any tier.
    g.hScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    if (g.hScroll) g.pass = false;
    // Tier expectations: top-nav (with all destinations) only at lg+.
    if (g.tier === "desktop") {
      if (!g.topNav || g.bottomNav) g.pass = false;
      if (g.links !== 9) g.pass = false;
       if (!g.navRole || !g.groupRole) g.pass = false;
    } else {
      if (!g.bottomNav || g.topNav) g.pass = false;
    }
  }

  out.asserts = {
    a: { pass: a.pass, checked: a.checked, violations: a.violations.slice(0, 12), count: a.violations.length },
    b: { pass: b.pass, cards: b.cards.length, large: b.large, violations: b.violations.slice(0, 12), count: b.violations.length },
    c: { pass: c.pass, sizes: c.sizes, dominant: c.dominant, figures: c.figures.slice(0, 16), count: c.figures.length },
    d: { pass: d.pass, checked: d.checked, violations: d.violations.slice(0, 12), count: d.violations.length },
    e: { pass: e.pass, world: e.world, checked: e.checked, bodyInk: e.bodyInk, violations: e.violations.slice(0, 8), count: e.violations.length },
    f: { pass: f.pass, checked: f.checked, found: f.found },
    g: { pass: g.pass, width: g.width, tier: g.tier, topNav: g.topNav, bottomNav: g.bottomNav, links: g.links, groups: g.groups, navRole: g.navRole, groupRole: g.groupRole, headerBox: g.headerBox, navBox: g.navBox, overlap: g.overlap, hScroll: g.hScroll, sidebarGone: g.sidebarGone, breadcrumbGone: g.breadcrumbGone },
    h: { pass: h.pass, checked: h.checked, none: h.none || false, headings: h.headings, violations: h.violations },
    i: { pass: i.pass, checked: i.checked, faces: i.faces, violations: i.violations },
    j: { pass: j.pass, currencyFaces: j.currencyFaces, otherFaces: j.otherFaces, violations: j.violations },
     allPass: a.pass && b.pass && c.pass && d.pass && e.pass && f.pass && g.pass && h.pass && i.pass && j.pass,
  };
  return out;
})()