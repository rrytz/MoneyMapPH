// gate:rules — the durable check for the rule in AGENTS.md.
//
// WHY THIS EXISTS
//
// "An assertion must prove it had something to assert on" is, on its own, a
// control that depends on someone remembering to apply it — which is the exact
// failure mode that produced the four defects the rule was extracted from. A
// documented rule is a claim. This makes it a control.
//
// SCOPE IS DERIVED, NOT LISTED
//
// The set of files this checks is read out of package.json's own `gate:*`
// entries. Nothing maintains that list, so adding a new gate brings it under
// the rules automatically. A checker whose scope is a hand-kept array is one
// more thing to forget to update, and it fails open, which is the worst way to
// fail.
//
// The capture and diagnostic scripts are deliberately NOT in scope. They wait on
// time to produce a screenshot, not to decide a pass, and treating them as
// violations would be this check over-reaching into its own failure mode.
//
// THE ESCAPE HATCH
//
// Every finding can be silenced with a `rules:ok <reason>` comment on the same
// line or the line above. The reason is not optional: a suppression with no
// stated cause is a control that exists in intent, and this file has opinions
// about those. Suppressions are printed at the end of every run so they cannot
// accumulate unseen.

import fs from "node:fs";
import path from "node:path";

// `import.meta.dirname`, not `process.cwd()`: this script must read package.json
// from the repository root regardless of the directory it is invoked from, and
// gate-hygiene.test.ts forbids resolving paths from the working directory
// precisely because that makes a script's behaviour depend on where it was run.
const ROOT = path.resolve(import.meta.dirname, "..", "..");

// ---------------------------------------------------------------- scope
//
// Derived from the `gate:all` chain, NOT from every `gate:*` entry.
//
// The first version globbed all `gate:*` and pulled in gate:captures and
// gate:dom - the capture and diagnostic scripts - which the audit explicitly
// placed out of scope: they wait on time to produce a screenshot, not to decide
// a pass. Checking them anyway is this check over-reaching into its own failure
// mode, and a checker that cries wolf gets switched off.
//
// What is IN scope is the set of scripts that can actually turn the chain red.
// A `gate:*` script outside the chain cannot, so it is reported as uncovered at
// the end instead of being failed - visible, so it cannot be forgotten, but not
// treated as a defect.
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const scripts = pkg.scripts || {};
const chainBody = scripts["gate:all"] || "";
if (!chainBody) {
  console.error("gate:rules: package.json has no gate:all, so the scope cannot be derived.");
  console.error("Deriving it from a hand-kept list would be one more thing to forget, and it");
  console.error("fails OPEN. Fixing the scope is the fix; refusing to check anything is not.");
  process.exit(1);
}

const scriptsIn = (body) => {
  const out = new Set();
  for (const m of String(body).matchAll(/[\w./-]+\.(?:mjs|js)\b/g)) {
    const rel = m[0].replace(/\\/g, "/");
    if (fs.existsSync(path.join(ROOT, rel))) out.add(rel);
  }
  return out;
};

// `gate:all` does not name files; it names other gates:
//
//   npm run gate:types && npm test && npm run gate:nav && ...
//
// So the chain is followed TRANSITIVELY through `npm run <name>`. The first
// version globbed gate:all for paths directly, found none, and reported an
// empty scope - which is rule 2 living inside the rule-2 checker: it would have
// refused to run rather than quietly pass, which was right, but for the wrong
// reason. Deriving the real chain is the fix.
const chainFiles = new Set();
const seen = new Set();
const walkChain = (name) => {
  if (seen.has(name) || !scripts[name]) return;
  seen.add(name);
  const body = scripts[name];
  for (const rel of scriptsIn(body)) chainFiles.add(rel);
  for (const m of body.matchAll(/npm run ([\w:-]+)/g)) walkChain(m[1]);
};
walkChain("gate:all");

const files = chainFiles;

// gate:* entries that are not in the chain, and so are not covered.
const uncovered = [];
for (const [name, body] of Object.entries(scripts)) {
  if (name === "gate:all" || !name.startsWith("gate:")) continue;
  for (const rel of scriptsIn(body)) if (!files.has(rel)) uncovered.push({ name, rel });
}

if (files.size === 0) {
  console.error("gate:rules: the gate:all chain references no script files - the scope is empty,");
  console.error("which means this check would pass while verifying nothing. Rule 2, in the checker.");
  process.exit(1);
}

