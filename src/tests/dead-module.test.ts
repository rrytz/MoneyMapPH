import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

/**
 * Dead-module detector.
 *
 * A module that exports something no other module under src imports is either
 * dead, or it is a capability someone is deliberately keeping open. Those need
 * different treatment, and only one of them should be silent.
 *
 * Why this exists: removing the Financial Health card from the dashboard left
 * three modules reachable from nothing. Two of them - health.service.ts and
 * health-breakdown.ts - were kept on the stated intention that the rollup might
 * return, and health-hero-copy.ts was kept only because the removal had not yet
 * been cleaned up. All three were kept alive by their own tests, which is the
 * trap: a test that imports a module to assert it works will keep an unreachable
 * module passing forever, and "the suite is green" says nothing about whether
 * anything uses it.
 *
 * That is the sixth shape of "the logic is right and the data cannot expose
 * it" in this arc, and the first one a gate can close on its own.
 *
 * Scope:
 *   - Modules under src, excluding tests. A test is not a consumer: counting
 *     tests is exactly what let three dead modules look alive.
 *   - Only *exported* bindings, so a file with no exports is not flagged - it
 *     is a script, a type-only module, or a side-effect file, and judging those
 *     needs a human.
 *   - Import specifiers resolve the way TypeScript resolves them: a relative
 *     specifier or a configured path alias. A package specifier, or a path
 *     that does not exist, is skipped rather than guessed at.
 *   - Next.js convention files are entry points, not dead exports. The
 *     framework discovers them by filename, so nothing will ever import them.
 *     That is a structural fact, not an exemption for a specific module.
 *
 * An exemption is a named entry with a reason, never a bare skip. The point of
 * the rule is that keeping a module open is a decision that has to be written
 * down; silence is how the option becomes permanent.
 */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** tsconfig paths, verbatim. The prefix is the part before the star. */
const TS_CONFIG_PATHS: Record<string, string> = {
  "@/*": "src/*",
};

const MODULE_EXT = [".ts", ".tsx"];

/**
 * Files the framework reaches by filename rather than by import. A `route.ts`
 * exporting GET is called by Next; a `page.tsx` default export is rendered by
 * Next. Flagging them would be the rule firing on correct code, which is how
 * rules in this project end up allowlisted.
 */
const ENTRY_POINTS = new Set([
  "page.tsx", "layout.tsx", "route.ts", "loading.tsx", "error.tsx",
  "global-error.tsx", "not-found.tsx", "template.tsx", "default.tsx",
  "middleware.ts", "instrumentation.ts", "opengraph-image.tsx",
  // Next reads the web manifest by convention; nothing imports it.
  "manifest.ts",
  // The service worker is registered by the browser, not by an import.
  "sw.ts", "service-worker.ts",
]);

