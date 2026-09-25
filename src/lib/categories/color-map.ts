/**
 * Slice 4 — governed 6-tint category palette (read-time, non-destructive).
 *
 * The `expense_categories.color` column is a free-text hex. Slice 4 never
 * writes it. A small override table maps the legacy seed hexes onto the six
 * governed tints, so the three cyan-family seeds (Savings / Emergency Fund /
 * Motorcycle Fund) stop painting cyan without a destructive data migration.
 *
 * Precedence (important):
 *   1. a governed palette hex passes through untouched — an explicit user pick
 *      always wins, even if that hex collides with a legacy seed hex
 *   2. a known off-palette seed hex is remapped onto its governed tint
 *   3. anything else falls back to the neutral
 *
 * That ordering means #f43f5e stays rose for a user who picked it, rather than
 * being force-remapped by the Rent seed remap.
 */

export const CATEGORY_COLOR_PALETTE = {
  emerald: "#059669",
  indigo: "#4f46e5",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#64748b",
  slateDeep: "#334155",
} as const;

export type PaletteKey = keyof typeof CATEGORY_COLOR_PALETTE;
export const PALETTE_KEYS: PaletteKey[] = [
  "emerald",
  "indigo",
  "amber",
  "rose",
  "slate",
  "slateDeep",
];

/** Human labels for the Settings swatch picker. */
export const PALETTE_LABELS: Record<PaletteKey, string> = {
  emerald: "Emerald",
  indigo: "Indigo",
  amber: "Amber",
  rose: "Rose",
  slate: "Slate",
  slateDeep: "Slate (deep)",
};

const NEUTRAL = CATEGORY_COLOR_PALETTE.slate;

/**
 * Legacy seed hexes -> governed tint.
 * The three cyan rows are the load-bearing entries (Slice 3 banned cyan at the
 * CSS layer; this closes it at the data layer).
 */
export const SEED_COLOR_OVERRIDES: Record<string, string> = {
  // --- cyan family (the three that must stop painting cyan) ---
  "#14b8a6": CATEGORY_COLOR_PALETTE.emerald, // Savings          (teal-500)
  "#06b6d4": CATEGORY_COLOR_PALETTE.emerald, // Emergency Fund   (cyan-500)
  "#0ea5e9": CATEGORY_COLOR_PALETTE.emerald, // Motorcycle Fund  (sky-500)
  // --- rainbow seeds folded onto the governed tints ---
  "#8b5cf6": CATEGORY_COLOR_PALETTE.emerald, // Groceries        (violet)
  "#a855f7": CATEGORY_COLOR_PALETTE.slate, // Supplements      (purple)
  "#d946ef": CATEGORY_COLOR_PALETTE.amber, // Eating Out       (fuchsia)
  "#ec4899": CATEGORY_COLOR_PALETTE.indigo, // Utilities        (pink)
  "#6366f1": CATEGORY_COLOR_PALETTE.indigo, // Transportation   (indigo)
  "#f97316": CATEGORY_COLOR_PALETTE.slate, // Internet         (orange)
  // #f43f5e (Rent) and #64748b (Misc) are already governed palette hexes and
  // therefore deliberately absent here — see the precedence note above.
};

/** The 11 seeded categories and their original stored hex (for tests/docs). */
export const SEED_EMOJI_COLORS: Record<string, string> = {
  "🚗": "#6366f1", // Transportation
  "🛒": "#8b5cf6", // Groceries
  "💊": "#a855f7", // Supplements
  "🍽": "#d946ef", // Eating Out
  "💡": "#ec4899", // Utilities
  "🏠": "#f43f5e", // Rent
  "📡": "#f97316", // Internet
  "💰": "#14b8a6", // Savings
  "🛡": "#06b6d4", // Emergency Fund
  "🏍": "#0ea5e9", // Motorcycle Fund
  "📦": "#64748b", // Miscellaneous
};

const GOVERNED = new Set<string>(Object.values(CATEGORY_COLOR_PALETTE));

/**
 * Resolve any stored color to a governed, renderable hex.
 * Always returns a palette hex.
 */
export function resolveCategoryColor(color: string | null | undefined): string {
  if (!color) return NEUTRAL;
  const normalized = color.trim().toLowerCase();
  if (!normalized) return NEUTRAL;
  if (GOVERNED.has(normalized)) return normalized;
  return SEED_COLOR_OVERRIDES[normalized] ?? NEUTRAL;
}

/** True when a stored color is already a governed palette hex. */
export function isGovernedColor(color: string | null | undefined): boolean {
  if (!color) return false;
  return GOVERNED.has(color.trim().toLowerCase());
}
