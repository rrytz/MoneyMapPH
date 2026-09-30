// card-padding-check.mjs - a FintechCardContent that passes padding must have a
// reason to, and the reason is structural, not stylistic.
//
// WHY THIS EXISTS, IN ONE PARAGRAPH
//
// `FintechCard` already applies `p-6` to its own surface. A `FintechCardContent`
// that ALSO passes `p-6` therefore renders 22.5px of padding twice: a uniform
// 47px band of dead space above the card's own header row, on every card, at
// every width, in both schemes. Measured on /expenses - card height 196px ->
// 151px at 1280px once the duplicate is removed. Fixed there in b64cfa1, and
// then found at TWELVE more call sites across seven files, all rendering at
// exactly -45px.
//
// WHY A CHECK AND NOT A DISCIPLINE
//
// This is the third appearance of one shape. budgets-page-client.tsx:275-291
// diagnosed the doubled padding, fixed it LOCALLY, and wrote a comment
// explaining why the component must not change. That read as resolution, and the
// class stayed open in twelve other places, unnoticed, indefinitely. A local fix
// is invisible to every mechanism in the repo except this one. It is the same
// shape as the three hand-patched Base UI Selects before 1e01640: the code was
// correct at three sites and the fourth was one copy-paste away, and the reason
// it was one copy-paste away is that nothing could see the three.
//
// A SIBLING, NOT A gate:rules EXTENSION
//
// gate-rules.mjs derives its scope from the gate:all chain, and `src/` is not in
// that chain - the chain holds verifiers, not the components they verify.
// Widening gate-rules to reach application code would break the property that
// makes its scope trustworthy, so this is a separate script with its own
// explicit scope: every .tsx under src/.
//
// WHAT COUNTS AS AN EXCEPTION, AND WHY IT IS STRUCTURAL
//
// `FintechCardContent` defaults to `pt-0` precisely so a body can butt up
// against a real `FintechCardHeader` without a second padding band. So padding
// passed to it is load-bearing in exactly one case: the card has a
// `<FintechCardHeader>` between the enclosing `<FintechCard>` and the content.
// Those sites are correct and are left alone.
//
// Every other site is the defect. That is a checkable claim about the DOM shape,
// not a judgement about taste, which is why this can be a rule instead of a
// review note.
//
// COARSE ON PURPOSE
//
// This is a FLOOR, not a ceiling. A false positive costs one line of suppression
// comment; a false negative is 45px of dead space on a card. The tag scanner is
// deliberately generous about what counts as an opening tag and deliberately
// strict about what counts as a match.

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
 * Extract every `<FintechCardContent ...>` opening tag with its source line.
 *
 * Brace-aware, for the same reason select-items-check.mjs is: a naive
 * `/<FintechCardContent[^>]*>/` stops at the `>` of the first arrow function in
 * an attribute value and returns a truncated tag whose className may be cut off
 * mid-string. The truncation is silent - it reads a site as unpadded when it is
 * padded, which is the shape of failure this project keeps refusing to accept.
 */
function contentTags(source) {
  const tags = [];
  const re = /<FintechCardContent(?=[\s.>])/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    let i = m.index + "<FintechCardContent".length;
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
    tags.push({ text, index: m.index, line: source.slice(0, m.index).split("\n").length });
    re.lastIndex = i;
  }
  return tags;
}

/**
 * Does this className add padding, from the `p-N` scale?
 *
 * `p-0` is explicitly NOT padding here. It is the component's own default intent
 * - "content sits flush inside the card surface" - and it is what the eight
 * header-OUTSIDE sites use once they have let the header own the top padding.
 * Flagging `p-0` as redundant would be flagging the correct value, and a rule
 * that fires on correct code is a rule people learn to ignore.
 *
 * Sided variants (`px-`, `py-`, `pt-`) are NOT counted either. They are not the
 * doubled `p-6` this exists to catch; where they genuinely conflict with the
 * card surface that is a design question, not this defect.
 */
