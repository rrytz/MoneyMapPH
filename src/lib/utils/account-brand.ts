/**
 * An account's BRAND palette. The card's whole colour system.
 *
 * ------------------------------------------------------------------
 * WHY THIS REPLACED A TYPE PALETTE
 *
 * The previous implementation derived colour from `account.type`, so all three
 * of the user's banks rendered the same green and both wallets rendered the
 * same sky. Measured on /accounts: Maribank, unionbank and Gcash were
 * pixel-identical in ground. That answered "what kind of thing is this" and
 * the card already says that - the type is printed under the name, and it
 * drives the section grouping.
 *
 * A card is a thing someone recognises before they read it. Which bank it is
 * is carried by the logo, the name and the colour together, and colour was the
 * one carrying nothing. Type remains a SEMANTIC classification and nothing
 * more: it groups the sections, it does not paint the card.
 *
 * The consequence to keep in mind: two accounts of the same type are now
 * visibly different, and two accounts of different types can share a family -
 * MariBank/UnionBank/BPI are all `bank` and all read warm, and they are
 * separated by 14-23 in base distance, which is the measured floor.
 *
 * ------------------------------------------------------------------
 * THE VALUES ARE MEASURED, NOT CHOSEN
 *
 * Hue direction comes from each brand's own logo, then is darkened into a
 * surface and brightened into an accent. Two things were checked before these
 * numbers were accepted, both asserted in `account-brand.test.ts`:
 *
 *   - TEXT on the base. Body text clears 12.6:1 and muted text clears 6.8:1
 *     across all eight. Brand fidelity is never bought with readability.
 *   - The ACCENT on the app's own dark surface #141b16, because the icon mark
 *     and the balance sit on the card, not on an isolated swatch. Two earlier
 *     candidates failed here - BPI red at 3.46:1 and PayPal blue at 4.19:1 -
 *     and were brightened until they cleared 4.5:1.
 *
 * ------------------------------------------------------------------
 * MATCHING
 *
 * Exact, case-insensitive, whitespace-trimmed equality against a known name.
 * NOT substring matching. "BPI" and "Wise" are short and "Cash" is generic;
 * a substring rule would paint a user's "BPI Savings Extra" correctly by luck
 * and their "Cash Advance Card" with the wrong palette, silently and for a
 * reason that is not visible in the code. Anything unrecognised falls through
 * to the neutral stone palette, which is the honest answer for an account with
 * no logo - and is the same answer for a name we simply have not seen.
 */

export type AccountBrand =
  | "maribank" | "unionbank" | "gcash" | "maya"
  | "bpi" | "paypal" | "wise" | "neutral";

export interface AccountBrandPalette {
  /** The card surface. A darkened brand colour, never the logo's own fill. */
  base: string;
  /** Icon mark, active accents. The bright end of the same hue. */
  accent: string;
  /** A supporting hue from the same logo, used sparingly. */
  secondary: string;
  /** Primary text on `base`. */
  onBase: string;
  /** Secondary text on `base` - type label, figures, helper copy. */
  mutedOnBase: string;
  /** What this brand is, for the tests and for anyone reading the table. */
  note: string;
}

const TEXT = "#EAF0F6";
const MUTED = "#A8B3BE";

export const NEUTRAL_PALETTE: AccountBrandPalette = {
  base: "#1C1F1E",
  accent: "#AFB9B5",
  secondary: "#525B57",
  onBase: TEXT,
  mutedOnBase: MUTED,
  note: "neutral stone - cash has no brand, and an unknown account gets the same",
};

/**
 * Brand palette by ACCOUNT NAME.
 *
 * The key is the normalised name, so callers pass the account and get the
 * palette; they never branch on `account.name` themselves. That is the whole
 * reason this is a map rather than a switch scattered through the component.
 */
