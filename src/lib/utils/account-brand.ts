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
 * Hue and luminance come from each brand's own published colour, used AS IS -
 * the bases are the real brand colours, not a darkening of them. That was not
 * always true: every base used to sit between L 0.0068 and 0.0223, darkened so
 * that ONE global text constant could serve all eight. See the note above
 * ACCOUNT_BRANDS for why that trade was reversed.
 *
 * What is measured, asserted in `account-brand.test.ts`:
 *
 *   - TEXT on each brand's OWN base, per brand. Body text clears 4.85:1 at the
 *     worst (unionbank) and 16.61:1 at the best (neutral). Muted text clears
 *     4.55:1 everywhere it survives at all, and collapses to the text colour on
 *     the two brands where no window remains. Brand fidelity is never bought
 *     with readability.
 *   - Base-to-base separation: the closest pair is gcash/paypal at 45 against a
 *     floor of 12. Bright bases are FURTHER apart than the dark ones were.
 *   - The chip wash, held to the same 4.5:1 under the text that sits on it.
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
  /** The card surface. The brand's own colour at its real luminance. */
  base: string;
  /** A supporting hue from the same logo, used sparingly. */
  secondary: string;
  /** Primary text on `base`. Assigned per brand, never one global constant. */
  onBase: string;
  /** Secondary text on `base` - type label, figures, helper copy. */
  mutedOnBase: string;
  /**
   * The wash behind the archived pill and the monogram chip, as an alpha over
   * `onBase`, or `null` when no wash can both clear AA and read as a chip.
   * See CHIP_ALPHA_FLOOR - this is a boundary, not a preference.
   */
  chipAlpha: number | null;
  /** What this brand is, for the tests and for anyone reading the table. */
  note: string;
}

/**
 * Text tokens. Two constants, assigned PER BRAND by measurement.
 *
 * A single global TEXT constant only worked while every base was near-black,
 * which is why the palette was flattened to dark bases in the first place. At
 * real brand luminance that assumption fails outright: GCash's blue clears
 * 4.5:1 against near-black (4.95:1) and NOT against white (3.91:1), so "always
 * white text" is wrong for the brightest brand in the set. Each brand takes
 * whichever of these two clears AA over ITS OWN base - measured, not assumed.
 */
const ON_LIGHT = "#FFFFFF"; // text for a DARK base
const ON_DARK = "#0B0E0F"; // text for a BRIGHT base

/**
 * The chip threshold, in alpha over the base, below which a wash stops reading
 * as a chip and renders as plain text.
 *
 * Not a hunch: rendered at 0 / 0.03 / 0.055 / 0.07 / 0.09 / 0.115 / 0.15 / 0.2
 * / 0.28 on a bright base and compared against each other. Below 0.06 the wash
 * is a smudge; at 0.07 it is a definite pill. So 0.06 is where the element
 * stops being a chip.
 *
 * This is why GCash has no chip and UnionBank does, at similar alphas: a WHITE
 * wash on a mid red is a large lightness move and reads at 0.115, while a
 * near-BLACK wash on a BRIGHT blue is a small move on an already-bright ground
 * and does not read until well past its own AA ceiling of 0.055. Same rule,
 * different answer, because the direction of the wash differs.
 */
export const CHIP_ALPHA_FLOOR = 0.06;

/**
 * The maximum alpha a wash may take before `onBase` on top of it drops below
 * 4.5:1, which is the same AA floor every other text tier is held to.
 */
export function maxChipAlpha(base: string, onBase: string): number {
  let max = 0;
  for (let a = 0; a <= 0.6; a += 0.005) {
    const [r, g, b] = hexToRgb(onBase);
    const [br, bg, bb] = hexToRgb(base);
    const mix = rgbToHex([a * r + (1 - a) * br, a * g + (1 - a) * bg, a * b + (1 - a) * bb]);
    if (contrastRatio(onBase, mix) >= 4.5) max = a;
  }
  return max;
}

/**
 * Assigns a brand's chip wash, or `null` when none can survive both floors.
 *
 * Two rules compose here and the composition is the point: AA (what is
 * readable) and CHIP_ALPHA_FLOOR (what reads as a chip at all). A wash that
 * clears AA at 0.055 still renders as plain text, and a chip that exists in the
 * DOM but not on screen is the "present and non-empty" failure this file has
 * already recorded once.
 */
export function chipAlphaFor(base: string, onBase: string): number | null {
  const alpha = Math.min(0.12, maxChipAlpha(base, onBase));
  return alpha < CHIP_ALPHA_FLOOR ? null : Math.round(alpha * 1000) / 1000;
}

export const NEUTRAL_PALETTE: AccountBrandPalette = {
  base: "#1C1F1E",
  secondary: "#525B57",
  onBase: ON_LIGHT,
  mutedOnBase: "#7C8884",
  chipAlpha: 0.12,
  note: "neutral stone - cash has no brand, and an unknown account gets the same",
};

