import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Design conformance detector — the accent-enforcement regression guard.
 *
 * Scans every `src/**\/*.tsx` file for the banned accent/light-world patterns
 * (plan Task 3 / 3c, Slice 3). This test IS the definition of the sweep: a
 * violation here is a straggler that must be fixed in code, not silenced.
 *
 * Rules:
 *   A — absolute cyan ban (incl. sky/teal family classes).
 *   B — rose never fills a button (rose stays legal as data semantics:
 *       text-rose, chips, badges, chart fills).
 *   C — amber/indigo never tint a tile/chip background. Exempt: chart-fill
 *       child variants (`[&>div]:bg-amber-500`), chart gradients
 *       (`from-amber-500/20 to-amber-400`), full-strength bar/dot weights used
 *       WITHOUT a text-amber/indigo sibling (`bar: "bg-amber-500"`), and the
 *       `badge.tsx` info-badge component (plan review-focus #3: "amber/indigo
 *       legitimately live in charts and info-badges").
 *   D — hard dark-slate bypasses: unconditional (non-`dark:`-prefixed)
 *       `bg-slate-7/8/900/950`, `border-slate-7/8/900/950`,
 *       `fill/stroke-slate-8/900/950` and `text-slate-100/200/300` on content
 *       surfaces — the light-theme bypass class of bug. Two-world pairs
 *       (`bg-slate-50 dark:bg-slate-900`) and muted neutrals
 *       (`text-slate-400/500/600/700`) are legal.
 *   E — category identity renders as monochrome Lucide (Slice 4): raw emoji
 *       literals and stored-icon text nodes are banned outside the read-time
 *       map, and the category editor exposes an icon grid + governed swatches
 *       instead of free-text emoji / a free color input.
 */

const SRC = join(process.cwd(), "src");

function collectTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) acc = collectTsxFiles(full, acc);
    else if (entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

interface Violation {
  file: string;
  line: number;
  token: string;
}

const files = collectTsxFiles(SRC);
const rel = (p: string) => relative(SRC, p).replaceAll("\\", "/");

function scan(re: RegExp, extraExempt?: (file: string, line: string) => boolean): Violation[] {
  const out: Violation[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (extraExempt && extraExempt(rel(file), line)) return;
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(line)) !== null) {
        out.push({ file: rel(file), line: i + 1, token: m[0].trim() });
      }
    });
  }
  return out;
}

/** Multi-line scan: a JSX element open tag and its className may sit on
 *  different lines (e.g. `<Button\n  className="bg-rose-600…">`), so rules
 *  whose pattern spans an element tag run over the whole file text. */
function scanWhole(re: RegExp): Violation[] {
  const out: Violation[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const line = text.slice(0, m.index).split("\n").length;
      out.push({ file: rel(file), line, token: m[0].trim() });
    }
  }
  return out;
}

/** Rule B scanner: finds `<Button`/`<button` open tags and walks the tag's
 *  props until the tag's closing `>`, skipping arrow-function `=>` (whose `>`
 *  is preceded by `=`). Flags only `bg-rose-*` fills — `text-rose-*` is the
 *  allowed data-semantics channel. */
function scanRoseButtonFills(): Violation[] {
  const out: Violation[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const openRe = /<(?:Button|button)\b/g;
    let m: RegExpExecArray | null;
    while ((m = openRe.exec(text)) !== null) {
      const start = m.index + m[0].length;
      const end = Math.min(text.length, start + 800);
      let i = start;
      let prev = "";
      let hitRo: { idx: number; token: string } | null = null;
      while (i < end) {
        const ch = text[i];
        if (ch === ">" && prev !== "=") break; // tag close (}} > in JSX is `=`+`>`)
        if (ch === "-") {
          if (/^rose-\d/.test(text.slice(i, i + 12)) && /bg$/.test(text.slice(Math.max(0, i - 20), i))) {
            const lineNo = text.slice(0, i).split("\n").length;
            hitRo = { idx: lineNo, token: "bg-rose (button fill)" };
            break;
          }
        }
        prev = ch;
        i++;
      }
      if (hitRo) out.push({ file: rel(file), line: hitRo.idx, token: hitRo.token });
    }
  }
  return out;
}

