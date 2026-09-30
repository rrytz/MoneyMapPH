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
//   full-canvas background shapes           see BACKGROUND BY COVERAGE below
//
// The escape hatch is `rules:ok <reason>` in a comment, consistent with
// gate:rules.
//
// ------------------------------------------------------------------
// BACKGROUND, BY COVERAGE - NOT BY TAG NAME
// ------------------------------------------------------------------
//
// The first stripper looked for <rect>. UnionBank's asset authored its
// background as <polygon points="0 43.9 179.8 43.9 179.8 0 0 0"> - a
// full-canvas shape wearing a different tag. The stripper missed it, the
// polygon took currentColor, and the card rendered a solid white rectangle 77px
// wide. It passed every other rule in this file.
//
// So the rule is COVERAGE, never tag name: any shape whose geometry spans
// effectively the whole viewBox is a background, whatever element it is called.
// "Look for <rect> and also <polygon>" is the same mistake a second time - a
// filter listing the cases seen rather than the property they share, which is
// how a regex matching one line ending and not another gets written.
//
// A path is judged on the extent of its coordinate values, which is
// conservative: it over-reports rather than under-reports, because a false
// rejection is a TODO and a false pass is a rectangle on the card.
//
// ------------------------------------------------------------------
// ASSUMPTION: assets must not rely on GROUP TRANSFORMS
// ------------------------------------------------------------------
//
// The conversion pipeline keeps flat shape elements and DISCARDS the <g>
// wrappers around them, including their transforms. UnionBank carried two
// <g transform="translate(...)"> wrappers, so positioning was lost along with
// the masks. It was rejected for the masks, so the transform loss was never the
// visible failure - but any asset relying on a group transform to position its
// own paths will render them displaced, while passing every rule in this file.
//
// Flattening transforms during conversion is the better fix and is NOT done
// here; it needs its own verification, because silently rewriting coordinates is
// right in principle and easy to get wrong in practice. Until it exists the
// assumption is stated rather than left as an incidental property of a
// throwaway script: ASSETS MUST USE ABSOLUTE POSITIONS.

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
  // A <rect> that is NOT full-canvas is a counter (a hole punched in a mark) and\n  // is still rejected: authored in the asset's own white or any other colour, it\n  // becomes a pasted white fill the moment it takes currentColor. Full-canvas\n  // rects are caught by the COVERAGE rule below, which is tag-agnostic.\n  { re: /<rect\b/i, msg: "<rect> is a counter or a background; counters become a pasted white fill once currentColor, and backgrounds belong to the page, not the mark" },
];


// ---------------------------------------------------------------- geometry
// "Does this shape cover the whole viewBox?" - COVERAGE, not tag name.
//
// Every element that can describe an area is measured the same way, so adding a
// new shape tag to some future asset cannot smuggle a background past this by
// wearing a different name. Bounding boxes, not exact geometry: cheap, and the
// error direction is toward rejection.
const num = (v) => {
  const m = String(v ?? "").match(/-?\d*\.?\d+(?:e-?\d+)?/i);
  return m ? Number(m[0]) : NaN;
};

/** [minX, minY, maxX, maxY] of a shape, or null when it cannot be determined. */
const bbox = (tag, attrs) => {
  const a = (n) => num((attrs.match(new RegExp(`\\b${n}="([^"]*)"`)) || [])[1]);
  if (tag === "rect") {
    const x = a("x") || 0, y = a("y") || 0, w = a("width"), h = a("height");
    if (!isFinite(w) || !isFinite(h)) return null;
    return [x, y, x + w, y + h];
  }
  if (tag === "circle") {
    const cx = a("cx") || 0, cy = a("cy") || 0, r = a("r");
    if (!isFinite(r)) return null;
    return [cx - r, cy - r, cx + r, cy + r];
  }
  if (tag === "ellipse") {
    const cx = a("cx") || 0, cy = a("cy") || 0, rx = a("rx"), ry = a("ry");
    if (!isFinite(rx) || !isFinite(ry)) return null;
    return [cx - rx, cy - ry, cx + rx, cy + ry];
  }
  if (tag === "polygon" || tag === "polyline") {
    const pts = (attrs.match(/points="([^"]*)"/) || [])[1];
    if (!pts) return null;
    const n = pts.trim().split(/[\s,]+/).map(Number).filter((v) => isFinite(v));
    if (n.length < 4) return null;
    const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  return null;
}

// WHY <path> IS EXCLUDED, which is a property and not an oversight.
//
// The rule asks whether a shape is a BACKGROUND. The signal is coverage, and
// coverage only carries that meaning for a shape that is SOLID BY CONSTRUCTION
// - rect, circle, ellipse, and a polygon whose points trace the canvas. Those
// are filled regions: if the box is the whole canvas, the painted area is the
// whole canvas.
//
// A <path> is arbitrary geometry. Its bounding box routinely spans the whole
// viewBox and that means nothing about its AREA: every wordmark does it, because
// the first letter reaches the left edge and the last reaches the right, and the
// gaps between letters are not painted. Applying coverage to paths flagged Maya
// and PayPal - both correct wordmarks - on the first run.
//
// So the distinction is "solid by construction" versus "arbitrary geometry", not
// "the tags I happened to see". A path-based background would slip past; that is
// a real gap and it is stated rather than hidden, because closing it needs area
// computation (an SVG rasteriser or a boolean-geometry pass), not a bigger
// tag list.
const SOLID_SHAPES = new Set(["rect", "circle", "ellipse", "polygon"]);

const COVERAGE = 0.9; // a background that covers >=90% of each axis is a background
const coversViewBox = (tag, attrs, w, h) => {
  if (!SOLID_SHAPES.has(tag)) return false;
  const b = bbox(tag, attrs);
  if (!b) return false;
  return (b[2] - b[0]) / w >= COVERAGE && (b[3] - b[1]) / h >= COVERAGE;
};
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
    // THE COVERAGE RULE. Tag-agnostic on purpose: <polygon> is what UnionBank
    // used, and a rule that only knew about <rect> passed it.
    if (coversViewBox(tag, attrs, e.w, e.h)) {
      fail(e.brand, e.line, `<${tag}> covers the whole viewBox (${e.w}x${e.h}) - that is a BACKGROUND field, not a mark, whatever element it is called`);
    }
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

// An empty scan set must not pass. `entries` is built by a regex over
// brand-logos.tsx, so a reformat that the entry pattern no longer matches
// yields zero entries, zero findings, and the PASS below - success on a scan
// that saw nothing. The per-entry guard further down only fires for entries
// that were found, so it cannot catch this. Same total===0 shape as the
// sibling source checks.
if (entries.length === 0) {
  console.error("  FAIL  scanned brand-logos.tsx, matched 0 brand slots - the entry pattern matched nothing, so it has proved nothing.");
  process.exit(1);
}

if (findings.length === 0) {
  console.log("  PASS  no hardcoded, theme, or white fills; no opacity; no gradients; no background rects.");
  console.log("        Every shape in every mark carries an explicit fill=\"currentColor\".");
} else {
  console.log("");
  for (const f of findings) console.log(`  FAIL  ${f.brand} (line ${f.line}): ${f.msg}`);
}

console.log("");
process.exit(findings.length === 0 ? 0 : 1);