// ------------------------------------------------------------- utilities
/** Comments stripped, preserving line count, so findings point at real code. */
const stripComments = (src) => {
  let out = "";
  let i = 0;
  let state = "code";
  let quote = "";
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (state === "code") {
      if (two === "//") { state = "line"; i += 2; continue; }
      if (two === "/*") { state = "block"; i += 2; continue; }
      if (quote) { if (src[i] === "\\") { out += src.slice(i, i + 2); i += 2; continue; } if (src[i] === quote) quote = ""; out += src[i++]; continue; }
      if (src[i] === '"' || src[i] === "'" || src[i] === "`") { quote = src[i]; out += src[i++]; continue; }
      out += src[i++];
      continue;
    }
    if (state === "line") { if (src[i] === "\n") { state = "code"; out += "\n"; } else out += " "; i++; continue; }
    if (state === "block") { if (two === "*/") { state = "code"; i += 2; continue; } out += src[i] === "\n" ? "\n" : " "; i++; continue; }
  }
  return out;
};

const findings = [];
const suppressions = [];

const report = (file, line, rule, msg) => {
  findings.push({ file, line, rule, msg });
};

// ---------------------------------------------------------------- rules
// 1. SELECTION BY A VISUAL PROPERTY.
//
// Deliberately narrow. `getComputedStyle(x).color` feeding a contrast ratio is
// measurement and is what these scripts exist to do; only a computed style used
// as a PREDICATE over which elements to consider is a violation. The predicate
// context is what distinguishes them, and that is the whole difficulty.
const SELECTION_RULES = [
  { id: "style-attr-selector", re: /\[style\*?=/, msg: "selects on a style attribute; identify by data-*/role/tag" },
  { id: "class-identity", re: /(querySelector|querySelectorAll|\.find)\(\s*['"`][^'"`]*\b(?:nav|div|span|a|button)\.[a-z0-9-]+/, msg: "identifies by a Tailwind utility class; a refactor silently empties the match. Use a data-* handle." },
  { id: "class-regex-state", re: /\.test\(\s*(?:String\()?\s*\w+\.(?:className|innerHTML|outerHTML)/, msg: "infers STATE from markup - the archived-card defect. Use a data-* state attribute." },
  // A computed style is only a violation when it appears on the SAME LINE as a
  // selection context. The first version allowed 80 characters of lookahead
  // across newlines, so it matched `getComputedStyle(el).color` feeding a
  // contrast ratio in `paintedBg` - measurement, which is the entire purpose of
  // these scripts - because a `?` or `:` happened to appear a few lines later.
  // Same-line is the discriminator: a predicate reads its style and decides in
  // one expression; a measurement reads it and hands the number onwards.
  { id: "computed-style-predicate", re: /getComputedStyle\([^)]*\).*(?:\.find\(|\.filter\(|\.some\(|\.every\(|querySelector)/, msg: "a computed style is used to SELECT on the same line as the selection context, not to measure" },
  { id: "border-presence-identity", re: /border(?:Top|Bottom|Left|Right)?(?:Width|Style)\s*[!=]==?\s*["'](?!none)/, msg: "border presence used as an identity test; use a role attribute" },
  { id: "text-locator", re: /(querySelector|waitForSelector|\$)\(\s*['"`]text=/, msg: "text= is a substring match and breaks on copy change; use a data-* handle" },
  { id: "box-metric-filter", re: /getBoundingClientRect\(\)\s*\.\s*(?:width|height)\s*[<>]=?\s*\d+\s*\)\s*(?:continue|\?|&&|\|\|)/, msg: "drops or selects elements by size alone" },
];

// 2. FIXED SLEEPS.
const waitForTimeout = /\bwaitForTimeout\s*\(/;

// 3. STYLE TAG BEFORE NAVIGATION.
//
// Order-sensitive, so it is checked per function region rather than per line:
// a KILL_MOTION constant declared at the top of the file is fine, and an
// addStyleTag that appears after a goto in the same region is fine.
const addStyleTag = /addStyleTag\s*\(/;
const gotoCall = /\.goto\s*\(/;

for (const rel of files) {
  const raw = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const rawLines = raw.split("\n");
  const code = stripComments(raw);
  const codeLines = code.split("\n");

  // A suppression is a `rules:ok <reason>` in the comment block IMMEDIATELY
  // above the finding, not merely on the line above it.
  //
  // The first version checked only the reported line and the one before it,
  // which meant a six-line explanation was invisible and the finding could not
  // be silenced without compressing the reason onto a single line. Requiring a
  // reason is the point; making the reason hard to write defeats it. The scan
  // stops at a blank line so a suppression cannot silently reach forward over
  // unrelated code.
  const suppressed = (n) => {
    for (let k = 1; k <= 10; k++) {
      const l = rawLines[n - k];
      if (l === undefined) return false;
      if (!l.trim()) return false; // blank line: the comment block has ended
      const m = l.match(/rules:ok\s+(.*)$/);
      if (m) {
        suppressions.push({ file: rel, line: n, why: m[1].trim() });
        return true;
      }
    }
    return false;
  };

  codeLines.forEach((line, idx) => {
    const n = idx + 1;
    for (const r of SELECTION_RULES) {
      if (r.re.test(line) && !suppressed(n)) report(rel, n, r.id, r.msg);
    }
    if (waitForTimeout.test(line) && !suppressed(n)) {
      report(rel, n, "wait-for-timeout", "fixed sleep in a gate; wait on an observed condition instead");
    }
  });

  // rule 3, per file: is any addStyleTag issued before the first goto?
  const firstGoto = codeLines.findIndex((l) => gotoCall.test(l));
  const firstTag = codeLines.findIndex((l) => addStyleTag.test(l));
  if (firstTag !== -1 && (firstGoto === -1 || firstTag < firstGoto) && !suppressed(firstTag + 1)) {
    report(rel, firstTag + 1, "style-tag-before-goto",
      "addStyleTag precedes the first goto. addStyleTag writes into the current document and goto replaces it, so the tag is discarded silently and the suppression never happens.");
  }

  // 4. a gate must assert on something. A script that can find zero elements and
  //    still report success is rule 2 in the gate itself.
  //
  // Matched against the whole file, then mapped back to a line - the pattern
  // spans lines, so testing it per-line never matched and reported line 0.
  //
  // A preceding presence assertion makes it compliant. The rule is "assert
  // presence BEFORE equality", so a guarded empty-set branch is the rule
  // satisfied rather than violated:
  //
  //     if (coverage.cards === 0 || coverage.leaves === 0) fail(...)
  //     else if (hazards.length === 0) console.log("PASS ...")
  //
  // Recognising that matters more than it looks. The alternative was to silence
  // two correct sites with `rules:ok`, and a check whose escape hatch is used on
  // its own compliant code is a check whose escape hatch has stopped meaning
  // anything.
  const emptyPass =
    /if\s*\([^)]*\.length\s*===\s*0[^)]*\)\s*\{[^{}]*console\.(?:log|error)\([^)]*\b(?:PASS|clean|ok\b)/i;
  let scan = code;
  let guard = null;
  while ((guard = scan.match(emptyPass)) !== null) {
    const at = guard.index;
    const n = scan.slice(0, at).split("\n").length;
    const lookbehind = scan.slice(Math.max(0, at - 900), at);
    const presenceAsserted = /\bfail\s*\(/.test(lookbehind) || /coverage\.[a-z]+\s*===?\s*0/.test(lookbehind);
    if (!presenceAsserted && !suppressed(n)) report(rel, n, "empty-set-pass",
      "reports success when the result set is empty; assert the subject is present before comparing it");
    // blank the match out so the next iteration advances
    scan = scan.slice(0, at) + " ".repeat(guard[0].length) + scan.slice(at + guard[0].length);
  }
}

// ---------------------------------------------------------------- output
const pad = (s, n) => String(s).padEnd(n);
console.log("=== gate:rules — assertions must prove they had something to assert on ===");
console.log(`  scope derived from package.json gate:* entries (${files.size} script(s)):`);
for (const f of [...files].sort()) console.log(`    ${f}`);

// rules:ok this is the CHECKER reporting on ITSELF. `findings` holds the
// violations it found in the chain; if it were non-empty the run above already
// failed and printed every one. Reaching here means the chain is clean, so this
// is not a gate asserting on an empty subject. A gate over gates must live
// inside its own scope, and the suppression prints on every run rather than
// hiding the fact.
if (findings.length === 0) {
  console.log("\n  PASS  no gate script selects by a visual property, sleeps on a fixed");
  console.log("        duration, injects a style tag before navigating, or reports success");
  console.log("        on an empty result set.");
} else {
  console.log("");
  for (const f of findings) {
    console.log(`  FAIL  ${pad(f.file, 46)} L${pad(f.line, 4)} [${f.rule}]`);
    console.log(`        ${f.msg}`);
    console.log(`        silence with a \`rules:ok <reason>\` comment on this or the line above.`);
  }
}

if (suppressions.length) {
  console.log("\n  suppressions in force (these are claims, not checks):");
  for (const s of suppressions) console.log(`    ${pad(s.file, 46)} L${pad(s.line, 4)} ${s.why}`);
}

if (uncovered.length) {
  console.log("\n  not covered, because they are outside the gate:all chain and cannot turn it red:");
  for (const u of uncovered) console.log(`    ${pad(u.name, 16)} ${u.rel}`);
  console.log("    If one of these is ever promoted into the chain, it comes under the rules");
  console.log("    automatically - the scope is derived, not listed.");
}

console.log("");
process.exit(findings.length === 0 ? 0 : 1);
