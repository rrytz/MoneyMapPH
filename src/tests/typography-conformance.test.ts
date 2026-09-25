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
] as const;

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
