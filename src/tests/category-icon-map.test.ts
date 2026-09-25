import { describe, it, expect } from "vitest";
import {
  resolveCategoryIcon,
  normalizeIconKey,
  CATEGORY_ICON_MAP,
  PICKER_ICON_KEYS,
  FALLBACK_ICON_KEY,
  ICON_CHOICES,
} from "@/lib/categories/icon-map";

/**
 * Slice 4 — category icon system.
 *
 * The contract: the stored `icon` column is a single free-text field that has
 * historically held raw emoji (seeded + user-typed). Slice 4 resolves it at
 * READ time through this map. Nothing is written back unless the user picks a
 * new icon in Settings, which writes the canonical Lucide key.
 *
 * These tests pin the four behaviors that keep that safe:
 *   1. every seed + user emoji maps to the reviewed Lucide icon
 *   2. a picker-written Lucide key round-trips (identity)
 *   3. variation-selector forms (🍽️/🛡️/🏍️) normalize, or 3 categories
 *      silently fall back to Package
 *   4. anything unknown/empty is Package — never blank, never a raw glyph
 */

const SEED_EMOJI: Array<[string, string]> = [
  ["🚗", "Car"],
  ["🛒", "ShoppingCart"],
  ["💊", "Pill"],
  ["🍽️", "Utensils"],
  ["💡", "Lightbulb"],
  ["🏠", "House"],
  ["📡", "Antenna"],
  ["💰", "HandCoins"],
  ["🛡️", "ShieldCheck"],
  ["🏍️", "Bike"],
  ["📦", "Package"],
];

// The user's 8 (2026-09-25), unioned with the seeds above.
const USER_EMOJI: Array<[string, string]> = [
  ["🚌", "Bus"],
  ["🛒", "ShoppingCart"],
  ["🧪", "FlaskConical"],
  ["💡", "Lightbulb"],
  ["🏦", "Landmark"],
  ["📦", "Package"],
  ["🍽️", "Utensils"],
  ["💰", "HandCoins"],
];

describe("normalizeIconKey", () => {
  it("strips the variation selector so both forms of the same emoji match", () => {
    expect(normalizeIconKey("🍽️")).toBe(normalizeIconKey("🍽"));
    expect(normalizeIconKey("🛡️")).toBe(normalizeIconKey("🛡"));
    expect(normalizeIconKey("🏍️")).toBe(normalizeIconKey("🏍"));
  });

  it("leaves a bare emoji and a Lucide key unchanged apart from trimming", () => {
    expect(normalizeIconKey("🚗")).toBe("🚗");
    expect(normalizeIconKey("  ShoppingCart ")).toBe("ShoppingCart");
  });
});

describe("resolveCategoryIcon", () => {
  it("maps every seeded emoji to its reviewed Lucide icon", () => {
    for (const [emoji, key] of SEED_EMOJI) {
      expect(resolveCategoryIcon(emoji), `seed ${emoji}`).toBe(key);
    }
  });

  it("maps every one of the user's 8 custom emoji", () => {
    for (const [emoji, key] of USER_EMOJI) {
      expect(resolveCategoryIcon(emoji), `user ${emoji}`).toBe(key);
    }
  });

  it("maps the variation-selector variants (no VS16) to the same icon", () => {
    expect(resolveCategoryIcon("🍽")).toBe("Utensils");
    expect(resolveCategoryIcon("🛡")).toBe("ShieldCheck");
    expect(resolveCategoryIcon("🏍")).toBe("Bike");
  });

  it("passes a picker-written Lucide key straight through", () => {
    for (const key of PICKER_ICON_KEYS) {
      expect(resolveCategoryIcon(key), `key ${key}`).toBe(key);
    }
  });

  it("falls back to Package for unknown emoji (never a raw glyph)", () => {
    expect(resolveCategoryIcon("🦄")).toBe(FALLBACK_ICON_KEY);
    expect(resolveCategoryIcon("🍜")).toBe(FALLBACK_ICON_KEY);
  });

  it("falls back to Package for empty, null and undefined", () => {
    expect(resolveCategoryIcon("")).toBe(FALLBACK_ICON_KEY);
    expect(resolveCategoryIcon(null)).toBe(FALLBACK_ICON_KEY);
    expect(resolveCategoryIcon(undefined)).toBe(FALLBACK_ICON_KEY);
    expect(resolveCategoryIcon("   ")).toBe(FALLBACK_ICON_KEY);
  });

  it("falls back to Package for a non-existent Lucide name", () => {
    expect(resolveCategoryIcon("DefinitelyNotAnIcon")).toBe(FALLBACK_ICON_KEY);
  });
});

describe("map integrity", () => {
  it("exposes exactly the 14 distinct reviewed mappings", () => {
    expect(Object.keys(CATEGORY_ICON_MAP)).toHaveLength(14);
  });

  it("offers every mapped icon in the picker, Package included", () => {
    for (const key of new Set(Object.values(CATEGORY_ICON_MAP))) {
      expect(PICKER_ICON_KEYS, `picker missing ${key}`).toContain(key);
    }
    expect(PICKER_ICON_KEYS).toContain(FALLBACK_ICON_KEY);
  });

  it("exposes a choice list with no duplicates", () => {
    const keys = ICON_CHOICES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
