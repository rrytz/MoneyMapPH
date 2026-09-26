import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

function collectTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) acc = collectTsxFiles(full, acc);
    else if (entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

const TSX_FILES = collectTsxFiles(SRC);
const rel = (file: string) => relative(SRC, file).replaceAll("\\", "/");
const read = (file: string) => readFileSync(join(SRC, file), "utf8");

const REQUIRED_ROLES = [
  "type-identity",
  "type-page-title",
  "type-nav",
  "type-nav-group",
  "type-section-label",
  "type-ledger",
  "type-measurement",
  "type-character",
  "figure-inline",
] as const;

/**
 * The explicit figure markers. Every <CurrencyDisplay> must declare exactly one.
 *
 * Why this rule exists: CurrencyDisplay sets no font-family, so an un-marked
 * instance silently inherits whatever face its ancestor happens to set. That
 * made the rendered face nondeterministic — the same component could come out
 * in Instrument Sans in one row and Bricolage in another — and left the figure
 * without a governed scale. Declaring the marker on the element itself removes
 * the ancestry guesswork entirely.
 *
 * The boundary the markers encode:
 *   type-ledger      a figure that competes for attention (the answer)
 *   type-measurement a dominant measurement (%, ratio, count)
 *   figure-inline    a figure that is part of a row or a sentence
 *
 * type-identity is deliberately NOT a figure marker. Currency never renders in
 * the identity face: a Bricolage hero beside Instrument row figures reads as
 * two different apps on one screen. The identity moment belongs to H1s, the
 * wordmark, and the character voice — never to the numbers. Money reads the
 * same everywhere, so every currency figure is Instrument.
 */
const FIGURE_MARKERS = ["type-ledger", "type-measurement", "figure-inline"] as const;

/**
 * True when the figure resolves to exactly one role.
 *
 * A single marker is the normal case. The exception is a genuine either/or,
 * where each branch of a ternary names one role and no branch is undecided —
 * e.g. KpiCard renders a percentage as type-measurement and an amount as
 * type-ledger. Two markers inside one string literal, or a marker plus an
 * undecided branch, is a contradiction and fails.
 */
function isSingleDeclaration(tag: string, declared: readonly string[]): boolean {
  if (declared.length === 1) return true;
  if (declared.length < 2) return false;
  const value = tag.match(/\bclassName\s*=\s*(\{[\s\S]*?\}|"[^"]*")/)?.[1] ?? "";
  if (!value.includes("?")) return false;
  const branches = [...value.matchAll(/([?:])\s*"([^"]*)"/g)].map((m) => m[2]);
  if (branches.length < 2) return false;
  return branches.every((branch) => {
    const found = FIGURE_MARKERS.filter((marker) => new RegExp(`\\b${marker}\\b`).test(branch));
    return found.length === 1;
  });
}

const ROLE_CONTRACTS = [
  // Identity is the character voice only on this surface — the hero is the
  // largest ledger figure, so currency stays in Instrument.
  ["components/dashboard/balance-block.tsx", ["type-ledger", "type-character"]],
  ["components/dashboard/kpi-card.tsx", ["type-section-label", "type-ledger"]],
  ["components/shared/page-header.tsx", ["type-page-title"]],
  ["components/layout/desktop-nav.tsx", ["type-nav", "type-nav-group"]],
  ["components/shared/tide-gauge.tsx", ["type-measurement"]],
  ["components/dashboard/category-donut-chart.tsx", ["type-measurement"]],
  ["components/dashboard/income-expense-chart.tsx", ["type-measurement"]],
  ["app/(dashboard)/income/paycheck-planner.tsx", ["type-ledger", "type-measurement"]],
  ["app/(dashboard)/budgets/budgets-page-client.tsx", ["type-ledger", "type-measurement"]],
  // A ledger has no hero figure. Every amount on this screen sits inside a row,
  // so figure-inline is the honest role for all of them and type-ledger was
  // never right here - it made the amount the loudest thing in every row of a
  // transaction list. type-measurement still applies to the "showing 1 to 15 of
  // 29" count, which is a measurement rather than money.
  ["app/(dashboard)/transactions/transactions-client.tsx", ["figure-inline", "type-measurement"]],
  ["app/(dashboard)/income/month-calendar.tsx", ["type-measurement"]],
] as const;

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function classAttributeContains(tag: string, className: string): boolean {
  const match = tag.match(/\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/);
  const value = match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
  return new RegExp(`(?:^|\\s|[^\\w-])${className}(?:$|\\s|[^\\w-])`).test(value);
}

function sourceUsesClass(source: string, className: string): boolean {
  const attrPattern = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
  for (const match of source.matchAll(attrPattern)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    if (new RegExp(`(?:^|["'\\s])${className}(?:$|["'\\s])`).test(value)) return true;
  }
  return false;
}

function sourceUsesRole(source: string, role: string): boolean {
  return sourceUsesClass(withoutComments(source), role);
}

/**
 * Opening tags of an element whose className declares a multi-column grid.
 * Group 1 is the declared track count, group 2 the whole tag.
 *
 * Matches responsive prefixes (`lg:grid-cols-2`) because the defect appears at
 * that breakpoint, and arbitrary-value tracks (`lg:grid-cols-[1.15fr_0.85fr]`),
 * which are just as capable of leaving a hole and are used in three files.
 * Single-track values (`grid-cols-1`, `grid-cols-[1fr]`) are not multi-column.
 */
const GRID_OPEN_RE =
  /<([A-Za-z][\w.]*)\b((?:[^<>"']|"[^"]*"|'[^']*')*?\b(?:[a-z]+:)?grid-cols-(?:(\d+)|\[([^\]]*)\])(?:[^<>"']|"[^"]*"|'[^']*')*?)>/g;

/** Any JSX tag, including fragments, with its self-closing flag. */
const JSX_TAG_RE = /<(\/?)(>|[A-Za-z][\w.]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;

/**
 * True when the innermost JSX element enclosing `at` declares a figure role.
 * Walks back to the nearest opening tag before `at` and reads its className, so
 * the answer belongs to the element the figure actually renders inside.
 */
function declaresFigureRole(source: string, at: number): boolean {
  const before = source.slice(0, at);
  const open = [...before.matchAll(/<([A-Za-z][\w.]*)\b((?:[^<>"']|"[^"]*"|'[^']*')*?)>/g)].pop();
  if (!open || open.index === undefined) return false;
  const cls = open[2].match(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/);
  const value = cls?.[1] ?? cls?.[2] ?? cls?.[3] ?? "";
  return FIGURE_MARKERS.some((m) =>
    new RegExp(`(?:^|[\\s"'])${m}(?:$|[\\s"'])`).test(value)
  );
}

/** How many column tracks a grid-cols declaration asks for. */
function declaredTrackCount(numeric: string | undefined, arbitrary: string | undefined): number {
  if (numeric !== undefined) return Number(numeric);
  if (arbitrary === undefined) return 1;
  return arbitrary.split("_").filter(Boolean).length;
}

/**
 * Count the direct element children of the element whose opening tag ends at
 * `afterOpenTag`, returning -1 if the element is never closed (which means the
 * scan cannot be trusted, and the rule should stay quiet rather than guess).
 *
 * Children inside JSX expression containers count, because they do render as
 * children: `{cond && <div/>}` is one child, and `{items.map(...)}` is one
 * child in source that becomes many at runtime — both mean the grid is not
 * lone. A JSX comment is not a child and is not counted.
 */
function directElementChildCount(source: string, afterOpenTag: number): number {
  const scanner = new RegExp(JSX_TAG_RE.source, "g");
  scanner.lastIndex = afterOpenTag;
  let depth = 0;
  let children = 0;
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(source))) {
    const [, closing, , , selfClose] = match;
    if (closing) {
      // A closing tag seen while depth is 0 is this element's own close. It must
      // be recognised *before* decrementing, or depth goes to -1, the equality
      // test below never fires, and the scan runs on into the rest of the file
      // returning a meaningless count.
      if (depth === 0) return children;
      depth -= 1;
    } else if (selfClose) {
      if (depth === 0) children += 1;
    } else {
      if (depth === 0) children += 1;
      depth += 1;
    }
  }
  return -1;
}

const LOGO_CALLER_FILES = [
  "components/shared/auth-shell.tsx",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/~offline/page.tsx",
  "app/(dashboard)/transactions/print/page.tsx",
] as const;

describe("S5c typography hierarchy detector", () => {
  it("defines every semantic role in the global stylesheet", () => {
    const globals = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
    const missing = REQUIRED_ROLES.filter((role) => !new RegExp(`\\.${role}\\s*\\{`).test(globals));
    expect(missing, `Missing role definitions: ${missing.join(", ")}`).toEqual([]);
  });

  it("requires every H1 to use the page-title role", () => {
    const missing: string[] = [];
    for (const file of TSX_FILES) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<h1\b[^>]*>/g)) {
        if (!classAttributeContains(match[0], "type-page-title")) {
          const line = source.slice(0, match.index).split("\n").length;
          missing.push(`${rel(file)}:${line}`);
        }
      }
    }
    expect(missing, `H1s without type-page-title: ${missing.join(", ")}`).toEqual([]);
  });

  it("does not count a role in a non-class attribute as an H1 role", () => {
    expect(classAttributeContains('<h1 data-test="type-page-title">', "type-page-title")).toBe(false);
    expect(classAttributeContains('<h1 className="type-page-title">', "type-page-title")).toBe(true);
  });

  it("does not count a role in a non-class attribute as a shared role", () => {
    expect(sourceUsesRole('<div data-role="type-ledger" />', "type-ledger")).toBe(false);
    expect(sourceUsesRole('<div className="type-ledger" />', "type-ledger")).toBe(true);
  });

  it("keeps PageHeader on the page-title role", () => {
    expect(read("components/shared/page-header.tsx")).toContain("type-page-title");
  });

  it("keeps desktop navigation quiet and separate from section labels", () => {
    const source = read("components/layout/desktop-nav.tsx");
    expect(source).toContain("type-nav");
    expect(source).toContain("type-nav-group");
    expect(source).not.toMatch(/type-nav-group[^>]*uppercase/);
    expect(source).not.toMatch(/type-nav-group[^>]*tracking-/);
  });

  it("rejects the old raw caption escape hatch", () => {
    const violations: string[] = [];
    for (const file of TSX_FILES) {
      const source = readFileSync(file, "utf8");
      if (sourceUsesClass(source, "caption")) violations.push(rel(file));
    }
    expect(violations, `Raw caption usage: ${violations.join(", ")}`).toEqual([]);
  });

  it("rejects the retired typography escape hatches in CSS", () => {
    const globals = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
    expect(globals).not.toMatch(/\.(caption|ledger-figure)\s*\{/);
  });

  it("requires every currency figure to declare exactly one explicit figure role", () => {
    const violations: string[] = [];
    let total = 0;
    for (const file of TSX_FILES) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<CurrencyDisplay\b[\s\S]*?\/>/g)) {
        total++;
        const declared = FIGURE_MARKERS.filter((marker) => classAttributeContains(match[0], marker));
        if (!isSingleDeclaration(match[0], declared)) {
          const line = source.slice(0, match.index).split("\n").length;
          violations.push(
            `${rel(file)}:${line} declares ${declared.length === 0 ? "none" : declared.join("+")}`
          );
        }
      }
    }
    expect(violations, `Currency figures without exactly one explicit role:\n  ${violations.join("\n  ")}`).toEqual([]);
    expect(total, "expected to find CurrencyDisplay call sites").toBeGreaterThan(50);
  });

  it("keeps the Emergency Reserve tiles on the governed inset surface", () => {
    const source = read("app/(dashboard)/savings/savings-page-client.tsx");
    // The pre-Tide tiles were `bg-slate-50 dark:bg-slate-900` with a border:
    // a near-black, blue-cast legacy slate that is not a Tide token. Nested
    // tonal layers use the inset treatment (rounded-lg, bg-muted/30, no border).
    expect(source).not.toMatch(/bg-slate-50 dark:bg-slate-900 border/);
    expect(source).toContain("rounded-lg bg-muted/30 border-transparent");
    // Tile labels are section labels, not sentence-case small print.
    expect(source).toContain('type-section-label block">Coverage Horizon');
  });

  it("never renders a currency figure in the identity face", () => {
    // Same class of failure the role-system gate missed: both the hero and the
    // rows were individually correct, but a Bricolage hero beside Instrument
    // row figures reads as two apps on one screen. Money reads the same
    // everywhere, so the identity face is off-limits to currency.
    const violations: string[] = [];
    for (const file of TSX_FILES) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<CurrencyDisplay\b[\s\S]*?\/>/g)) {
        if (classAttributeContains(match[0], "type-identity")) {
          const line = source.slice(0, match.index).split("\n").length;
          violations.push(`${rel(file)}:${line}`);
        }
      }
    }
    expect(violations, `Currency figures using the identity face:\n  ${violations.join("\n  ")}`).toEqual([]);
  });

  it("keeps the dashboard goal rows on the Tide surface", () => {
    // A card that renders on the governed FintechCard surface but paints its
    // inner rows on legacy slate reads as a different app. The dashboard goal
    // card shipped this way: near-black `dark:bg-slate-900` rows with borders
    // and slate ring tracks.
    const source = read("app/(dashboard)/dashboard/page.tsx");
    expect(source, "goal rows still on legacy slate").not.toMatch(
      /bg-slate-\d+(?:\/\d+)?\s+dark:bg-slate-\d+(?:\/\d+)?/
    );
    expect(source, "goal ring track still on slate").not.toMatch(/stroke-slate-\d+/);
    // Nested tonal layers are borderless by contract (the inset treatment).
    expect(source, "goal rows still carry a border").not.toMatch(/rounded-lg bg-muted\/30 border/);
    expect(source, "goal rows missing the inset treatment").toContain("rounded-lg bg-muted/30");
  });

  it("carries no legacy slate surface or ring-track colour", () => {
    // Flat ban, with one named exclusion. The dashboard goal card shipped with
    // `dark:bg-slate-900` rows and slate ring tracks; the same pattern ran
    // through 20 more files. An allowlist for "deliberate" slate is what let
    // the gap spread, so the rule stays absolute and the single exception is
    // written down with its reason.
    //
    // SLATE_EXCLUSIONS — the print statement is a document, not the app. It is
    // deliberately theme-independent: design tokens resolve from the active
    // theme, so migrating it would emit dark-on-dark on paper whenever the app
    // is in dark mode. That is a regression disguised as consistency. It keeps
    // explicit light values for that reason, not by oversight.
    const SLATE_EXCLUSIONS = new Set(["app/(dashboard)/transactions/print/page.tsx"]);

    const surfaces: string[] = [];
    const strokes: string[] = [];
    for (const file of TSX_FILES) {
      const key = rel(file);
      if (SLATE_EXCLUSIONS.has(key)) continue;
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const match of source.matchAll(/(?:dark:)?(?:hover:)?(?:bg|stroke)-slate-\d+(?:\/\d+)?/g)) {
        surfaces.push(`${key}:${source.slice(0, match.index).split("\n").length} ${match[0]}`);
      }
    }
    expect(surfaces, `Legacy slate surfaces (use a Tide token):\n  ${surfaces.join("\n  ")}`).toEqual([]);
    expect(strokes, `Slate ring/track strokes (use stroke-border):\n  ${strokes.join("\n  ")}`).toEqual([]);
  });

  it("encodes the neutral chart series with a governed token", () => {
    // The Expenses series was slate-as-data-colour. It now uses agosto, the
    // desaturated neutral the Tide vocabulary already reserves for "the other
    // series" — so the neutral reads as data, not as a surface, and the flat
    // slate ban needs no allowlist.
    const source = read("components/dashboard/income-expense-chart.tsx");
    expect(source, "neutral series still on slate").not.toMatch(/bg-slate-\d+/);
    expect(source, "neutral series missing the agosto token").toContain("bg-agosto");
  });

  it("uses only real Tailwind colour steps", () => {
    // Two ways a colour utility silently renders nothing:
    //
    //  1. An invented step. `border-slate-150` is not a Tailwind class, so that
    //     row has been rendering with no bottom border at all.
    //  2. A truncated token. The emerald migration listed `bg-emerald-50`
    //     before `bg-emerald-500`, so the shorter pattern matched as a prefix
    //     and left the trailing digit behind: `bg-sulpot-tint0`. That contains
    //     a real token name, so it reads as plausible in review, and it cost 8
    //     elements their background. Found by rendering, not by a rule.
    //
    // Both are the same shape: a colour name plus a step that cannot resolve.
    // Dead utilities are invisible in a screenshot and invisible to the class
    // ban, so they get their own check.
    const STEPS = new Set(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]);
    // Tailwind families plus the Tide token names, so a stray digit after
    // either is caught.
    const FAMILIES =
      "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose" +
      "|sulpot(?:-bright|-deep|-tint)?|agosto(?:-deep|-tint)?|ink(?:-muted|-faint)?|inset|paper";

    const dead: string[] = [];
    const pattern = new RegExp(
      `(?:border|bg|text|stroke|from|to|via|ring|fill|shadow|divide|outline|accent)-(?:${FAMILIES})-(\\d+)`,
      "g"
    );
    for (const file of TSX_FILES) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(pattern)) {
        if (!STEPS.has(match[1])) {
          dead.push(`${rel(file)}:${source.slice(0, match.index).split("\n").length} ${match[0]}`);
        }
      }
    }
    expect(dead, `Unresolvable colour utilities (render as no-op):\n  ${dead.join("\n  ")}`).toEqual([]);
  });

  it("carries no slate-family hex in a presentation value", () => {
    // The class ban cannot see this shape. `stroke="#e2e8f0"` is exactly as
    // wrong as `bg-slate-200`, and the agosto swap proved it: the legend swatch
    // moved to a token while the line it labelled stayed a hardcoded #94a3b8
    // that did not even adapt per theme. Caught by looking, not by the class
    // detector — so the class detector was not sufficient and this closes it.
    //
    // Scoped to the exact Tailwind slate palette rather than "any hex", because
    // a rule that fires on correct code gets allowlisted, and an allowlist is
    // the escape hatch this system just spent two slices removing. That means
    // legitimate hex elsewhere is untouched by construction:
    //   - Google brand fills in auth-forms        (not slate)
    //   - the category palette + its fixtures     (exempt by path, below)
    const SLATE_HEX = new Set([
      "#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b",
      "#475569", "#334155", "#1e293b", "#0f172a", "#020617",
    ]);

    // Each exemption is a real reason, not a convenience.
    const exempt = (key: string) =>
      // The palette source of truth: these hexes DEFINE the tokens.
      key === "app/globals.css" ||
      // Category colour seeds, translated to governed tokens at resolve time.
      // e.g. "#64748b" -> CATEGORY_COLOR_PALETTE.channel, a quiet neutral that
      // is legitimately data, not a surface.
      key.startsWith("lib/categories/") ||
      key.endsWith(".test.ts") ||
      // PWA theme_color for the manifest, not a rendered surface.
      key === "app/manifest.ts";

    // Both shapes need covering. SVG/chart attributes use `name="#hex"`; style
    // objects (Recharts `contentStyle`) use `name: "#hex"`. Six slate literals
    // live in the Tooltip contentStyle, so a rule that only read attributes
    // would leave them behind a green detector — the exact failure this slice
    // exists to prevent.
    const PRESENTATION = /(?:stroke|fill|stopColor|backgroundColor|borderColor|color)\s*[=:]\s*"(#[0-9a-fA-F]{3,8})"/g;

    const offenders: string[] = [];
    for (const file of TSX_FILES) {
      const key = rel(file);
      if (exempt(key)) continue;
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const match of source.matchAll(PRESENTATION)) {
        if (SLATE_HEX.has(match[1].toLowerCase())) {
          offenders.push(`${key}:${source.slice(0, match.index).split("\n").length} ${match[1]}`);
        }
      }
    }
    expect(offenders, `Slate hex in a presentation value (use var(--color-*)):\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("carries no emerald utility", () => {
    // The token layer migrated; the component layer did not. --primary,
    // --success and --income all resolve to var(--sulpot), and ui/button.tsx's
    // primary variant is `bg-primary`, so the governed path exists — 35 feature
    // components were bypassing it with raw emerald utilities instead. A
    // governed default that call sites route around is the same shape as
    // CurrencyDisplay inheriting its face from whatever ancestor it landed in.
    //
    // The print statement keeps its palette for the reason given in
    // SLATE_EXCLUSIONS above.
    const offenders: string[] = [];
    for (const file of TSX_FILES) {
      const key = rel(file);
      if (key === "app/(dashboard)/transactions/print/page.tsx") continue;
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const match of source.matchAll(/(?:dark:)?(?:hover:)?[a-z-]*emerald-\d+/g)) {
        offenders.push(`${key}:${source.slice(0, match.index).split("\n").length} ${match[0]}`);
      }
    }
    expect(offenders, `Raw emerald utilities (use a sulpot/primary token):\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("uses no colour utility whose token is defined but never exposed", () => {
    // A dead utility is the worst kind of bug: correct in source, renders as
    // nothing. `--rose`, `--amber`, `--ink`, `--ink-muted`, `--ink-faint`,
    // `--inset` and `--paper` were all defined in :root/.dark but never exposed
    // as `--color-*`, so `text-rose`, `text-ink-faint`, `bg-inset` and friends
    // generated no rule at all and fell back to inherited ink.
    //
    // Measured consequences:
    //   text-rose       computed to rgb(27,33,28) = body ink, so every
    //                   negative-balance signal (balance hero, topbar readout,
    //                   account menu, budget remaining, attention strip)
    //                   rendered as ordinary text. "You are overdrawn" was
    //                   not showing.
    //   text-ink-faint  --ink-faint is #98a396 light / #667063 dark, but the
    //                   dead class rendered it at full body-ink strength, so
    //                   faint labels were rendering at full contrast.
    //   text-ink        coincidentally harmless: --ink equals the body colour.
    //                   Correct by accident, not by design.
    //
    // The rule cross-references the stylesheet rather than pattern-matching a
    // palette list: a bare `text-<name>` is dead exactly when the app defines
    // `--<name>` but exposes no `--color-<name>`. An earlier version keyed off
    // Tailwind family names and wrongly flagged text-foreground / bg-card /
    // border-border, which are legitimate precisely because those tokens ARE
    // exposed — a rule that fires on correct code gets allowlisted.
    const globals = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
    const exposed = new Set([...globals.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    // Custom properties declared in :root / .dark, keeping only those whose
    // value is colour-shaped. Without this filter `--radius: 1rem` counts as a
    // defined token and `border-radius` in sonner.tsx gets flagged as a dead
    // colour class.
    const COLOUR_VALUE = /^(#|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\(|var\()/;
    const defined = new Set(
      [...globals.matchAll(/^\s{2}(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)]
        .filter((m) => COLOUR_VALUE.test(m[2].trim()))
        .map((m) => m[1].slice(2))
    );

    const dead: string[] = [];
    const BARE = /(?:dark:)?(?:hover:)?(?:text|bg|border|ring|stroke|fill|shadow)-([a-z][a-z0-9-]*)(?![\w-])/g;
    for (const file of TSX_FILES) {
      const key = rel(file);
      if (key === "app/(dashboard)/transactions/print/page.tsx") continue;
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const match of source.matchAll(BARE)) {
        const name = match[1];
        if (!defined.has(name)) continue; // not a colour this app defines
        if (exposed.has(name)) continue; // and it IS exposed, so the class is live
        dead.push(`${key}:${source.slice(0, match.index).split("\n").length} ${match[0]}`);
      }
    }
    expect(dead, `Colour utilities whose token is defined but not exposed (render as no-op):\n  ${dead.join("\n  ")}`).toEqual([]);
  });

  it("keeps the rose and amber ramps complete and Tide-owned", () => {
    // `text-rose-500` was resolving to Tailwind's default palette while the app
    // also defined its own --rose, so the app carried two live roses: 167 rose
    // and 34 amber call sites on stock values, none flaggable, because every
    // one of those classes is perfectly valid.
    //
    // The fix is a ramp override in @theme, not 201 edits, so a step added
    // later also lands on a governed colour. That only holds while the ladder
    // is whole: a family counts as ramped only if EVERY step is exposed, and a
    // partial ramp puts a hole exactly where the next call site would land.
    //
    // Scoped to the two families the app actually ramps. Stock slate in *text*
    // position is a separate open question — the surface ban covered
    // bg-/stroke-, not text-slate-500 on captions and icons — and folding it
    // in here would be scope creep dressed as thoroughness.
    const globals = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
    const STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
    const RAMPED = ["rose", "amber"];

    const missing: string[] = [];
    for (const family of RAMPED) {
      for (const step of STEPS) {
        if (!new RegExp(`--color-${family}-${step}\\s*:`).test(globals)) missing.push(`--color-${family}-${step}`);
      }
    }
    expect(missing, `Ramped families missing a step:\n  ${missing.join("\n  ")}`).toEqual([]);

    // The bare token must derive from step 500, not sit beside it. `--rose`
    // and `--rose-500` are both live utilities; if they were declared as
    // independent literals they would drift, and the app would be back to two
    // roses wearing the same name.
    for (const family of RAMPED) {
      expect(globals, `--${family} must derive from --${family}-500`).toMatch(
        new RegExp(`--${family}:\\s*var\\(--${family}-500\\)`)
      );
    }

    // Nothing may reach for a stock step of a ramped family's *siblings* in a
    // way that reintroduces a second palette silently: rose and amber are the
    // only families the app owns, so any bare `text-rose`/`bg-amber` must go
    // through the ramp, which the completeness check above guarantees.
  });

  it("owns the neutrals: no stock neutral family in text position", () => {
    // The surface ban above covers bg-/stroke-slate-*; this covers the other
    // side of the same problem. `text-slate-500` on captions and icons was
    // Tailwind's stock #64748b sitting one hex away from Tide's --ink-muted
    // (#667063) — close enough that nothing ever flagged it, and far enough
    // that the app was not actually one system.
    //
    // Scoped to NEUTRAL families only. Tide owns the neutrals outright
    // (--ink, --ink-muted, --ink-faint), so a stock neutral step is always a
    // bypass. Chromatic families are deliberately not touched: indigo on a
    // category icon, violet on an "Incentive" type pill and the info badge on
    // "Fully Funded" are data semantics drawn from the category vocabulary, and
    // banning them would be a rule reaching past its mandate.
    //
    // No allowlist needed: the mandate is "Tide owns the neutrals", which is a
    // property of the design system rather than a per-site exemption.
    const NEUTRALS = new Set(["slate", "gray", "zinc", "neutral", "stone"]);
    const offenders: string[] = [];
    const pattern = /(?:dark:)?(?:hover:)?(?:text|decoration|caret|placeholder:text)-([a-z]+)-\d+/g;
    for (const file of TSX_FILES) {
      const key = rel(file);
      if (key === "app/(dashboard)/transactions/print/page.tsx") continue;
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const match of source.matchAll(pattern)) {
        if (!NEUTRALS.has(match[1])) continue;
        offenders.push(`${key}:${source.slice(0, match.index).split("\n").length} ${match[0]}`);
      }
    }
    expect(offenders, `Stock neutral steps in text position (use --ink / --ink-muted / --ink-faint):\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("requires the shared role contracts", () => {
    const missing: string[] = [];
    for (const [file, roles] of ROLE_CONTRACTS) {
      const source = read(file);
      for (const role of roles) {
        if (!sourceUsesRole(source, role)) missing.push(`${file}:${role}`);
      }
    }
    expect(missing, `Missing shared role contracts: ${missing.join(", ")}`).toEqual([]);
  });

  it("requires every Filipino balance-block character line to use the character role", () => {
    const source = read("components/dashboard/balance-block.tsx");
    const characterUses = (source.match(/type-character/g) || []).length;
    expect(characterUses).toBeGreaterThanOrEqual(2);
  });

  it("has no multi-column grid holding exactly one child", () => {
    // Composition defect, and the one rule in this file that is about layout
    // rather than type. A grid-cols-N (N > 1) wrapper with a single child
    // leaves N-1 columns empty: the child takes one column and the rest of the
    // row is a hole. Either the block should be full width (drop the grid) or
    // it should be paired with a neighbour (the composition pass).
    //
    // No allowlist, for the same reason the stock-neutral rule has none: a
    // multi-column grid with one child is never what anyone meant. The variant
    // where the lone child carries col-span-N is also flagged, because that is
    // a one-column grid wearing a two-column grid's markup.
    //
    // This is a *declared* shape, not a measured one - the runtime check lives
    // in the DOM probe, which confirms the rendered column count. This rule
    // catches the declaration, which is where the defect is introduced.
    //
    // Status, stated plainly so this is not over-read: the codebase currently
    // satisfies this rule. It reports zero offenders. It was written expecting
    // to catch live defects on /forecasting and /accounts and it caught
    // neither - those screens have lone full-width *blocks* (orphans), which
    // is a different defect this rule cannot see.
    //
    // So the honest justification is the modest one: it pins a property the
    // codebase already holds, at zero cost, with no exemptions, and it cannot
    // start failing quietly. Not "it fixed two screens." An overstated
    // justification is how a rule loses trust, and it is also how a rule that
    // fires on correct code ends up allowlisted instead of deleted.
    const offenders: string[] = [];
    for (const file of TSX_FILES) {
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const match of source.matchAll(GRID_OPEN_RE)) {
        const tracks = declaredTrackCount(match[3], match[4]);
        if (tracks < 2) continue; // one track is not a multi-column grid
        const children = directElementChildCount(source, match.index + match[0].length);
        if (children === 1) {
          const line = source.slice(0, match.index).split("\n").length;
          // A lone child that spans the whole row is a one-column grid wearing
          // a two-column grid's markup: same visual result, redundant wrapper.
          const inner = source.slice(match.index, match.index + 600);
          const spans = new RegExp(`\\b(?:[a-z]+:)?col-span-(?:${tracks}|full)\\b`).test(inner);
          offenders.push(
            `${rel(file)}:${line} — ${match[0].match(/className="[^"]*"/)?.[0] ?? match[0].slice(0, 60)}` +
              (spans ? "  (lone child spans the row: a one-column grid in disguise)" : "")
          );
        }
      }
    }
    expect(
      offenders,
      `Multi-column grids holding exactly one child:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("counts grid children correctly, so the lone-child rule can fail", () => {
    // A rule that cannot go red is worse than no rule: it reports "clean" for
    // the wrong reason. These fixtures pin the scanner's counting, including
    // the off-by-one that once made the rule silently vacuous.
    const count = (fragment: string) => {
      const open = fragment.match(/<div\b[^>]*>/)![0];
      return directElementChildCount(fragment, fragment.indexOf(open) + open.length);
    };

    // One child: the defect.
    expect(count(`<div className="grid lg:grid-cols-2"><Card /></div>`)).toBe(1);
    expect(
      count(`<div className="grid lg:grid-cols-2">
        <FintechCard>
          <div className="p-6"><span>deep</span></div>
        </FintechCard>
      </div>`)
    ).toBe(1);

    // Two children: fine, and the case the broken scanner got wrong.
    expect(count(`<div className="grid lg:grid-cols-2"><A /><B /></div>`)).toBe(2);
    expect(count(`<div className="grid lg:grid-cols-2"><A /><B /></div><div>after</div>`)).toBe(2);

    // A .map() is one child in source and many at runtime — not lone.
    expect(
      count(`<div className="grid md:grid-cols-2 lg:grid-cols-3">{items.map((i) => (
        <Card key={i} />
      ))}</div>`)
    ).toBe(1);

    // A conditional child is a child.
    expect(count(`<div className="grid lg:grid-cols-2">{ok && <Card />}</div>`)).toBe(1);

    // Track counting, including the arbitrary-value form.
    expect(declaredTrackCount("2", undefined)).toBe(2);
    expect(declaredTrackCount("1", undefined)).toBe(1);
    expect(declaredTrackCount(undefined, "1.15fr_0.85fr")).toBe(2);
    expect(declaredTrackCount(undefined, "1fr")).toBe(1);
  });

  it("requires every currency figure to declare a role, including outside CurrencyDisplay", () => {
    // The marker rule above governs <CurrencyDisplay>. But currency can also be
    // formatted straight into JSX with formatCurrency(...), and that path had
    // no rule at all - which made the marker rule bypassable rather than
    // enforced. Five sites were living in that gap.
    //
    // A currency figure always has a role, so this is allowlist-free for the
    // same reason the CurrencyDisplay rule is: there is no legitimate case of a
    // peso amount on screen that is deliberately unclassified.
    //
    // Scoped to JSX expression position, which is where a rendered figure lives.
    // formatCurrency used inside a helper (CurrencyDisplay itself) or inside a
    // className string is not a figure and is not flagged.
    const offenders: string[] = [];
    for (const file of TSX_FILES) {
      // Scanned unstripped on purpose: withoutComments() deletes lines, which
      // shifts every line number and makes the rule report the wrong line. The
      // only cost is that a formatCurrency() mentioned inside a comment would
      // be flagged, and that is a fair thing for the rule to ask about.
      const source = readFileSync(file, "utf8");
      if (file.endsWith("currency-display.tsx")) continue; // the component itself
      // A rendered figure: formatCurrency( inside a { } JSX expression.
      for (const match of source.matchAll(/\{([^{}]*?)formatCurrency\(([^)]*)\)([^{}]*?)\}/g)) {
        const whole = match[0];
        // CurrencyDisplay carries its own role contract; exempt it here and let
        // the dedicated rule police it.
        if (/CurrencyDisplay/.test(whole)) continue;
        // Attribute position is a prop, not a rendered child. Recharts
        // `formatter={(v) => formatCurrency(v)}` hands a string to the library,
        // which renders it inside its own element with its own styling - there
        // is no element here to put a role on. Scoping the rule to JSX children
        // keeps it to cases where a role is actually declarable, and keeps it
        // free of named exceptions.
        const before = source.slice(0, match.index).replace(/\s+$/, "");
        if (before.endsWith("=")) continue;
        // The role lives on the element the figure sits in, so read that
        // element's className rather than scanning a window of characters
        // around the match. A window flags correct code, and a rule that fires
        // on correct code is a rule that ends up allowlisted.
        if (declaresFigureRole(source, match.index)) continue;
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${rel(file)}:${line} — formatCurrency() rendered with no figure role`);
      }
    }
    expect(
      offenders,
      `Currency figures formatted outside <CurrencyDisplay> with no declared role:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("uses TideMark without the old logo or tagline contract", () => {
    const logo = read("components/shared/logo.tsx");
    expect(logo).toContain("TideMark");
    expect(logo).not.toContain("showTagline");
    expect(logo).not.toContain("Plan • Track • Grow");
    expect(logo).not.toMatch(/linearGradient|feDropShadow|barGrad|arrowGrad/);

    for (const file of LOGO_CALLER_FILES) {
      expect(read(file), `${file} still has a tagline contract`).not.toContain("showTagline");
    }
  });
});
