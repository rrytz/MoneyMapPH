import { describe, expect, it } from "vitest";
import {
  ACCOUNT_BRANDS,
  DARK_CARD_SURFACE,
  NEUTRAL_PALETTE,
  accountBrand,
  contrastRatio,
  getAccountBrandPalette,
  normaliseAccountName,
  perceptualDistance,
  rgbDistance,
  hexToLab,
  deltaE2000,
  maxChipAlpha,
  chipAlphaFor,
  CHIP_ALPHA_FLOOR,
  type AccountBrand,
} from "@/lib/utils/account-brand";

const BRAND_KEYS = Object.keys(ACCOUNT_BRANDS) as AccountBrand[];

/**
 * A wash of `fg` at `alpha` composited over `bg`, as a solid hex.
 *
 * The chip is painted with `rgba()`, but contrast has to be measured against the
 * colour that actually renders - the composite. Measuring the rgba() directly
 * against text would compare two colours when only one of them is ever seen,
 * which is how a chip passes at 0.055 and disappears at 0.06.
 */
function composite(fg: string, alpha: number, bg: string): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [f, b] = [p(fg), p(bg)];
  return (
    "#" +
    f.map((c, i) => Math.round(alpha * c + (1 - alpha) * b[i]).toString(16).padStart(2, "0")).join("")
  ).toUpperCase();
}

/** The floor that was actually measured, not a round number. */
const MIN_BASE_SEPARATION = 12;
/**
 * Accent separation, in dE CIE2000 - perceptual units, not RGB. This replaced
 * an RGB-distance floor of 18, which could not distinguish two greens of similar
 * lightness and so passed an accent that was the same colour as its base.
 */
const MIN_ACCENT_SEPARATION = 8;
const MIN_TEXT_CONTRAST = 4.5;
const MIN_MUTED_CONTRAST = 4.5;
const MIN_ACCENT_ON_SURFACE = 4.5;

describe("the palette is derived from the brand, not the type", () => {
  // The reason this file exists. Type painted every bank the same green and
  // every wallet the same sky, so three of the user's accounts were
  // pixel-identical while the card's whole job is recognition.
  it("gives the three BANK accounts three different palettes", () => {
    const banks = ["Maribank", "unionbank", "BPI"].map((n) => getAccountBrandPalette({ name: n, type: "bank" }));
    expect(rgbDistance(banks[0].base, banks[1].base)).toBeGreaterThanOrEqual(MIN_BASE_SEPARATION);
    expect(rgbDistance(banks[1].base, banks[2].base)).toBeGreaterThanOrEqual(MIN_BASE_SEPARATION);
    expect(rgbDistance(banks[0].base, banks[2].base)).toBeGreaterThanOrEqual(MIN_BASE_SEPARATION);
  });

  it("gives the two WALLET accounts two different palettes", () => {
    const g = getAccountBrandPalette({ name: "Gcash", type: "ewallet" });
    const p = getAccountBrandPalette({ name: "PayPal", type: "ewallet" });
    expect(rgbDistance(g.base, p.base)).toBeGreaterThanOrEqual(MIN_BASE_SEPARATION);
    expect(rgbDistance(g.accent, p.accent)).toBeGreaterThanOrEqual(MIN_ACCENT_SEPARATION);
  });

  it("separates Maya from Wise, which are both green families", () => {
    const m = getAccountBrandPalette({ name: "Maya" });
    const w = getAccountBrandPalette({ name: "Wise" });
    expect(rgbDistance(m.base, w.base)).toBeGreaterThanOrEqual(MIN_BASE_SEPARATION);
  });

  it("keeps EVERY recognised brand separable from every other, in base and accent", () => {
    for (const a of BRAND_KEYS) {
      for (const b of BRAND_KEYS) {
        if (a === b) continue;
        expect(
          rgbDistance(ACCOUNT_BRANDS[a].base, ACCOUNT_BRANDS[b].base),
          `base ${a}/${b}`
        ).toBeGreaterThanOrEqual(MIN_BASE_SEPARATION);
        expect(
          rgbDistance(ACCOUNT_BRANDS[a].accent, ACCOUNT_BRANDS[b].accent),
          `accent ${a}/${b}`
        ).toBeGreaterThanOrEqual(MIN_ACCENT_SEPARATION);
      }
    }
  });

  it("ignores the account type when choosing a palette", () => {
    // A type-based implementation cannot pass this: it would return one colour
    // for every `bank` and one for every `ewallet`.
    expect(getAccountBrandPalette({ name: "Maribank", type: "bank" }).base)
      .not.toBe(getAccountBrandPalette({ name: "BPI", type: "bank" }).base);
    expect(getAccountBrandPalette({ name: "Gcash", type: "ewallet" }).base)
      .not.toBe(getAccountBrandPalette({ name: "Maya", type: "ewallet" }).base);
  });
});