/**
 * Brand palette by ACCOUNT NAME.
 *
 * The key is the normalised name, so callers pass the account and get the
 * palette; they never branch on `account.name` themselves. That is the whole
 * reason this is a map rather than a switch scattered through the component.
 *
 * ------------------------------------------------------------------
 * BASES ARE THE BRAND'S REAL LUMINANCE, NOT A DARKENING OF IT
 *
 * These used to be darkened versions of each brand's hue - every base sat
 * between L 0.0068 and 0.0223, so all eight cards read as near-black panels
 * with a coloured mark. That was done to let ONE text constant serve every
 * brand. It bought that convenience with the brand: a card that is recognisable
 * by its colour should be that colour, and the mark cannot carry identity on
 * its own at 18px.
 *
 * Flattening the bases to service a single constant was the mistake, and the
 * fix is per-brand text assignment, not a compromise on the colour. Each brand
 * now takes ON_DARK or ON_LIGHT by measurement:
 *
 *   brand      base       text      text:base   6 of 8 take ON_DARK
 *   maribank   #F5812F    ON_DARK    7.44:1     because an orange base at
 *   gcash      #007DFE    ON_DARK    4.95:1       real luminance is far too
 *   maya       #00C853    ON_DARK    8.66:1       light for white text
 *   paypal     #009CDE    ON_DARK    6.28:1
 *   wise       #9FE870    ON_DARK   13.15:1     unionbank, bpi and neutral
 *   unionbank  #E4002B    ON_LIGHT   4.85:1       take ON_LIGHT
 *   bpi        #004E9E    ON_LIGHT   8.13:1
 *   neutral    #1C1F1E    ON_LIGHT  16.61:1
 *
 * Brightening the bases also made them FURTHER apart, not closer: the closest
 * pair is gcash/paypal at 45, where the old dark set only managed 14-23.
 *
 * ------------------------------------------------------------------
 * WHERE A TIER COLLAPSES, IT SAYS SO
 *
 * `mutedOnBase` is the maximum shift toward the base that still clears 4.5:1.
 * On a near-black base that is a wide window and the type label reads as
 * clearly secondary. As the base brightens the window narrows, and on
 * unionbank (sep 12) and gcash (sep 19) it closes: both set muted to their own
 * `onBase`, and the label's hierarchy is carried by size and weight instead.
 *
 * That is the rule at its boundary, not a special case - the same rule handles
 * the next brand that brightens without needing a new decision. It is also the
 * honest outcome: a "muted" value that is visually identical to the text beside
 * it is decoration pretending to be a distinction.
 */
export const ACCOUNT_BRANDS: Record<AccountBrand, AccountBrandPalette> = {
  maribank: {
    base: "#F5812F", secondary: "#3E8FD0",
    onBase: ON_DARK, mutedOnBase: "#700A05", chipAlpha: 0.12,
    note: "real MariBank orange, a monochromatic brand - see the derivation note",
  },
  unionbank: {
    base: "#E4002B", secondary: "#96401A",
    onBase: ON_LIGHT, mutedOnBase: ON_LIGHT, chipAlpha: 0.115,
    note: "UnionBank red. Muted tier COLLAPSED to onBase; chip survives at 0.115",
  },
  gcash: {
    base: "#007DFE", secondary: "#1B6FC0",
    onBase: ON_DARK, mutedOnBase: "#000A57", chipAlpha: null,
    note: "real GCash blue. Chip DROPPED - see chipAlphaFor. Muted tier was rescued by the v2 rule",
  },
  maya: {
    base: "#00C853", secondary: "#7B5CE8",
    onBase: ON_DARK, mutedOnBase: "#004D03", chipAlpha: 0.12,
    note: "Maya green with the wordmark's violet as the secondary",
  },
  bpi: {
    base: "#004E9E", secondary: "#E5C25C",
    onBase: ON_LIGHT, mutedOnBase: "#00DBA6", chipAlpha: 0.12,
    note: "BPI blue, gold crest as the secondary",
  },
  paypal: {
    base: "#009CDE", secondary: "#63B4F5",
    onBase: ON_DARK, mutedOnBase: "#07009E", chipAlpha: 0.12,
    note: "PayPal bright blue - 45 from gcash, the closest pair in the set",
  },
  wise: {
    base: "#9FE870", secondary: "#44882A",
    onBase: ON_DARK, mutedOnBase: "#126911", chipAlpha: 0.12,
    note: "real Wise lime, bright enough that only ON_DARK clears AA. Its muted tier is verified by eye, not by metric alone",
  },
  neutral: NEUTRAL_PALETTE,
};

