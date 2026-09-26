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
 *   type-identity    the home hero, which is deliberately not tabular currency
 */
const FIGURE_MARKERS = ["type-ledger", "type-measurement", "figure-inline", "type-identity"] as const;

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
  ["components/dashboard/balance-block.tsx", ["type-identity", "type-ledger", "type-character"]],
  ["components/dashboard/kpi-card.tsx", ["type-section-label", "type-ledger"]],
  ["components/shared/page-header.tsx", ["type-page-title"]],
  ["components/layout/desktop-nav.tsx", ["type-nav", "type-nav-group"]],
  ["components/shared/tide-gauge.tsx", ["type-measurement"]],
  ["components/dashboard/category-donut-chart.tsx", ["type-measurement"]],
  ["components/dashboard/income-expense-chart.tsx", ["type-measurement"]],
  ["app/(dashboard)/income/paycheck-planner.tsx", ["type-ledger", "type-measurement"]],
  ["app/(dashboard)/budgets/budgets-page-client.tsx", ["type-ledger", "type-measurement"]],
  ["app/(dashboard)/transactions/transactions-client.tsx", ["type-ledger", "type-measurement"]],
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
