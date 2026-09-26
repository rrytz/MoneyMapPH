import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Gate hygiene — rules about the verification scripts themselves.
 *
 * These scripts are tracked infrastructure (see the b1f917c split), so they
 * are held to the same standard as the code they verify. The rule here exists
 * because `process.cwd()` appeared three times in this codebase, and each time
 * it failed in a way that pointed somewhere other than the cause:
 *
 *   - the capture scripts wrote shots/ to the repo root instead of under
 *     verification/, which reads as "the script works, the file is missing"
 *   - mint.mjs resolved .env.local from the working directory, so it only ran
 *     from the repo root and otherwise threw "env missing" — which reads as a
 *     config problem, not a path problem
 *
 * A written convention decays exactly the way the three instances did, so this
 * is mechanical instead. There is no allowlist: a verification script has no
 * legitimate use for the working directory, because every path it cares about
 * is defined relative to the script or to the repo it lives in.
 *
 * Comment-aware by necessity — mint.mjs now *documents* the fix in a comment
 * that mentions process.cwd(), and a naive grep would flag the explanation as
 * the offence.
 */

const ROOT = process.cwd();
const SCRIPTS_DIR = join(ROOT, "verification", "screenshot-prep");

function collectScripts(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue; // third-party, not ours
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectScripts(full, acc);
    else if (/\.(mjs|js)$/.test(entry)) acc.push(full);
  }
  return acc;
}

/** Strip block and line comments so documentation of a fix is not the offence. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("verification gate hygiene", () => {
  it("resolves no path from process.cwd()", () => {
    const offenders: string[] = [];
    for (const file of collectScripts(SCRIPTS_DIR)) {
      const source = stripComments(readFileSync(file, "utf8"));
      for (const match of source.matchAll(/process\.cwd\(\)/g)) {
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(
          `${relative(ROOT, file).replaceAll("\\", "/")}:${line} — use import.meta.dirname instead`
        );
      }
    }
    expect(
      offenders,
      `Scripts resolving paths from the working directory:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });
});