describe("text is never sacrificed for brand fidelity", () => {
  // Body text and the muted type label sit on the card, not on a swatch.
  it.each(BRAND_KEYS)("%s: primary text clears AA on its own base", (key) => {
    const p = ACCOUNT_BRANDS[key];
    expect(contrastRatio(p.onBase, p.base), `${key} text ${p.onBase} on ${p.base}`)
      .toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(BRAND_KEYS)("%s: muted text clears AA on its own base", (key) => {
    const p = ACCOUNT_BRANDS[key];
    expect(contrastRatio(p.mutedOnBase, p.base), `${key} muted on ${p.base}`)
      .toBeGreaterThanOrEqual(MIN_MUTED_CONTRAST);
  });

  // The icon mark and the balance render on the app's dark surface too, in the
  // places a card is not the backdrop. Two candidates failed this and were
  // brightened: BPI red at 3.46:1 and PayPal blue at 4.19:1.
  it.each(BRAND_KEYS)("%s: accent clears 4.5:1 on the dark card surface", (key) => {
    const ratio = contrastRatio(ACCOUNT_BRANDS[key].accent, DARK_CARD_SURFACE);
    expect(ratio, `${key} accent ${ACCOUNT_BRANDS[key].accent} is only ${ratio.toFixed(2)}:1`)
      .toBeGreaterThanOrEqual(MIN_ACCENT_ON_SURFACE);
  });

  it("would have caught the two accents that failed during the build", () => {
    expect(contrastRatio("#CC3540", DARK_CARD_SURFACE)).toBeLessThan(MIN_ACCENT_ON_SURFACE);
    expect(contrastRatio("#2E7BE0", DARK_CARD_SURFACE)).toBeLessThan(MIN_ACCENT_ON_SURFACE);
    expect(contrastRatio(ACCOUNT_BRANDS.bpi.accent, DARK_CARD_SURFACE))
      .toBeGreaterThanOrEqual(MIN_ACCENT_ON_SURFACE);
  });
});

describe("recognition is exact, not fuzzy", () => {
  it("matches the real spellings case-insensitively", () => {
    expect(accountBrand({ name: "MariBank" })).toBe("maribank");
    expect(accountBrand({ name: "Maribank" })).toBe("maribank");
    expect(accountBrand({ name: "maribank" })).toBe("maribank");
    expect(accountBrand({ name: "UNIONBANK" })).toBe("unionbank");
    expect(accountBrand({ name: "Gcash" })).toBe("gcash");
    expect(accountBrand({ name: "GCASH" })).toBe("gcash");
    expect(accountBrand({ name: "PayPal" })).toBe("paypal");
    expect(accountBrand({ name: "Maya" })).toBe("maya");
    expect(accountBrand({ name: "BPI" })).toBe("bpi");
    expect(accountBrand({ name: "Wise" })).toBe("wise");
  });

  it("trims and collapses whitespace", () => {
    expect(normaliseAccountName("  Mari   Bank ")).toBe("maribank");
    expect(accountBrand({ name: "  Gcash " })).toBe("gcash");
  });

  // Substring matching would paint these correctly BY LUCK and a user's
  // "Cash Advance Card" with the wrong palette, silently.
  it("does NOT match unrelated names that merely contain a brand", () => {
    expect(accountBrand({ name: "BPI Savings Extra" })).toBeNull();
    expect(accountBrand({ name: "Wise Rewards Card" })).toBeNull();
    expect(accountBrand({ name: "Maya Max" })).toBeNull();
    expect(accountBrand({ name: "Cash Advance Card" })).toBeNull();
    expect(accountBrand({ name: "My GCash Wallet" })).toBeNull();
    expect(accountBrand({ name: "PayPal Checking" })).toBeNull();
  });

  it("falls back to neutral for anything unrecognised", () => {
    for (const name of ["", "   ", "Chinabank", "BDO", "Citi", null, undefined]) {
      expect(getAccountBrandPalette({ name }).base).toBe(NEUTRAL_PALETTE.base);
    }
  });

  it("gives cash the neutral palette, because it has no brand", () => {
    const cash = getAccountBrandPalette({ name: "Cash", type: "cash" });
    expect(cash.base).toBe(NEUTRAL_PALETTE.base);
    // and it is still separable from every real brand
    for (const key of BRAND_KEYS) {
      if (key === "neutral") continue;
      expect(rgbDistance(cash.base, ACCOUNT_BRANDS[key].base)).toBeGreaterThanOrEqual(MIN_BASE_SEPARATION);
    }
  });
});

describe("every palette is a complete, valid colour set", () => {
  it.each(BRAND_KEYS)("%s: every colour is a 6-digit hex", (key) => {
    const p = ACCOUNT_BRANDS[key];
    for (const c of [p.base, p.accent, p.secondary, p.onBase, p.mutedOnBase]) {
      expect(c, `${key} has a malformed colour: ${c}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it.each(BRAND_KEYS)("%s: the accent is perceptually distinct from its base", (key) => {
    // RENAMED. This test used to be called "the base is dark and the accent is
    // not", which described a rule the assertion never made - it only measured
    // RGB distance. The bases are now the brands' real luminance and are mostly
    // BRIGHT, so the old name was simply false while the test kept passing. That
    // is this project's own recorded failure class: a check that misdescribes
    // what it does.
    //
    // The metric changed with the name. Naive RGB distance cleared the old floor
    // of 18 for Wise's old accent (#A6E85C, 21 units) while CIE2000 puts the
    // same pair at dE00 3.11 - the same green twice. RGB distance cannot tell.
    const p = ACCOUNT_BRANDS[key];
    expect(
      perceptualDistance(p.accent, p.base),
      `${key} accent ${p.accent} is only dE00 ${perceptualDistance(p.accent, p.base).toFixed(2)} from its base ${p.base} (need ${MIN_ACCENT_SEPARATION})`
    ).toBeGreaterThanOrEqual(MIN_ACCENT_SEPARATION);
  });

  it("would have caught Wise's old accent, which the RGB metric passed", () => {
    // The regression proof. 21 units apart in RGB, 3.11 perceptually.
    expect(rgbDistance("#A6E85C", "#9FE870")).toBeGreaterThanOrEqual(18);
    expect(perceptualDistance("#A6E85C", "#9FE870")).toBeLessThan(8);
  });

  it("covers exactly the eight recognised brands", () => {
    expect(BRAND_KEYS.sort()).toEqual(
      ["bpi", "gcash", "maribank", "maya", "neutral", "paypal", "unionbank", "wise"].sort()
    );
  });
});

describe("the CIE2000 metric is calibrated, not assumed", () => {
  // An uncalibrated instrument cannot pick a value. These are the published
  // Sharma, Wu & Dalal vectors; if this block drifts, every dE00 number in the
  // palette - including the two DERIVED accents - is meaningless.
  const VECTORS: Array<[[number, number, number], [number, number, number], number]> = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [61, -5, 29], 22.8977],
    [[50, 2.5, 0], [56, -27, -3], 31.903],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
  ];

  it.each(VECTORS)("reproduces dE00 %s vs %s", (a, b, want) => {
    const lab = (t: [number, number, number]) => ({ L: t[0], a: t[1], b: t[2] });
    expect(deltaE2000(lab(a), lab(b))).toBeCloseTo(want, 4);
  });

  it("is symmetric and zero on itself", () => {
    expect(perceptualDistance("#007DFE", "#007DFE")).toBe(0);
    expect(perceptualDistance("#007DFE", "#00C853")).toBeCloseTo(
      perceptualDistance("#00C853", "#007DFE"), 10
    );
  });

  it("puts white and black at exactly 100", () => {
    expect(perceptualDistance("#FFFFFF", "#000000")).toBeCloseTo(100, 4);
  });

  it("converts hex to Lab without collapsing distinct colours", () => {
    // Guards the D65 conversion, which is where a silent error would live.
    expect(hexToLab("#FFFFFF").L).toBeCloseTo(100, 2);
    expect(hexToLab("#000000").L).toBeCloseTo(0, 5);
  });
});

describe("the chip wash is dropped rather than rendered invisible", () => {
  // The archived pill and the monogram chip both sit on this wash with --brand-on
  // text. Two floors apply: 4.5:1 so the text is readable, and CHIP_ALPHA_FLOOR
  // so the wash reads as a chip at all. A wash that passes only the first is an
  // element present in the DOM and absent on screen.

  it.each(BRAND_KEYS)("%s: its chipAlpha matches the rule for its own base", (key) => {
    const p = ACCOUNT_BRANDS[key];
    expect(p.chipAlpha, `${key} chipAlpha ${p.chipAlpha} does not match chipAlphaFor(${p.base}, ${p.onBase})`)
      .toBe(chipAlphaFor(p.base, p.onBase));
  });

  it.each(BRAND_KEYS)("%s: whatever chip it keeps still clears AA under onBase", (key) => {
    const p = ACCOUNT_BRANDS[key];
    if (p.chipAlpha === null) return; // no chip is a legal, asserted outcome
    const mix = composite(p.onBase, p.chipAlpha, p.base);
    expect(contrastRatio(p.onBase, mix), `${key} chip at ${p.chipAlpha} drops onBase below AA`)
      .toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(BRAND_KEYS)("%s: a dropped chip is dropped because nothing survived both floors", (key) => {
    const p = ACCOUNT_BRANDS[key];
    if (p.chipAlpha !== null) return;
    // A null must mean "the maximum AA alpha is below the visibility floor",
    // never "nobody filled this in".
    const maxAa = maxChipAlpha(p.base, p.onBase);
    expect(maxAa, `${key} has no chip but an AA wash of ${maxAa} exists, which is at or above the floor`)
      .toBeLessThan(CHIP_ALPHA_FLOOR);
  });

  it("drops exactly one chip, and it is gcash", () => {
    // Coverage before absence: the claim "one chip is dropped" is only
    // meaningful if the other seven are known to have one.
    const dropped = BRAND_KEYS.filter((k) => ACCOUNT_BRANDS[k].chipAlpha === null);
    const kept = BRAND_KEYS.filter((k) => ACCOUNT_BRANDS[k].chipAlpha !== null);
    expect(dropped).toEqual(["gcash"]);
    expect(kept).toHaveLength(7);
  });

  it("keeps unionbank's chip where gcash's is dropped, for a stated reason", () => {
    // Both bases wash toward a near-opposite text colour, but in opposite
    // directions: white onto a mid red reads, near-black onto a bright blue
    // does not. Same alpha, opposite perceptibility - which is why the rule has
    // a visibility floor and not only an AA floor.
    expect(ACCOUNT_BRANDS.unionbank.chipAlpha).not.toBeNull();
    expect(ACCOUNT_BRANDS.gcash.chipAlpha).toBeNull();
  });
});

describe("text tiers collapse honestly rather than pretending", () => {
  it.each(BRAND_KEYS)("%s: muted is either clearly separate or identical to onBase", (key) => {
    // The middle ground is the failure: a "muted" value that is subtly
    // different from the text beside it is decoration pretending to be a tier.
    const p = ACCOUNT_BRANDS[key];
    const sep = rgbDistance(p.mutedOnBase, p.onBase);
    expect(
      sep === 0 || sep >= 24,
      `${key} muted ${p.mutedOnBase} is ${sep} from onBase ${p.onBase} - neither identical nor a clear tier`
    ).toBe(true);
  });

  it.each(BRAND_KEYS)("%s: onBase is one of the two measured tokens, not a free choice", (key) => {
    expect(["#FFFFFF", "#0B0E0F"]).toContain(ACCOUNT_BRANDS[key].onBase);
  });
});