const hasPadding = (tag) => {
  const cn = (tag.text.match(/className\s*=\s*"([^"]*)"/) || [])[1] || "";
  const m = cn.match(/(^|\s)p-(\d+|\[[^\]]+\])(\s|$)/);
  if (!m) return false;
  // `p-0` is the documented correct value on eight header-OUTSIDE sites. Excluded
  // by the value, not by the presence of the token.
  return m[2] !== "0";
};

/**
 * Is there a `<FintechCardHeader>` between the enclosing `<FintechCard>` and this
 * content? That is the one shape in which the padding is load-bearing.
 *
 * Returns null when no enclosing `<FintechCard>` is found, which is reported
 * separately rather than treated as "no header" - an unrecognised shape must not
 * be silently scored as compliant.
 */
function headerOutsideCard(source, index) {
  // Scan backwards for the nearest `<FintechCard`, ATTRIBUTES INCLUDED. The first
  // version of this matched the literal `"<FintechCard>"`, which only appears
  // when the card takes no className - so every `<FintechCard className=...>`
  // was reported as an unrecognised shape. That is this file's own class of bug,
  // committed by the checker: a selector that cannot see the thing it is
  // testing, reporting the result as "needs a human" rather than as a pass.
  const before = source.slice(0, index);
  const open = [...before.matchAll(/<FintechCard(?=[\s.>])[^\n]*?>/g)];
  if (!open.length) return null;
  const cardStart = open[open.length - 1].index;
  return /<FintechCardHeader\b/.test(source.slice(cardStart, index));
}

// The colon is OPTIONAL but the reason is NOT. The first version of the sibling
// select-items pattern required whitespace straight after the keyword, so the
// documented form `// card-padding-ok: <reason>` never matched - the suppression
// was dead code that printed a helpful message on every run while silencing
// nothing. It was found by trying to use it, which is the only way a suppression
// is ever proven.
const SUPPRESSION = /card-padding-ok\s*:?\s*([^\n]*)/;

// Strip the comment syntax off the captured tail, so a suppression whose reason
// is ONLY the closing delimiter still counts as empty and fails.
const bare = (s) =>
  s.replace(/\*\/\}?\s*$/, "").replace(/\}\s*$/, "").replace(/\*\/\s*$/, "").trim();

const files = tsxFiles(SRC);
const findings = [];
const unknownShape = [];
const legitimate = [];
const drift = [];
let total = 0;
let suppressed = 0;

for (const file of files) {
  // Line endings are normalised on READ, not in the pattern. `.` does not match
  // `\r`, so a suppression regex written against LF content is dead against CRLF
  // content and looks exactly like a clean run. This has bitten this file family.
  const raw = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");

  for (const tag of contentTags(raw)) {
    total++;
    if (!hasPadding(tag)) continue;

    const outside = headerOutsideCard(raw, tag.index);
    if (outside === true) {
      // Header outside the content: `p-6` is load-bearing. Correct as written.
      legitimate.push({ file, line: tag.line, text: tag.text });
      continue;
    }

    const above = lines.slice(Math.max(0, tag.line - 8), tag.line - 1).join("\n");
    const m = above.match(SUPPRESSION);
    const reason = m ? bare(m[1]) : "";
    if (m && reason.length > 0) {
      // A suppression silences THIS VALUE, not this site. Verified by injection:
      // changing the suppressed site from p-5 to p-6 must fail the gate again.
      // A suppression bound to the site instead would have let the exact defect
      // this rule exists to catch sit behind a comment written for a milder one -
      // and the injected p-6 DID pass, which is why this branch re-reads the
      // padding and compares it against the value the reason was written for.
      const cn = (tag.text.match(/className\s*=\s*"([^"]*)"/) || [])[1] || "";
      const named = reason.match(/\bp-(\d+)\b/);
      const actual = (cn.match(/(^|\s)p-(\d+|\[[^\]]+\])(\s|$)/) || [])[2];
      if (named && actual && named[1] === actual) {
        suppressed++;
        continue;
      }
      drift.push({
        file: path.relative(ROOT, file).replace(/\\/g, "/"),
        line: tag.line,
        excerpt: tag.text.replace(/\s+/g, " ").slice(0, 90),
        reason: reason.slice(0, 80),
        named: `p-${named[1]}`,
        actual: actual,
      });
      continue;
    }
    const rec = {
      file: path.relative(ROOT, file).replace(/\\/g, "/"),
      line: tag.line,
      excerpt: tag.text.replace(/\s+/g, " ").slice(0, 90),
    };
    if (outside === null) unknownShape.push(rec);
    else findings.push(rec);
  }
}

