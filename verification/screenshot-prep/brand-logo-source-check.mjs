// gate:logo-source — the SOURCE half of the brand-mark invariant.
//
// WHY THIS EXISTS, AND WHY IT IS SEPARATE FROM THE RENDERED CHECK
//
// `gate:brand` asserts the rendered colour is identical in light and dark. That
// is the RENDERED SHADOW of "the fill is currentColor" — and it is a strictly
// weaker claim.
//
//     A hardcoded fill that happens to be the same in both schemes PASSES the
//     rendered check and violates the source rule, because it is equally
//     theme-independent and equally wrong.
//
// That is not hypothetical. Real logo files are full of fill="#FFFFFF",
// gradient defs and background fields. A mark pasted with any of those renders
// identically in both colour schemes, so every rendered assertion passes, and
// the card carries a second unchecked colour source sitting on the same surface
// as the text. Both controls are needed and neither replaces the other.
//
// This runs BEFORE the rendered brand gates, because the point of a source check
// is to reject the asset before a browser ever sees it.
//
// WHAT IT REJECTS, per the brand-logo contract
//
//   hardcoded / theme / pasted-white fills   any fill that is not currentColor
//   opacity and fill-opacity                 tonal variation
//   gradients and <image>                   not a flat monochrome mark
//   <rect> background fields                a background is not a mark
//   shapes with no fill at all               must be explicit, never implicit
//
// The escape hatch is `rules:ok <reason>` in a comment, consistent with
// gate:rules.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const FILE = path.join(ROOT, "src/lib/utils/brand-logos.tsx");

// Line endings are normalised on read, not handled per-pattern: in JavaScript `.`
// does not match a carriage return, so `$`-anchored patterns silently never fire
// on CRLF input. Same class as the d5520a3 finding, same fix.
const src = fs.readFileSync(FILE, "utf8").replace(/\r\n?/g, "\n");
const lines = src.split("\n");

// The `paths` values, with the line each starts on so a finding is locatable.
const entries = [];
const entryRe = /^\s{2}([a-z]+):\s*\{\s*w:\s*([\d.]+),\s*h:\s*([\d.]+),\s*paths:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*\}/;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(entryRe);
  if (!m) continue;
  const raw = m[4] !== undefined ? m[4] : m[5];
  let paths = "";
  try {
    paths = m[4] !== undefined ? JSON.parse(`"${raw}"`) : raw;
  } catch {
    paths = raw;
  }
  entries.push({ brand: m[1], w: Number(m[2]), h: Number(m[3]), paths, line: i + 1, empty: paths === "" });
}

const findings = [];
const fail = (brand, line, msg) => findings.push({ brand, line, msg });

const SHAPE_RE = /<(path|rect|circle|ellipse|polygon|polyline)\b([^>]*?)\/?>/g;
const FORBIDDEN = [
  { re: /<linearGradient|<radialGradient|<pattern\b|<image\b/i, msg: "gradient/pattern/<image> is not a flat monochrome mark" },
  { re: /\b(?:opacity|fill-opacity|stroke-opacity)\s*=/i, msg: "opacity is tonal variation, which the contract forbids" },
  { re: /\bstyle\s*=/i, msg: "inline style carries a fill the source check cannot see" },
  { re: /\bfill\s*=\s*"(?!currentColor)[^"]*"/i, msg: "a fill that is not currentColor - hardcoded, theme, or pasted white" },
  { re: /\bfill\s*=\s*'(?!currentColor)[^']*'/i, msg: "a fill that is not currentColor - hardcoded, theme, or pasted white" },
  { re: /\bstroke\s*=/i, msg: "a stroked shape is not a filled monochrome mark" },
  { re: /<rect\b/i, msg: "<rect> is either a background field or a counter; neither is allowed in a mark" },
];

for (const e of entries) {
  // An empty slot is a stated TODO, not a violation. The rendered gate is what
  // requires a card to actually render a monogram, so this check must not also
  // demand that every brand have an asset.
  if (e.empty) continue;

  if (!(e.w > 0 && e.h > 0)) {
    fail(e.brand, e.line, `degenerate intrinsic size w=${e.w} h=${e.h} - a mark with no size resolves to the monogram and the width is never asserted`);
  }

  const shapes = [...e.paths.matchAll(SHAPE_RE)];
  if (shapes.length === 0) fail(e.brand, e.line, "no drawable shape found in paths - the mark would render empty");

  for (const s of shapes) {
    const tag = s[1];
    const attrs = s[2] || "";
    for (const f of FORBIDDEN) {
      const probe = `<${tag}${attrs}>`;
      if (f.re.test(probe)) fail(e.brand, e.line, `<${tag}> ${f.msg}`);
    }
    if (!/fill\s*=\s*"currentColor"/.test(attrs)) {
      fail(e.brand, e.line, `<${tag}> has no explicit fill="currentColor" - the rule is per-path, never inherited from the <svg>`);
    }
  }
}

const filled = entries.filter((e) => !e.empty).length;
console.log("=== gate:logo-source — every path explicitly currentColor ===");
console.log(`  ${entries.length} brand slot(s) in brand-logos.tsx, ${filled} filled, ${entries.length - filled} monogram placeholder(s)`);

if (findings.length === 0) {
  console.log("  PASS  no hardcoded, theme, or white fills; no opacity; no gradients; no background rects.");
  console.log("        Every shape in every mark carries an explicit fill=\"currentColor\".");
} else {
  console.log("");
  for (const f of findings) console.log(`  FAIL  ${f.brand} (line ${f.line}): ${f.msg}`);
}

console.log("");
process.exit(findings.length === 0 ? 0 : 1);
