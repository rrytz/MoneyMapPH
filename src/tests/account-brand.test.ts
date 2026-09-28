import { describe, expect, it } from "vitest";
import {
  ACCOUNT_BRANDS,
  DARK_CARD_SURFACE,
  NEUTRAL_PALETTE,
  accountBrand,
  contrastRatio,
  getAccountBrandPalette,
  normaliseAccountName,
  rgbDistance,
  type AccountBrand,
} from "@/lib/utils/account-brand";

const BRAND_KEYS = Object.keys(ACCOUNT_BRANDS) as AccountBrand[];

/** The floor that was actually measured, not a round number. */
const MIN_BASE_SEPARATION = 12;
const MIN_ACCENT_SEPARATION = 18;
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

  it.each(BRAND_KEYS)("%s: the base is dark and the accent is not", (key) => {
    // The brief: darkened brand colour as the surface, brighter as the accent.
    // A palette where the accent is darker than its own base is inverted, and
    // it means the mark disappears into the card.
    const p = ACCOUNT_BRANDS[key];
    expect(rgbDistance(p.base, p.accent), `${key} accent is not distinct from its base`)
      .toBeGreaterThanOrEqual(MIN_ACCENT_SEPARATION);
  });

  it("covers exactly the eight recognised brands", () => {
    expect(BRAND_KEYS.sort()).toEqual(
      ["bpi", "gcash", "maribank", "maya", "neutral", "paypal", "unionbank", "wise"].sort()
    );
  });
});