/**
 * NO ACCENT EXISTS, AND THE RULE FOR MAKING ONE IS HERE SO IT IS NOT REINVENTED
 *
 * The palette carried an `accent` - an "icon mark, active accent" - and it was
 * deleted because it renders NOWHERE. Not on the card, not in any state, not in
 * any scheme: the marks draw in `onBase` because they are monochrome, and no
 * other element reads the field.
 *
 * It was deleted rather than left parked because it was the most dangerous kind
 * of dead code: it had tests, a rule, a calibrated metric and a floor, so it
 * looked alive. A future contributor would trust all of it and derive a value
 * under a constraint no screen ever imposed. Rigorous work on a value nothing
 * renders is still a value nothing renders.
 *
 * ------------------------------------------------------------------
 * THE DERIVATION RULE - keep this, re-derive the value from scratch
 * ------------------------------------------------------------------
 *
 * MariBank and Wise are MONOCHROMATIC brands. An accent derived from their base
 * collides with it by construction - MariBank came out at dE00 0.00, the same
 * colour twice. That is not a missing file: the brand has no second colour, so
 * any accent must be derived, by rule rather than by eye:
 *
 *   1. measure in dE CIE2000, never naive RGB distance. RGB counted two
 *      indistinguishable greens as 21 units apart and passed them.
 *   2. shift along ONE axis - saturation OR lightness, never both.
 *   3. prefer SATURATION over lightness, because it preserves the hue. On a
 *      saturated base a large-enough lightness shift exhausts saturation and
 *      lands on grey, which is no longer the brand.
 *   4. stop AT the threshold rather than pushing past it for aesthetics.
 *   5. hold the result to 4.5:1 on whatever surface it will actually sit on.
 *
 * **If a feature needs an accent, this rule is the starting point and NOT the
 * answer. Re-derive under that feature's real luminance, adjacency and size
 * before using any number.** The margin problem that forced a floor judgement
 * last time - where dE00 8 was clearly distinct on MariBank's orange but only
 * marginal on Wise's lime - was a property of a specific base and a specific
 * assumed size, and it may simply not recur.
 *
 * Floors of 8, 12, 16, 20 and 25 were all measured on those two bases. 8 was
 * adequate on the orange and marginal on the lime. That is the whole reason a
 * floor needs re-deriving rather than inheriting: the correct number depends on
 * where the colour will be seen, which is exactly the part that was missing.
 */

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

/** Inverse of `hexToRgb`, for the alpha maths that derives the chip wash. */
export function rgbToHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  ).toUpperCase();
}

// ---------------------------------------------------------------- the muted tier
/**
 * MUTED RULE, v2. Maximise perceptual separation from the TEXT, subject to
 * legibility against the BASE - and stay inside the brand's own hue family.
 *
 * v1 was "the maximum shift toward the base that still clears 4.5:1", and it was
 * self-defeating: maximum shift IS the boundary case, so "just legible" and
 * "clearly a different tier" were the same value by construction. Six of eight
 * muted values landed within 0.06 of the floor. The label was guaranteed to sit
 * as close to the text as legibility permitted, which is the opposite of a tier.
 *
 * v2 optimises the thing that is actually wanted - separation - instead of
 * minimising the thing that was merely constrained.
 *
 * THE HUE CONSTRAINT IS NOT OPTIONAL. Run without it, "maximise ΔE00 from the
 * text" is free to abandon the hue entirely, and does:
 *
 *     unionbank  -> #ffff00   dE00 30.5   a yellow label on a red card
 *     bpi        -> #00e000   dE00 34.5   pure green on a blue card
 *
 * Both satisfy every written constraint. Both are nonsense, because "far from
 * the text" is not the same objective as "reads as a secondary version of it".
 * The objective without its boundary is not a weaker rule - it is a different
 * and wrong one.
 */

/** How far the muted may drift from the base's hue before it stops being that brand's. */
export const MUTED_HUE_TOLERANCE_DEG = 45;

/**
 * Below this ΔE00 the muted is not a second tier, and collapses to `onBase`.
 *
 * Bounded by two rendered judgements, not chosen for tidiness. unionbank's best
 * legal value scores 6.9 and renders as pure white - indistinguishable. gcash's
 * scores 20.1 and renders as a clearly navy "Ewallet" beside a black name. The
 * floor sits between a value confirmed invisible and one confirmed visible.
 *
 * Same kind of judgement as CHIP_ALPHA_FLOOR, and for the same reason: it is a
 * threshold about perception, so it was settled by rendering and looking rather
 * than by picking a number that made a test pass.
 */
export const MUTED_MIN_SEPARATION = 15;

