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

  it("uses the Tide hexes (water-adjacent neutrals, not stone)", () => {
    expect(CATEGORY_COLOR_PALETTE.sulpot).toBe("#0b8f45");
    expect(CATEGORY_COLOR_PALETTE.indigo).toBe("#4b4bc4");
    expect(CATEGORY_COLOR_PALETTE.amber).toBe("#c97a0a");
    expect(CATEGORY_COLOR_PALETTE.rose).toBe("#e0455b");
    // R1: the stone slot failed contrast on paper, so both neutrals are
    // water-adjacent and read against --paper (#f1f4f0).
    expect(CATEGORY_COLOR_PALETTE.water).toBe("#1e5f8c");
    expect(CATEGORY_COLOR_PALETTE.channel).toBe("#14496b");
  });

  it("has no tint within stone-on-paper contrast failure (both neutrals read)", () => {
    // WCAG relative luminance contrast of each neutral against the Tide paper.
    const srgb = (h: string) => {
      const n = parseInt(h.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
    };
    const lum = (h: string) => {
      const [r, g, b] = srgb(h);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const PAPER = "#f1f4f0";
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    // Data colors must clear 3:1 (non-text graphical) on paper.
    for (const [name, hex] of Object.entries(CATEGORY_COLOR_PALETTE)) {
      expect(contrast(hex, PAPER), `${name} ${hex} vs paper`).toBeGreaterThanOrEqual(3);
    }
  });

  it("contains no cyan-family hex (the ban holds at the palette level)", () => {
    const banned = [/^#0?6b6d4$/i, /^#0?ea5e9$/i, /^#14b8a6$/i, /^#06b6d4$/i, /^#0ea5e9$/i];
    for (const hex of Object.values(CATEGORY_COLOR_PALETTE)) {
      for (const re of banned) expect(hex, `banned ${hex}`).not.toMatch(re);
    }
  });

  it("keeps the neutrals outside the teal family (water-adjacent, not teal)", () => {
    // A teal is G≈B with both high. The neutrals are deep desaturated blues:
    // B > G and both are low. Guard the boundary so a future edit cannot drift.
    for (const hex of [CATEGORY_COLOR_PALETTE.water, CATEGORY_COLOR_PALETTE.channel]) {
      const n = parseInt(hex.slice(1), 16);
      const g = (n >> 8) & 255;
      const b = n & 255;
      expect(b, `${hex} should read blue, not teal`).toBeGreaterThan(g);
      expect(Math.max(g, b), `${hex} should stay dark`).toBeLessThan(160);
    }
  });
});

describe("resolveCategoryColor", () => {
  it("remaps all three cyan-family seed hexes off cyan", () => {
    expect(resolveCategoryColor("#14b8a6")).toBe("#0b8f45"); // Savings      teal
    expect(resolveCategoryColor("#06b6d4")).toBe("#0b8f45"); // Emergency    cyan
    expect(resolveCategoryColor("#0ea5e9")).toBe("#0b8f45"); // Motorcycle   sky
  });

  it("remaps the remaining off-palette seed hexes onto the approved assignment", () => {
    expect(resolveCategoryColor("#8b5cf6")).toBe("#0b8f45"); // Groceries   -> sulpot
    expect(resolveCategoryColor("#a855f7")).toBe("#14496b"); // Supplements -> channel
    expect(resolveCategoryColor("#d946ef")).toBe("#c97a0a"); // Eating Out  -> amber
    expect(resolveCategoryColor("#ec4899")).toBe("#1e5f8c"); // Utilities   -> water
    expect(resolveCategoryColor("#6366f1")).toBe("#1e5f8c"); // Transport   -> water
    expect(resolveCategoryColor("#f97316")).toBe("#14496b"); // Internet    -> channel
    expect(resolveCategoryColor("#f43f5e")).toBe("#1e5f8c"); // Rent        -> water
    expect(resolveCategoryColor("#64748b")).toBe("#14496b"); // Misc        -> channel
  });

  it("resolves the Ruling P collision now that the palette rose changed", () => {
    // S4 had to let Rent render rose because palette rose (#f43f5e) was
    // indistinguishable from Rent's seed hex. Tide rose is #e0455b, so Rent
    // can take the indigo-role tint the original approved table specified.
    expect(CATEGORY_COLOR_PALETTE.rose).not.toBe("#f43f5e");
    expect(resolveCategoryColor("#f43f5e")).toBe(CATEGORY_COLOR_PALETTE.water);
  });

  it("passes a governed palette hex through untouched", () => {
    for (const hex of Object.values(CATEGORY_COLOR_PALETTE)) {
      expect(resolveCategoryColor(hex)).toBe(hex);
    }
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(resolveCategoryColor("  #0b8f45 ")).toBe("#0b8f45");
    expect(resolveCategoryColor("#E0455B")).toBe("#e0455b");
  });

  it("falls back to the neutral for a null/empty/garbage color", () => {
    expect(resolveCategoryColor(null)).toBe("#14496b");
    expect(resolveCategoryColor("")).toBe("#14496b");
    expect(resolveCategoryColor("not-a-color")).toBe("#14496b");
  });
});

describe("seed color override table", () => {
  it("overrides all 11 seeded categories (no stone slots remain)", () => {
    // S4 left 2 seeds un-overridden because they collided with the old palette.
    // Tide's palette rose moved, so all 11 seeds now have a governed target.
    expect(Object.keys(SEED_COLOR_OVERRIDES)).toHaveLength(11);
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
      expect(resolved).toBe("#0b8f45");
    }
  });
});