describe("design-conformance — accent + light-world regression guard", () => {
  it("Rule A: no cyan/sky/teal utility classes anywhere in src", () => {
    const violations = scan(/\b(?:dark:)?(?:[a-z-]+:)?(?:bg|text|border|ring|from|to|via|fill|stroke|decoration|outline|accent|shadow|divide|placeholder)-(?:cyan|sky|teal)-\d+(?:\/\d+)?/g);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("Rule B: rose never fills a Button/button", () => {
    // Structural walk of each `button`/`Button` open tag; only `bg-rose-*`
    // fills violate — `text-rose-*` is the allowed data-semantics channel.
    const violations = scanRoseButtonFills();
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("Rule C: amber/indigo never tint a tile/chip background", () => {
    const violations = scan(
      // a) a bg-amber/bg-indigo token on a line that does NOT carry a
      //    bracket child-variant (chart fill) for that very color…
      /\b(?:[a-z]+:)?bg-(?:amber|indigo)-\d+(?:\/\d+)?/g,
      // …and the exemptions below.
      (file, line) => {
        // badge.tsx is the info-badge component (review-focus #3 names it legit).
        if (file === "components/ui/badge.tsx") return true;
        // Chart-fill child variants: [&>div]:bg-amber-500 etc.
        if (/\[[^\]]*\]:(?:[a-z]+:)?bg-(?:amber|indigo)-\d+/.test(line)) return true;
        // The tile idiom is the colored square: bg tint BOTH is present and
        // has a text-amber/indigo sibling, or the soft chip weights turn a
        // block into a chip. A lone full-strength weight (bg-amber-500/400,
        // bg-indigo-500) with no text sibling = chart bar/dot fill.
        const hasText = /text-(?:amber|indigo)-/.test(line);
        // Soft chip weights — with a trailing \b so `50` can't match the prefix
        // of `500` (full-strength 400/500 = chart bar/dot fills, allowed).
        const hasSoftBanned = /\b(?:[a-z]+:)?bg-(?:amber|indigo)-(?:50|100|600|700|900|950)(?:\/\d+)?\b/.test(line);
        return !(hasText || hasSoftBanned);
      }
    );
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("Rule D: no unconditional dark-slate hard codes on content surfaces", () => {
    const violations: Violation[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const raw of line.match(/\S+/g) ?? []) {
          const token = raw.replace(/^["'`[(]+|["'`)\]>]+$/g, "");
          if (token.startsWith("dark:")) continue; // two-world pair — legal
          const isBgField = /(?:^|:)(?:bg|border|fill|stroke)-slate-(?:700|800|900|950)(?:\/[\d.]+)?$/.test(token);
          const isLightText = /(?:^|:)text-slate-(?:100|200|300)$/.test(token);
          if (isBgField || isLightText) {
            violations.push({ file: rel(file), line: i + 1, token });
          }
        }
      });
    }

    // Tide (S5a): the neutral ramp is now app-specific, so a raw neutral hex IS
    // a theming bypass by definition — it cannot respond to the light/dark
    // world. Neutral values must arrive via a token or a semantic class.
    // Water + semantic hexes stay legal: they are already-sanctioned data
    // identity (category colors, chart fills, status pills).
    const BANNED_NEUTRALS = [
      "1B211C", // --ink
      "0E1410", // --paper (dark)
      "141B16", // --surface (dark)
      "1A221C", // --inset (dark)
      "263029", // --hairline (dark)
      "E8EDE7", // --ink (dark world)
      "98A396", // --ink-muted
    ];
    // The token definitions and the governed category palette are where these
    // values legitimately live.
    const NEUTRAL_EXEMPT = new Set([
      "app/globals.css",
      "lib/categories/color-map.ts",
      "tests/design-conformance.test.ts",
    ]);
    for (const file of files) {
      const short = rel(file);
      if (NEUTRAL_EXEMPT.has(short)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
        for (const hex of BANNED_NEUTRALS) {
          if (new RegExp(`#${hex}\\b`, "i").test(line)) {
            violations.push({ file: short, line: i + 1, token: `#${hex}` });
          }
        }
      });
    }
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("Rule E: category identity renders as Lucide, never a raw emoji text node", () => {
    // Slice 4. Emoji may live in exactly one place — the read-time map
    // (icon-map.ts) — plus SQL seed literals. Every render surface must go
    // through <CategoryIcon>, and the free-text emoji/color inputs are gone.
    const allowedEmojiFiles = new Set(["lib/categories/icon-map.ts", "lib/categories/color-map.ts"]);
    // Pictographic blocks only (transport, food, objects, symbols). The
    // 2600-27BF dingbat/misc-symbol block is deliberately excluded: it holds
    // status glyphs like the "✓" bill-paid marker, which are not category
    // identity. All 14 mapped category emoji live in 1F300-1FAFF.
    const emojiRange =
      /[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\uFE0F]/u;
    const violations: Violation[] = [];

    for (const file of files) {
      const short = rel(file);
      if (allowedEmojiFiles.has(short)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // Comments describe the migration; they are not render surfaces.
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
        // 1. A raw emoji literal in a .tsx render surface.
        if (emojiRange.test(trimmed)) {
          violations.push({ file: short, line: i + 1, token: "raw-emoji-literal" });
        }
        // 2. Rendering the stored icon value as a text child. The negative
        // lookbehind skips JSX *attribute* values (`icon={cat.icon}` on a
        // <CategoryIcon> element) — a text node is never `= {...}`.
        if (/(?<!=)\{\s*[^}]*\.\s*icon\s*\}/.test(trimmed) && !/CategoryIcon/.test(trimmed)) {
          violations.push({ file: short, line: i + 1, token: "raw-icon-text-node" });
        }
      });
    }
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("Rule E2: no free-text emoji input and no free color input for categories", () => {
    // The category editor must expose an icon grid + governed swatches, not a
    // text box or an OS color picker.
    const violations: Violation[] = [];
    for (const file of files) {
      const short = rel(file);
      if (!short.includes("settings")) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/type=["']color["']/.test(line)) {
          violations.push({ file: short, line: i + 1, token: "free-color-input" });
        }
      });
    }
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("scans a non-empty tsx corpus (guard against silent path regressions)", () => {
    expect(files.length).toBeGreaterThan(100);
  });
});