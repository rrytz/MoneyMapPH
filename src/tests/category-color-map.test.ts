import { describe, it, expect } from "vitest";
import {
  resolveCategoryColor,
  CATEGORY_COLOR_PALETTE,
  PALETTE_KEYS,
  SEED_COLOR_OVERRIDES,
  SEED_EMOJI_COLORS,
} from "@/lib/categories/color-map";

/**
 * Slice 4 — governed 6-tint category palette.
 *
 * Read-time color governance: the stored `color` column keeps whatever hex it
 * was seeded with. Slice 4 never writes it. Instead, a small override table
 * remaps the off-palette seed hexes onto the six governed tints, so the
 * cyan-family seeds (Savings / Emergency Fund / Motorcycle Fund) stop painting
 * cyan without a destructive data migration.
 */

describe("CATEGORY_COLOR_PALETTE", () => {
  it("is exactly six documented tints", () => {
    expect(PALETTE_KEYS).toHaveLength(6);
  });

  it("uses the approved hexes (slate-700 for tint 6, not paper)", () => {
    expect(CATEGORY_COLOR_PALETTE.emerald).toBe("#059669");
    expect(CATEGORY_COLOR_PALETTE.indigo).toBe("#4f46e5");
    expect(CATEGORY_COLOR_PALETTE.amber).toBe("#f59e0b");
    expect(CATEGORY_COLOR_PALETTE.rose).toBe("#f43f5e");
    expect(CATEGORY_COLOR_PALETTE.slate).toBe("#64748b");
    expect(CATEGORY_COLOR_PALETTE.slateDeep).toBe("#334155");
  });

  it("contains no cyan-family hex (the ban holds at the palette level)", () => {
    const banned = [/^#0?6b6d4$/i, /^#0?ea5e9$/i, /^#14b8a6$/i, /^#06b6d4$/i, /^#0ea5e9$/i];
    for (const hex of Object.values(CATEGORY_COLOR_PALETTE)) {
      for (const re of banned) expect(hex, `banned ${hex}`).not.toMatch(re);
    }
  });
});

describe("resolveCategoryColor", () => {
  it("remaps all three cyan-family seed hexes off cyan", () => {
    expect(resolveCategoryColor("#14b8a6")).toBe("#059669"); // Savings      teal
    expect(resolveCategoryColor("#06b6d4")).toBe("#059669"); // Emergency    cyan
    expect(resolveCategoryColor("#0ea5e9")).toBe("#059669"); // Motorcycle   sky
  });

  it("remaps the remaining off-palette seed hexes onto the approved assignment", () => {
    expect(resolveCategoryColor("#8b5cf6")).toBe("#059669"); // Groceries  -> emerald
    expect(resolveCategoryColor("#a855f7")).toBe("#64748b"); // Supplements-> slate
    expect(resolveCategoryColor("#d946ef")).toBe("#f59e0b"); // Eating Out -> amber
    expect(resolveCategoryColor("#ec4899")).toBe("#4f46e5"); // Utilities  -> indigo
    expect(resolveCategoryColor("#6366f1")).toBe("#4f46e5"); // Transport  -> indigo
    expect(resolveCategoryColor("#f97316")).toBe("#64748b"); // Internet   -> slate
  });

  it("never overrides an explicit palette pick, even when it collides with a seed hex", () => {
    // #f43f5e is BOTH the palette rose tint and Rent's legacy seed hex. The
    // user's explicit choice must win over the seed-remap table, so a user
    // who picks rose for any category keeps rose.
    expect(resolveCategoryColor("#f43f5e")).toBe("#f43f5e");
  });

  it("passes a governed palette hex through untouched", () => {
    for (const hex of Object.values(CATEGORY_COLOR_PALETTE)) {
      expect(resolveCategoryColor(hex)).toBe(hex);
    }
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(resolveCategoryColor("  #059669 ")).toBe("#059669");
    expect(resolveCategoryColor("#F43F5E")).toBe("#f43f5e");
  });

  it("falls back to the neutral for a null/empty/garbage color", () => {
    expect(resolveCategoryColor(null)).toBe("#64748b");
    expect(resolveCategoryColor("")).toBe("#64748b");
    expect(resolveCategoryColor("not-a-color")).toBe("#64748b");
  });
});

describe("seed color override table", () => {
  it("overrides the 9 off-palette seeds (Rent + Misc are already governed)", () => {
    // #f43f5e (Rent) and #64748b (Misc) are governed palette hexes, so they
    // are deliberately NOT overridden — an explicit pick must survive. That
    // leaves 9 of the 11 seeds needing a remap.
    expect(Object.keys(SEED_COLOR_OVERRIDES)).toHaveLength(9);
  });

  it("documents all 11 seeded categories with their original hex", () => {
    expect(Object.keys(SEED_EMOJI_COLORS)).toHaveLength(11);
  });

  it("remaps every one of the 11 seed hexes onto the palette", () => {
    const governed = new Set<string>(Object.values(CATEGORY_COLOR_PALETTE));
    for (const [emoji, hex] of Object.entries(SEED_EMOJI_COLORS)) {
      const resolved = resolveCategoryColor(hex);
      expect(governed.has(resolved), `${emoji} (${hex}) resolved off-palette to ${resolved}`).toBe(true);
    }
  });

  it("specifically pulls all three cyan-family seeds off cyan", () => {
    const governed = new Set<string>(Object.values(CATEGORY_COLOR_PALETTE));
    for (const hex of ["#14b8a6", "#06b6d4", "#0ea5e9"]) {
      const resolved = resolveCategoryColor(hex);
      expect(governed.has(resolved)).toBe(true);
      expect(resolved).toBe("#059669");
    }
  });
});
