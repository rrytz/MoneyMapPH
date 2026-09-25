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
] as const;

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
    const missing = REQUIRED_ROLES.filter((role) => !globals.includes(`.${role}`));
    expect(missing, `Missing role definitions: ${missing.join(", ")}`).toEqual([]);
  });

  it("requires every H1 to use the page-title role", () => {
    const missing: string[] = [];
    for (const file of TSX_FILES) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<h1\b[^>]*>/g)) {
        if (!match[0].includes("type-page-title")) {
          const line = source.slice(0, match.index).split("\n").length;
          missing.push(`${rel(file)}:${line}`);
        }
      }
    }
    expect(missing, `H1s without type-page-title: ${missing.join(", ")}`).toEqual([]);
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
      if (/className\s*=\s*["'][^"']*\bcaption\b/.test(source)) violations.push(rel(file));
    }
    expect(violations, `Raw caption usage: ${violations.join(", ")}`).toEqual([]);
  });

  it("requires the shared role contracts", () => {
    const missing: string[] = [];
    for (const [file, roles] of ROLE_CONTRACTS) {
      const source = read(file);
      for (const role of roles) {
        if (!source.includes(role)) missing.push(`${file}:${role}`);
      }
    }
    expect(missing, `Missing shared role contracts: ${missing.join(", ")}`).toEqual([]);
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
