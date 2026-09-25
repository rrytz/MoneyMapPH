import type { LucideIcon } from "lucide-react";

/**
 * Slice 4 — category icon map (read-time, non-destructive).
 *
 * The `expense_categories.icon` column is a single free-text field that has
 * always held raw emoji. Slice 4 does NOT migrate it. Every render path
 * resolves the stored string through this module, so legacy emoji keep working
 * while the Settings picker starts writing canonical Lucide keys.
 *
 * Two guarantees:
 *   - a Lucide key round-trips (identity), so picker writes need no backfill
 *   - anything unknown/empty resolves to `Package` — never blank, never a raw
 *     glyph leaking into the DOM
 *
 * This module is intentionally PURE (strings only, no React). The
 * key -> LucideIcon component lookup lives in the component layer.
 */

export type IconKey = string;

export const FALLBACK_ICON_KEY: IconKey = "Package";

/** Emoji -> Lucide icon key. Covers the 11 seeds and all 8 user categories. */
export const CATEGORY_ICON_MAP: Record<string, IconKey> = {
  // seeds
  "🚗": "Car",
  "🛒": "ShoppingCart",
  "💊": "Pill",
  "🍽": "Utensils",
  "💡": "Lightbulb",
  "🏠": "House",
  "📡": "Antenna",
  "💰": "HandCoins",
  "🛡": "ShieldCheck",
  "🏍": "Bike",
  "📦": "Package",
  // user categories
  "🚌": "Bus",
  "🧪": "FlaskConical",
  "🏦": "Landmark",
};

/** Picker order — stable, Package last so the fallback reads as the last resort. */
export const ICON_CHOICES: Array<{ key: IconKey; label: string }> = [
  { key: "Car", label: "Car" },
  { key: "Bus", label: "Bus" },
  { key: "ShoppingCart", label: "Groceries" },
  { key: "Pill", label: "Medicine" },
  { key: "FlaskConical", label: "Supplements" },
  { key: "Utensils", label: "Food" },
  { key: "Lightbulb", label: "Utilities" },
  { key: "House", label: "Home" },
  { key: "Antenna", label: "Internet" },
  { key: "HandCoins", label: "Savings" },
  { key: "ShieldCheck", label: "Protection" },
  { key: "Bike", label: "Motorcycle" },
  { key: "Landmark", label: "Bank" },
  { key: FALLBACK_ICON_KEY, label: "Package" },
];

const VARIATION_SELECTOR = /[\uFE0E\uFE0F]/g;
const ZERO_WIDTH_JOINER = /\u200D/g;
const SKIN_TONE = /[\u{1F3FB}-\u{1F3FF}]/gu;

/**
 * Collapse the ways one emoji can be typed.
 *
 * `🍽️` (U+1F37D U+FE0F) and `🍽` (U+1F37D) are the same character to a user
 * but different strings to a lookup. Three of the seeded emoji are stored WITH
 * the variation selector and eight without, so without this the three VS16
 * ones would silently fall back to Package.
 */
export function normalizeIconKey(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFC")
    .replace(SKIN_TONE, "")
    .replace(ZERO_WIDTH_JOINER, "")
    .replace(VARIATION_SELECTOR, "")
    .trim();
}

export const PICKER_ICON_KEYS: IconKey[] = ICON_CHOICES.map((c) => c.key);

const EMOJI_TO_KEY = new Map<string, string>(
  Object.entries(CATEGORY_ICON_MAP).map(([emoji, key]) => [normalizeIconKey(emoji), key])
);
const KNOWN_KEYS = new Set(PICKER_ICON_KEYS);

/**
 * Resolve any stored `icon` value to a canonical Lucide key.
 * Always returns a defined key — `Package` when nothing matches.
 */
export function resolveCategoryIcon(icon: string | null | undefined): string {
  const normalized = normalizeIconKey(icon);
  if (!normalized) return FALLBACK_ICON_KEY;
  if (KNOWN_KEYS.has(normalized)) return normalized;
  return EMOJI_TO_KEY.get(normalized) ?? FALLBACK_ICON_KEY;
}