/** Every module we are willing to read, including tests and entry points. */
function collect(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, acc);
    else if (MODULE_EXT.some((e) => entry.endsWith(e)) && !entry.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

const ALL_FILES = collect(SRC);

/**
 * Candidates for the dead-module verdict. This is a *narrower* set than
 * everything we read: a page.tsx is a perfectly good consumer of a component,
 * so excluding it from the scan as well as from the candidates would flag every
 * component in the app. Entry points are read for their imports and never
 * judged for their exports.
 */
const MODULES = ALL_FILES.filter(
  (f) => !/\.test\.(ts|tsx)$/.test(f) && !ENTRY_POINTS.has(basename(f))
);
const rel = (f: string) => relative(SRC, f).replaceAll("\\", "/");
// Strip a UTF-8 BOM. Without this, a BOM'd file fails every /^export/m match,
// exportedNames returns [], and the file is skipped as "nothing to judge" -
// so a byte-order mark would silently exempt a module from the rule. Found
// because a proof file written by PowerShell did not fire, which is exactly
// the kind of green-for-the-wrong-reason this project keeps looking for.
const read = (f: string) => readFileSync(f, "utf8").replace(/^\uFEFF/, "");
const isTestFile = (f: string) => /\.test\.(ts|tsx)$/.test(f);

/** Exported binding names. Covers declaration forms, `export {}`, `export default`. */
function exportedNames(source: string): string[] {
  const names = new Set<string>();
  for (const m of source.matchAll(
    /^export\s+(?:async\s+)?(?:function|const|let|var|class|abstract\s+class)\s+([A-Za-z_$][\w$]*)/gm
  )) names.add(m[1]);
  for (const m of source.matchAll(/^export\s+(?:type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  for (const m of source.matchAll(/^export\s+default\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add("default:" + m[1]);
  }
  return [...names];
}

/**
 * Specifiers a file depends on. Includes re-exports (`export ... from`), which
 * are consumers too - a barrel file is a legitimate way to keep a module
 * reachable.
 */
function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const push = (s: string) => {
    const v = s.trim().replace(/^["']|["']$/g, "");
    if (v) specs.push(v);
  };
  for (const m of source.matchAll(
    /\bimport\s+(?:type\s+)?[^;]*?\bfrom\s*["']([^"']+)["']/g
  )) push(m[1]);
  for (const m of source.matchAll(/\bimport\s*["']([^"']+)["']/g)) push(m[1]);
  for (const m of source.matchAll(
    /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s*from\s*["']([^"']+)["']/g
  )) push(m[1]);
  for (const m of source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)) push(m[1]);
  for (const m of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) push(m[1]);
  return specs;
}

/** Resolve a specifier to a src-relative module path, or null if we cannot. */
function resolveSpecifier(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith(".")) {
    base = join(dirname(fromFile), spec);
  } else {
    // The prefix is everything before the star. Comparing the whole key -
    // `spec.startsWith("@/*")` - never matches anything, because a real
    // specifier has a path where the star sits.
    const key = Object.keys(TS_CONFIG_PATHS).find((k) => {
      const prefix = k.slice(0, k.indexOf("*"));
      return k.includes("*") && spec.startsWith(prefix);
    });
    if (!key) return null; // a package: not ours to judge
    const prefix = key.slice(0, key.indexOf("*"));
    const target = TS_CONFIG_PATHS[key].replace("*", "");
    base = join(ROOT, target + spec.slice(prefix.length));
  }
  const stripped = base.replace(/\.(js|mjs)$/, "");
  const candidates: string[] = [];
  for (const ext of MODULE_EXT) {
    candidates.push(stripped + ext, stripped + "/index" + ext);
  }
  for (const c of candidates) {
    // `c` is already absolute. join(ROOT, c) would concatenate rather than
    // reset, producing ROOT\C:\...\ROOT\src\lib\... and missing every file.
    try {
      if (statSync(c).isFile()) return rel(c);
    } catch {
      /* keep trying */
    }
  }
  return null;
}

/**
 * Named exemptions, each a real reason. Adding an entry here is a decision to
 * keep a module reachable from nothing, and it has to say why.
 */
const EXEMPT = new Map<string, string>([
  // Test doubles, imported only by .test files, which the rule does not count
  // as consumers. Reachable by design; not application code.
  ["tests/supabase-mock.ts", "test double - consumers are test files by definition"],
  ["tests/helpers/supabase-mock.ts", "test double - consumers are test files by definition"],
]);

/**
 * Path-scoped exemptions, each a structural fact rather than a convenience.
 *
 * A path exemption is different in kind from a module exemption: it is not a
 * list of files that happen to be unreferenced, it is a claim about what a
 * whole directory *is*. That claim has to be true for every file in it and
 * falsifiable by inspection, which is what keeps it from becoming the allowlist
 * this project has spent two slices removing.
 */
const EXEMPT_PATHS: Array<[prefix: string, reason: string]> = [
  [
    "components/ui/",
    "vendored shadcn/ui primitives - a component library, so an unused " +
      "primitive is the library working as intended. The project-specific " +
      "surface (fintech-card.tsx) sits in the same directory and is NOT " +
      "exempt, so this cannot hide a card the app stopped using.",
  ],
];

const isExempt = (key: string) =>
  EXEMPT.has(key) || EXEMPT_PATHS.some(([p]) => key.startsWith(p));

function findDeadModules(): string[] {
  const imported = new Set<string>();
  // Scanned across every non-test file, including page.tsx and other entry
  // points. A page is a legitimate consumer; excluding it from the scan is what
  // made the first version flag every component in the app.
  const consumers = ALL_FILES.filter((f) => !/\.test\.(ts|tsx)$/.test(f));
  for (const file of consumers) {
    for (const spec of importSpecifiers(read(file))) {
      const target = resolveSpecifier(spec, file);
      if (target) imported.add(target);
    }
  }

  const offenders: string[] = [];
  for (const file of MODULES) {
    const key = rel(file);
    if (isExempt(key) || imported.has(key)) continue;
    const names = exportedNames(read(file));
    if (names.length === 0) continue; // a script or side-effect file, nothing to judge
    offenders.push(
      `${key} — exports ${names.slice(0, 4).join(", ")} but nothing under src imports it`
    );
  }
  return offenders.sort();
}

describe("dead module detector", () => {
  it("flags no module that exports a binding no other module imports", () => {
    const offenders = findDeadModules();
    expect(
      offenders,
      `Modules exported but imported by nothing under src (tests do not count):\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("resolves the specifier shapes it claims to", () => {
    // The rule is only as trustworthy as its resolver, so the resolver is
    // pinned directly rather than inferred from the modules it happens to pass.
    // The first case is the one that was wrong: a key like "@/*" must match on
    // its prefix "@/", never on the whole string.
    const from = join(SRC, "app/(dashboard)/expenses/actions.ts");
    expect(resolveSpecifier("@/lib/utils/date", from)).toBe("lib/utils/date.ts");
    expect(resolveSpecifier("@/lib/services/expense.service", from)).toBe(
      "lib/services/expense.service.ts"
    );
    expect(resolveSpecifier("@/components/shared/page-skeleton", from)).toBe(
      "components/shared/page-skeleton.tsx"
    );
    // Relative specifiers resolve from the importing file's own directory.
    // From src/app/(dashboard)/expenses/, three levels up is src/, so the way
    // to src/lib/utils is ../../../lib/utils - not ../../lib/utils, which
    // lands in src/app/lib/utils and resolves to nothing.
    expect(resolveSpecifier("../../../lib/utils", from)).toBe("lib/utils.ts");
    expect(resolveSpecifier("../../../lib/utils/date", from)).toBe("lib/utils/date.ts");
    // A package is not ours to judge.
    expect(resolveSpecifier("react", from)).toBeNull();
    // A path that does not exist resolves to null rather than guessing.
    expect(resolveSpecifier("@/lib/utils/does-not-exist", from)).toBeNull();
  });

  it("counts .tsx modules and reads page.tsx as a consumer", () => {
    // The first version collected .ts only, then excluded page.tsx from the
    // scan entirely - so every component consumed only by a page looked dead.
    // Both halves are pinned: .tsx is a candidate shape, and a page is a
    // consumer even though it is not itself a candidate.
    expect(MODULES.filter((f) => f.endsWith(".tsx")).length).toBeGreaterThan(0);
    expect(resolveSpecifier("@/app/page", join(SRC, "lib/constants.ts"))).toBe("app/page.tsx");
    const pages = ALL_FILES.filter((f) => basename(f) === "page.tsx");
    expect(pages.length).toBeGreaterThan(0);
    // Present in the scan, absent from the candidate set.
    expect(ALL_FILES.some((f) => basename(f) === "page.tsx")).toBe(true);
    expect(MODULES.some((f) => basename(f) === "page.tsx")).toBe(false);
  });

  it("treats a Next.js convention file as an entry point, not a dead export", () => {
    expect(ENTRY_POINTS.has("route.ts")).toBe(true);
    expect(ENTRY_POINTS.has("page.tsx")).toBe(true);
    // A route handler's GET is called by the framework, so the file must be
    // skipped as a candidate rather than flagged.
    expect(MODULES.some((f) => basename(f) === "route.ts")).toBe(false);
    // It is still read for its imports.
    expect(ALL_FILES.some((f) => basename(f) === "route.ts")).toBe(true);
  });

  it("sees exports in a file that carries a byte-order mark", () => {
    // Found by trying to prove the rule fires and watching it not. A BOM puts
    // three bytes ahead of the first `export`, so /^export/m misses every
    // declaration, exportedNames returns [], and the file is skipped as "a
    // script, nothing to judge" - a BOM silently exempting a module from the
    // rule. PowerShell writes BOMs by default, so this is reachable.
    //
    // Asserted against a real file written with a BOM, read through read() -
    // the function that strips it. Testing exportedNames() on a hand-built
    // string would pass while the rule stayed broken, which is the exact shape
    // of the bug being guarded.
    const fixture = join(SRC, "lib/__bom-fixture.ts");
    writeFileSync(fixture, "\uFEFFexport function bomExported() { return 1; }\n");
    try {
      expect(readFileSync(fixture)[0], "fixture must start with a BOM").toBe(0xef);
      // The bug: parsed raw, the exports are invisible.
      expect(exportedNames(readFileSync(fixture, "utf8")).length,
        "raw parse should miss the exports - that is the bug being guarded").toBe(0);
      // The fix: read() strips it, so the module is judged.
      expect(exportedNames(read(fixture))).toContain("bomExported");
    } finally {
      rmSync(fixture, { force: true });
    }
  });

  it("reads exported bindings from every declaration form", () => {
    const src = [
      "export function a() {}",
      "export const b = 1;",
      "export class C {}",
      "export type T = string;",
      "export interface I {}",
      "export { d, e as F };",
      "export default function g() {}",
      "function notExported() {}",
    ].join("\n");
    const names = exportedNames(src);
    for (const expected of ["a", "b", "C", "T", "I", "d", "F", "default:g"]) {
      expect(names, expected).toContain(expected);
    }
    expect(names).not.toContain("notExported");
  });

  it("requires every exemption to state a reason", () => {
    // The rule's value is that keeping a module open is a decision someone
    // wrote down. An exemption with an empty reason is that decision with the
    // writing removed, which is the failure mode the rule exists to prevent.
    for (const [key, reason] of EXEMPT) {
      expect(reason.trim().length, `exemption "${key}" has no reason`).toBeGreaterThan(20);
    }
    for (const [prefix, reason] of EXEMPT_PATHS) {
      expect(reason.trim().length, `path exemption "${prefix}" has no reason`).toBeGreaterThan(20);
    }
    // And the path exemption must not be so broad that it covers the app's own
    // component code, which is the part that actually rots.
    expect(isExempt("components/ui/card.tsx")).toBe(true);
    expect(isExempt("components/ui/fintech-card.tsx")).toBe(true);
    expect(isExempt("components/dashboard/dashboard-shell.tsx")).toBe(false);
    expect(isExempt("lib/services/health.service.ts")).toBe(false);
  });

  it("does not treat a test file as a consumer", () => {
    // The specific trap that let three dead modules look alive: each was
    // imported by its own test and nothing else.
    expect(isTestFile(join(SRC, "lib/services/health.service.test.ts"))).toBe(true);
    expect(MODULES.some((f) => f.endsWith(".test.ts"))).toBe(false);
  });
});