function rgbToHsl(rgb: [number, number, number]): [number, number, number] {
  const [r0, g0, b0] = rgb.map((v) => v / 255);
  const mx = Math.max(r0, g0, b0);
  const mn = Math.min(r0, g0, b0);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h: number;
  if (mx === r0) h = (g0 - b0) / d + (g0 < b0 ? 6 : 0);
  else if (mx === g0) h = (b0 - r0) / d + 2;
  else h = (r0 - g0) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * The muted value for a brand, derived rather than typed.
 *
 * Returns `onBase` when the base cannot support a second tier - which is
 * arithmetic, not a preference, and is recorded as such per brand in the table.
 */
export function mutedFor(base: string, onBase: string): string {
  const [h0, s0] = rgbToHsl(hexToRgb(base));
  const offsets = [0, 22.5, 45, -22.5, -45];
  let best: { hex: string; d: number } | null = null;
  for (const off of offsets) {
    const hue = (h0 + off + 360) % 360;
    for (const sm of [0, 0.15, 0.3, 0.5, 0.75, 1]) {
      const s = s0 * sm;
      for (let l = 0; l <= 1; l += 0.01) {
        const cand = rgbToHex(hslToRgb(hue, s, l));
        if (contrastRatio(cand, base) < 4.5) continue;
        const d = perceptualDistance(cand, onBase);
        if (!best || d > best.d) best = { hex: cand, d };
      }
    }
  }
  if (!best || best.d < MUTED_MIN_SEPARATION) return onBase;
  return best.hex;
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

// ---------------------------------------------------------------- CIE2000
// The perceptual separation metric, and the reason RGB distance was retired.
//
// Naive RGB distance cannot tell that two colours at similar lightness are the
// same colour: it counted two indistinguishable greens as 21 units apart and
// called that separated, while CIE2000 puts them at dE00 3.11. It also cannot
// see that a large numerical gap can be perceptually small.
//
// There is currently no accent to measure - see the derivation note above. The
// metric is kept, calibrated and exported, because the RULE that used it is
// worth keeping and a re-derivation under a real constraint will need it.
//
// Proven against the Sharma, Wu & Dalal published vectors in the test file. A
// colour metric that has not been checked against known pairs is an instrument
// of unknown calibration, and an uncalibrated instrument cannot pick a value.

export interface Lab { L: number; a: number; b: number }

/** sRGB hex -> CIE L*a*b*, D65. */
export function hexToLab(hex: string): Lab {
  const [r8, g8, b8] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const X = r8 * 0.4124 + g8 * 0.3576 + b8 * 0.1805;
  const Y = r8 * 0.2126 + g8 * 0.7152 + b8 * 0.0722;
  const Z = r8 * 0.0193 + g8 * 0.1192 + b8 * 0.9505;
  const f = (t: number) =>
    t > 0.008856451679 ? Math.cbrt(t) : 7.787037037 * t + 16 / 116;
  const fx = f(X / 0.95047);
  const fy = f(Y / 1.0);
  const fz = f(Z / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIEDE2000 colour difference, kL = kC = kH = 1. */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.sqrt(ap1 * ap1 + b1 * b1);
  const Cp2 = Math.sqrt(ap2 * ap2 + b2 * b2);
  const hue = (b: number, ap: number) => {
    if (b === 0 && ap === 0) return 0;
    const h = (Math.atan2(b, ap) * 180) / Math.PI;
    return h < 0 ? h + 360 : h;
  };
  const hp1 = hue(b1, ap1);
  const hp2 = hue(b2, ap2);
  const dL = L2 - L1;
  const dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2 !== 0) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * Math.PI) / 360);
  const Lb = (L1 + L2) / 2;
  const Cpb = (Cp1 + Cp2) / 2;
  let hpb: number;
  if (Cp1 * Cp2 === 0) hpb = hp1 + hp2;
  else if (Math.abs(hp1 - hp2) <= 180) hpb = (hp1 + hp2) / 2;
  else hpb = hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2;
  const T =
    1 -
    0.17 * Math.cos(((hpb - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hpb * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hpb + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hpb - 63) * Math.PI) / 180);
  const dTheta = 30 * Math.exp(-Math.pow((hpb - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cpb, 7) / (Math.pow(Cpb, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lb - 50, 2)) / Math.sqrt(20 + Math.pow(Lb - 50, 2));
  const Sc = 1 + 0.045 * Cpb;
  const Sh = 1 + 0.015 * Cpb * T;
  const Rt = -Math.sin((2 * dTheta * Math.PI) / 180) * Rc;
  return Math.sqrt(
    Math.pow(dL / Sl, 2) +
      Math.pow(dC / Sc, 2) +
      Math.pow(dH / Sh, 2) +
      Rt * (dC / Sc) * (dH / Sh)
  );
}

/** Convenience: the perceptual distance between two hexes. */
export function perceptualDistance(a: string, b: string): number {
  return deltaE2000(hexToLab(a), hexToLab(b));
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