console.log("=== card-padding: a padded FintechCardContent needs a header outside it ===");
console.log(`  scanned ${files.length} .tsx files under src/`);
console.log(`  FintechCardContent elements found: ${total}`);

if (total === 0) {
  console.error("\n  FAIL  no <FintechCardContent> elements found at all.");
  console.error("  The scan matched nothing, so it has proved nothing. A regex that stops");
  console.error("  matching is indistinguishable from a codebase with no such component -");
  console.error("  and the gate would be green either way. This is the class, in the checker.");
  process.exit(1);
}

console.log(`  padded, header OUTSIDE the content (load-bearing, correct): ${legitimate.length}`);
if (suppressed) console.log(`  suppressed with a stated reason: ${suppressed}`);
console.log(`  findings: ${findings.length + unknownShape.length + drift.length}`);

if (drift.length) {
  console.error(`\n  FAIL  ${drift.length} suppression(s) that no longer describe their site:\n`);
  for (const d of drift) {
    console.error(`  ${d.file}:${d.line}`);
    console.error(`    site is now   ${d.actual}`);
    console.error(`    reason says   ${d.named}`);
    console.error(`    ${d.excerpt}`);
  }
  console.error(
    "\n  A suppression is written for one padding value. If the site now carries a" +
    "\n  DIFFERENT one, the reason no longer applies and the gate must say so -" +
    "\n  otherwise the comment written to excuse a tightening silently excuses the" +
    "\n  doubling that tightening was standing in the way of." +
    "\n\n  Update the reason to name the current value, or remove it and fix the site."
  );
}

if (unknownShape.length) {
  console.error(`\n  FAIL  ${unknownShape.length} padded FintechCardContent with no enclosing`);
  console.error("  <FintechCard> found. The checker cannot tell whether these are correct,");
  console.error("  and scoring an unrecognised shape as compliant is how this rule would");
  console.error("  pass on the very thing it exists to catch.\n");
  for (const f of unknownShape) {
    console.error(`  ${f.file}:${f.line}`);
    console.error(`    ${f.excerpt}`);
  }
}

if (findings.length) {
  console.error(`\n  FAIL  ${findings.length} padded FintechCardContent with no header outside it:\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}`);
    console.error(`    ${f.excerpt}`);
  }
  console.error(
    "\n  FintechCard already applies p-6 to its own surface. Passing p-6 here as" +
    "\n  well renders that padding twice - a 47px band of dead space above the card's" +
    "\n  own header row. Measured -45px of card height per site, at every width." +
    "\n\n  The padding is load-bearing in exactly one shape: a <FintechCardHeader>" +
    "\n  between the enclosing <FintechCard> and this content. These sites have" +
    "\n  their header INSIDE the content, so there is nothing to butt against." +
    "\n\n  If one of these genuinely needs its padding, silence it explicitly, above" +
    "\n  the element:" +
    "\n\n      // card-padding-ok: <reason>" +
    "\n\n  A reason is mandatory and must be non-empty."
  );
}

if (findings.length || unknownShape.length || drift.length) process.exit(1);

console.log(
  `\n  PASS  ${legitimate.length} padded site(s), all with a header outside the content;` +
  `\n        ${total - legitimate.length - suppressed - drift.length} carry no padding;` +
  `\n        ${suppressed} suppressed, each naming the value it excuses.`
);
