// select-items-check.mjs - every Base UI Select must be passed `items=`.
//
// WHY THIS EXISTS, IN ONE PARAGRAPH
//
// Base UI's `Select.Value` renders the RAW VALUE, not the selected item's
// children: the items live inside a Portal that is unmounted while the popup is
// closed, so there is no mounted ItemText to read a label from and it falls back
// to the value string. A Select without `items` therefore prints a database key
// in its trigger - `0cb48c88-1e00-43d2-a88c-f42f6e37f6fa` where a label belongs.
// See 1e01640.
//
// WHY A CHECK AND NOT A DISCIPLINE
//
// This exact bug was already hand-patched in THREE places before 1e01640, each
// with a comment correctly naming the library behaviour, and one of the patches
// ended in `?? selectedCategory` - so it printed the raw UUID anyway when the
// selected id was not in the list. A partial fix that reads as coverage is the
// shape that recurs; three of them is the evidence. The fourth is one
// copy-paste away.
//
// A SIBLING, NOT A gate:rules EXTENSION
//
// gate-rules.mjs derives its scope from the gate:all chain, and `src/` is not
// in that chain - the chain holds verifiers, not the components they verify.
// Widening gate-rules to reach application code would break the property that
// makes its scope trustworthy, so this is a separate script with its own
// explicit scope: every .tsx under src/.
//
// COARSE ON PURPOSE
//
// This is a FLOOR, not a ceiling. A false positive costs one line of
// suppression comment; a false negative costs a UUID in the UI. So the tag
// scanner below is deliberately generous about what counts as an opening tag and
// deliberately strict about what counts as a match.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(ROOT, "src");

/** Walk every .tsx under src/. */
function tsxFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * Extract every `<Select ...>` opening tag with its source line.
 *
 * Brace-aware, because a naive `/<Select[^>]*>/` stops at the `>` of the first
 * arrow function in an attribute - `onValueChange={(v) => ...}` - and returns a
 * truncated tag that cannot contain `items`. That truncation is silent: it
 * reports the site as missing `items` when it has them, which is the shape of
 * failure this whole project keeps refusing to accept.
 */
function selectTags(source) {
  const tags = [];
  const re = /<Select(?=[\s.>])/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    let i = m.index + "<Select".length;
    let depth = 0;
    let started = false;
    while (i < source.length) {
      const ch = source[i];
      if (ch === "{") { depth++; started = true; }
      else if (ch === "}") { depth--; }
      else if (ch === ">" && !started) break;   // first `>` before any attr value: not a real tag
      else if (ch === ">" && depth <= 0) break;
      i++;
    }
    const text = source.slice(m.index, i + 1);
    tags.push({ text, line: source.slice(0, m.index).split("\n").length });
    re.lastIndex = i;
  }
  return tags;
}

/** `items=` may be `items={...}`, `items = {...}`, or spread-in. */
const hasItems = (tag) => /(^|\s)items\s*=/.test(tag);

// The colon is OPTIONAL but the reason is NOT. The first version of this pattern
// required whitespace straight after the keyword, so the documented form
// `// select-items-not-needed: <reason>` never matched - the suppression was dead
// code that printed a helpful message on every run while silencing nothing. It
// was found by trying to use it, which is the only way a suppression is ever
// proven: a rule that has never been silenced has never been shown to accept one.
const SUPPRESSION = /select-items-not-needed\s*:?\s*([^\n]*)/;

// Strip the comment syntax off the captured tail, so a suppression whose reason
// is ONLY the closing delimiter still counts as empty and fails. Without this,
// `{/* select-items-not-needed: */}` would be read as having the reason " */}".
const bare = (s) =>
  s.replace(/\*\/\}?\s*$/, "").replace(/\}\s*$/, "").replace(/\*\/\s*$/, "").trim();

const files = tsxFiles(SRC);
const findings = [];
let total = 0;
let suppressed = 0;

for (const file of files) {
  // Line endings are normalised on READ, not in the pattern. `.` does not match
  // `\r` and `$` without `m` anchors only at end-of-string, so a suppression
  // regex written against LF content is dead against CRLF content and looks
  // exactly like a clean run. This has bitten this file family before.
  const raw = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");

  for (const tag of selectTags(raw)) {
    total++;
    if (hasItems(tag.text)) continue;

    // A suppression is a `select-items-not-needed <reason>` in the comment block
    // immediately above the element. A reason is MANDATORY and must be
    // non-empty: making the reason hard to write defeats the point of having one.
    const above = lines.slice(Math.max(0, tag.line - 8), tag.line - 1).join("\n");
    const m = above.match(SUPPRESSION);
    const reason = m ? bare(m[1]) : "";
    if (m && reason.length > 0) {
      suppressed++;
      continue;
    }
    findings.push({
      file: path.relative(ROOT, file).replace(/\\/g, "/"),
      line: tag.line,
      excerpt: tag.text.replace(/\s+/g, " ").slice(0, 90),
    });
  }
}

console.log("=== select-items: every Base UI Select must carry items= ===");
console.log(`  scanned ${files.length} .tsx files under src/`);
console.log(`  Select elements found: ${total}`);

if (total === 0) {
  console.error("\n  FAIL  no <Select> elements found at all.");
  console.error("  The scan matched nothing, so it has proved nothing. A regex that stops");
  console.error("  matching is indistinguishable from a codebase with no Selects - and the");
  console.error("  gate would be green either way. This is the class, in the checker itself.");
  process.exit(1);
}

if (suppressed) console.log(`  suppressed with a stated reason: ${suppressed}`);

if (findings.length) {
  console.error(`\n  FAIL  ${findings.length} Select(s) without items=:\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}`);
    console.error(`    ${f.excerpt}`);
  }
  console.error(
    "\n  Base UI Select renders the raw value when its popup is closed unless passed" +
    "\n  items= - see 1e01640. Without it the trigger shows a database key, not a label." +
    "\n\n  If this Select genuinely does not need items - a constant option list where" +
    "\n  the value IS the label - silence it explicitly, above the element:" +
    "\n\n      // select-items-not-needed: <reason>" +
    "\n\n  A reason is mandatory and must be non-empty."
  );
  process.exit(1);
}

console.log(`\n  PASS  all ${total} Select(s) carry items=${suppressed ? ` (${suppressed} suppressed with a stated reason)` : ""}`);