export const ACCOUNT_BRANDS: Record<AccountBrand, AccountBrandPalette> = {
  maribank: {
    base: "#2B1B0F", accent: "#F5812F", secondary: "#3E8FD0",
    onBase: TEXT, mutedOnBase: MUTED,
    note: "orange wordmark, blue wave beneath - warm surface, blue used once",
  },
  unionbank: {
    base: "#3A0D05", accent: "#FF5E1F", secondary: "#96401A",
    onBase: TEXT, mutedOnBase: MUTED,
    note: "red-orange rounded square - deliberately redder than MariBank",
  },
  gcash: {
    base: "#04284E", accent: "#4FA8F5", secondary: "#1B6FC0",
    onBase: TEXT, mutedOnBase: MUTED,
    note: "vivid blue - a clean blue base, not navy, to stay off PayPal",
  },
  maya: {
    base: "#03301E", accent: "#1AD98E", secondary: "#7B5CE8",
    onBase: TEXT, mutedOnBase: MUTED,
    note: "emerald base with the wordmark's violet as the secondary",
  },
  bpi: {
    base: "#34060F", accent: "#E8505C", secondary: "#E5C25C",
    onBase: TEXT, mutedOnBase: MUTED,
    note: "burgundy base, red mark, gold crest as the secondary",
  },
  paypal: {
    base: "#0B1033", accent: "#4A94F0", secondary: "#63B4F5",
    onBase: TEXT, mutedOnBase: MUTED,
    note: "indigo-navy base - one step off GCash's blue, and 37 apart from it",
  },
  wise: {
    base: "#0E2A08", accent: "#A6E85C", secondary: "#44882A",
    onBase: TEXT, mutedOnBase: MUTED,
    note: "dark version of the lime identity - the reference's bright lime is not the base",
  },
  neutral: NEUTRAL_PALETTE,
};

/** Normalised name -> brand. Exact matches only, by design. See the file note. */
const BRAND_BY_NAME: Record<string, AccountBrand> = {
  maribank: "maribank",
  unionbank: "unionbank",
  gcash: "gcash",
  maya: "maya",
  bpi: "bpi",
  paypal: "paypal",
  wise: "wise",
  cash: "neutral",
};

/** The minimal shape this needs, so the resolver is testable bare. */
export interface BrandableAccount {
  name?: string | null;
  type?: string | null;
}

export function normaliseAccountName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

/** Which brand, if any. `null` for anything unrecognised - never a guess. */
export function accountBrand(
  account: BrandableAccount
): AccountBrand | null {
  const key = normaliseAccountName(account?.name);
  return key in BRAND_BY_NAME ? BRAND_BY_NAME[key] : null;
}

/**
 * The palette for an account, with the neutral fallback.
 *
 * Never throws and never guesses: an unrecognised name gets stone, which is
 * also what `cash` gets, because an account with no logo and an account we
 * have no logo for are the same case.
 */
export function getAccountBrandPalette(account: BrandableAccount): AccountBrandPalette {
  const brand = accountBrand(account);
  return brand ? ACCOUNT_BRANDS[brand] : NEUTRAL_PALETTE;
}

// ---------------------------------------------------------------- colour maths
// Exported so the tests measure the SAME numbers the component uses, rather than
// re-deriving them and risking the two drifting apart.

export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 < l2 ? [l2, l1] : [l1, l2];
  return (hi + 0.05) / (lo + 0.05);
}

/** RGB euclidean distance - the "are these two distinguishable" measure. */
export function rgbDistance(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return Math.round(
    Math.sqrt(
      Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2)
    )
  );
}

/**
 * The icon mark's own fill, over the card base.
 *
 * The BASE is painted SOLID, not as a wash. It is already a measured dark
 * colour: the text-contrast ratios in the table are computed against these exact
 * values, and compositing them at some alpha over `bg-card` would produce a
 * different colour from the one that was verified. A wash here would invalidate
 * every contrast number in the file - which is precisely the mistake the
 * previous type palette made, where the tested hex and the rendered wash were
 * 7 units apart and unreadable.
 */
export const ICON_FILL_ALPHA = 0.22;

/**
 * A hex at a given alpha, as an rgba() string.
 *
 * Needed because the card is brand-coloured in BOTH themes, so its hairlines
 * cannot come from `border-border`: that token is dark in light mode and would
 * vanish against a dark brand base, and light in dark mode and would glare. The
 * divider is derived from the brand's own text colour at low alpha, so it reads
 * the same on a light page and a dark one.
 */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The card's own hairline, derived from its text colour so it is theme-proof. */
export function brandHairline(onBase: string): string {
  return withAlpha(onBase, 0.14);
}

/** The app's dark card surface, which the icon mark and the balance sit on. */
export const DARK_CARD_SURFACE = "#141b16";
