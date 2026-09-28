// AUDIT INVENTORY — report only, no fixes.
//
// Scans every first-party script under verification/ for the five patterns the
// rule in AGENTS.md names. This exists to make the audit mechanical: a rule
// applied by reading is a rule applied inconsistently, which is the failure
// mode this whole pass exists to remove.
//
//   1. element identification by VISUAL property
//   2. assertions that can pass on null-vs-null / empty-set / missing element
//   3. every waitForTimeout
//   4. every addStyleTag, and whether it lands after goto
//   5. state fixtures: do they exercise the state, or a proxy for it

import fs from "node:fs";
import path from "node:path";

const ROOT = "verification";
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(mjs|js)$/.test(e.name)) files.push(p);
  }
})(ROOT);

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));

const VISUAL = [
  { re: /getComputedStyle\([^)]*\)\s*\.\s*(backgroundColor|color|opacity|borderTopWidth|borderTopStyle|borderTopColor)/g, why: "computed style as a selector predicate" },
  { re: /\.\s*style\s*\.\s*backgroundColor/g, why: "inline style as a selector predicate" },
  { re: /\[style\*=/g, why: "substring match on a style attribute" },
  { re: /getBoundingClientRect\(\)\s*\.\s*(width|height|top|left|right|bottom)\s*[=!<>]/g, why: "geometry compared to a literal" },
  { re: /borderTopWidth\s*!==\s*"0px"|borderTopStyle\s*!==\s*"none"/g, why: "border presence used as an identity test" },
  { re: /offsetWidth|offsetHeight|clientWidth|clientHeight/g, why: "box metrics as identity" },
];

const NULLRISK = [
  { re: /(\w+)\s*!==\s*(\w+)/g, why: "raw inequality — safe only if presence is asserted first" },
  { re: /if\s*\(\s*(\w+)\s*&&\s*\1\s*!==/g, why: "guarded inequality — the guard IS the null-guard" },
  { re: /!==\s*null|===\s*null/g, why: "null comparison" },
  { re: /\?\?\s*\(unnamed\)|\?\?\s*["']/g, why: "silent fallback when the lookup fails" },
];

const rows = [];
for (const f of files) {
  const raw = fs.readFileSync(f, "utf8");
  const code = stripComments(raw);
  const lines = code.split("\n");
  const rec = { file: f, visual: [], nullish: [], sleeps: [], styletags: [], gotoIdx: [], textSel: [], emptyGuard: [] };

  lines.forEach((l, i) => {
    if (/waitForTimeout/.test(l)) rec.sleeps.push(i + 1);
    if (/addStyleTag/.test(l)) rec.styletags.push(i + 1);
    if (/\.goto\(/.test(l)) rec.gotoIdx.push(i + 1);
    for (const v of VISUAL) {
      v.re.lastIndex = 0;
      if (v.re.test(l)) rec.visual.push({ line: i + 1, why: v.why, text: l.trim().slice(0, 90) });
    }
    for (const n of NULLRISK) {
      n.re.lastIndex = 0;
      if (n.re.test(l)) rec.nullish.push({ line: i + 1, why: n.why, text: l.trim().slice(0, 90) });
    }
    if (/(text=|:text-is\(|getByText)/.test(l)) rec.textSel.push({ line: i + 1, text: l.trim().slice(0, 90) });
    if (/\.length\s*===\s*0|!\w+\.length|if\s*\(!\w+\)/.test(l) && /(length|querySelectorAll)/.test(l))
      rec.emptyGuard.push({ line: i + 1, text: l.trim().slice(0, 90) });
  });

  // rule 3: is every style tag injected AFTER the navigation it is meant to affect?
  rec.styletagBeforeGoto = rec.styletags.filter((s) => rec.gotoIdx.some((g) => g > s));
  rows.push(rec);
}

const pad = (s, n) => String(s).padEnd(n);
console.log("=".repeat(96));
console.log("AUDIT INVENTORY — " + rows.length + " first-party scripts under " + ROOT);
console.log("=".repeat(96));

console.log("\n--- RULE 4: motion suppression, and whether it was ever active ---");
for (const r of rows.filter((r) => r.styletags.length)) {
  console.log(`  ${pad(r.file, 52)} styleTags@${r.styletags.join(",")} goto@${r.gotoIdx.join(",") || "-"}`);
  console.log(`      ${r.styletagBeforeGoto.length ? "VIOLATION: style tag injected BEFORE goto — discarded on navigation" : "ok: injected after navigation"}`);
}
for (const r of rows.filter((r) => !r.styletags.length && (r.sleeps.length || r.gotoIdx.length)))
  console.log(`  ${pad(r.file, 52)} NO style tag at all`);

console.log("\n--- RULE 5: fixed sleeps ---");
for (const r of rows.filter((r) => r.sleeps.length))
  console.log(`  ${pad(r.file, 52)} ${r.sleeps.length} waitForTimeout @ lines ${r.sleeps.join(", ")}`);
const clean = rows.filter((r) => !r.sleeps.length);
console.log(`  clean: ${clean.map((r) => path.basename(r.file)).join(", ")}`);

console.log("\n--- RULE 1: identification by visual property ---");
for (const r of rows.filter((r) => r.visual.length)) {
  console.log(`  ${pad(r.file, 52)} ${r.visual.length} site(s)`);
  for (const v of r.visual) console.log(`      L${pad(v.line, 4)} ${pad(v.why, 46)} ${v.text}`);
}

console.log("\n--- RULE 1b: text-based locators (substring-matched, break on copy change) ---");
for (const r of rows.filter((r) => r.textSel.length)) {
  console.log(`  ${pad(r.file, 52)} ${r.textSel.length}`);
  for (const t of r.textSel) console.log(`      L${pad(t.line, 4)} ${t.text}`);
}

console.log("\n--- RULE 2: null-vs-null / empty-set exposure ---");
for (const r of rows.filter((r) => r.nullish.length)) {
  const guarded = r.nullish.filter((n) => n.why.startsWith("guarded")).length;
  const raw = r.nullish.length - guarded;
  console.log(`  ${pad(r.file, 52)} ${raw} unguarded, ${guarded} guarded`);
  for (const n of r.nullish.filter((n) => !n.why.startsWith("guarded")).slice(0, 8))
    console.log(`      L${pad(n.line, 4)} ${n.text}`);
}

console.log("\n--- presence guards on empty results ---");
for (const r of rows.filter((r) => r.emptyGuard.length)) {
  console.log(`  ${pad(r.file, 52)} ${r.emptyGuard.length}`);
  for (const e of r.emptyGuard) console.log(`      L${pad(e.line, 4)} ${e.text}`);
}
console.log("");
