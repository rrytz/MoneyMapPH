import { describe, expect, it } from "vitest";
import {
  ACCOUNT_TONES,
  DARK_SURFACE,
  GROUND_ALPHA,
  ICON_ALPHA,
  STATE_GROUNDS,
  accountTone,
  compositedGround,
  toneDistance,
  type AccountTypeKey,
} from "@/lib/utils/account-tone";

// The palette is not a matter of taste and the spreadsheet is not the proof.
// Both axes get pinned here, in both directions, so a tone cannot be swapped
// for something that looks right and reads as a state.

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const lum = (hex: string): number => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const distance = (a: string, b: string): number => {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.sqrt(
    Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2)
  );
};

const KEYS = Object.keys(ACCOUNT_TONES) as AccountTypeKey[];

describe("every account tone clears the dark surface", () => {
  // The surface the design is actually used in. A swatch that passes in a
  // spreadsheet is not a card that passes on screen.
  it.each(KEYS)("%s is at least 4.5:1 on the dark card surface", (key) => {
    const ratio = contrast(ACCOUNT_TONES[key].ground, DARK_SURFACE);
    expect(ratio, `${key} is ${ratio.toFixed(2)}:1 on ${DARK_SURFACE}`).toBeGreaterThanOrEqual(4.5);
  });

  // Pinned in both directions: the surface is the constant, and if the surface
  // changes the tones are no longer measured against the thing they ship on.
  it("the surface being measured against is the dark card, not the page", () => {
    expect(DARK_SURFACE).toBe("#141b16");
  });
});

describe("no tone collides with a state colour", () => {
  // A tone is the GROUND. Ground-level collisions do not announce themselves.
  it.each(KEYS)("%s stays clear of rose and amber", (key) => {
    for (const [stateName, stateHex] of Object.entries(STATE_GROUNDS)) {
      const d = distance(ACCOUNT_TONES[key].ground, stateHex);
      expect(d, `${key} is only ${d} from the ${stateName} state`).toBeGreaterThanOrEqual(90);
    }
  });

  it("and the threshold is one that would have rejected the pink credit tone", () => {
    // Proof the test bites. #f472b6 passed contrast at 6.62:1 and was rejected
    // here at 68 - the per-item check passed, the pairwise check failed.
    expect(contrast("#f472b6", DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(distance("#f472b6", STATE_GROUNDS.negative)).toBeLessThan(90);
  });
});

describe("the tones differ from each other, not only from the states", () => {
  // Two tones that look alike are as indistinguishable as one that looks like
  // a state, and the second failure is quieter.
  it.each(
    KEYS.flatMap((a, i) => KEYS.slice(i + 1).map((b) => [a, b] as const))
  )("%s and %s are separable", (a, b) => {
    const d = distance(ACCOUNT_TONES[a].ground, ACCOUNT_TONES[b].ground);
    expect(d, `${a}/${b} are only ${d} apart`).toBeGreaterThanOrEqual(90);
  });
});

describe("the RENDERED grounds separate, not just the specified hexes", () => {
  // The test above passes on the pure hex - a minimum of 95 - and the cards were
  // still indistinguishable, because a ground is a WASH. What renders is the
  // tone composited over the card surface, and two cards are compared against
  // EACH OTHER. At the original 7% the composited minimum was 7 while each
  // ground sat 12-23 from the untoned surface: the grounds were closer to one
  // another than to the absence of a ground, which is exactly the condition in
  // which a wash carries no information.
  //
  // So the threshold that matters lives here, on the composite, and it is
  // asserted in both directions.
  it.each(
    KEYS.flatMap((a, i) => KEYS.slice(i + 1).map((b) => [a, b] as const))
  )("rendered %s and %s are separable", (a, b) => {
    const da = compositedGround(ACCOUNT_TONES[a].ground);
    const db = compositedGround(ACCOUNT_TONES[b].ground);
    const d = toneDistance(da, db);
    expect(d, `rendered ${a}/${b} are only ${d} apart (${da} vs ${db})`).toBeGreaterThanOrEqual(15);
  });

  it("and the compositing is real - the pure hex is NOT what renders", () => {
    // Proof the assertion moved. If composites equalled the pure tones this
    // test could not fail, and the original bug would still be green.
    const bank = compositedGround(ACCOUNT_TONES.bank.ground);
    expect(bank).not.toBe(ACCOUNT_TONES.bank.ground);
    // #17b963 at 20% over #141b16 -> 20.6, 58.6, 37.4 -> 21, 59, 37 -> #153b25
    expect(bank).toBe("#153b25");
  });

  it("the original 7% would have failed this, and the current alpha does not", () => {
    // Both sides of the change, so the number cannot be quietly lowered back
    // into illegibility by someone who liked the subtle look.
    const at = (alpha: number) =>
      Math.min(
        ...KEYS.flatMap((a, i) =>
          KEYS.slice(i + 1).map((b) =>
            toneDistance(
              compositedGround(ACCOUNT_TONES[a].ground, alpha),
              compositedGround(ACCOUNT_TONES[b].ground, alpha)
            )
          )
        )
      );
    expect(at(0.07)).toBeLessThan(15);
    expect(at(GROUND_ALPHA)).toBeGreaterThanOrEqual(15);
  });

  it("every rendered ground is also visibly off the untoned surface", () => {
    // A ground that composites to the card surface is not a ground, however
    // separable it is from the other grounds.
    for (const key of KEYS) {
      const d = toneDistance(compositedGround(ACCOUNT_TONES[key].ground), DARK_SURFACE);
      expect(d, `${key} renders indistinguishable from an untoned card`).toBeGreaterThanOrEqual(15);
    }
  });

  it("the icon mark reads on the ground it sits on", () => {
    expect(ICON_ALPHA).toBeGreaterThan(GROUND_ALPHA);
  });
});

describe("every type in the closed set has a tone, and nothing else does", () => {
  it("the type set is exactly the five the schema allows", () => {
    // The closed set is the ceiling. A sixth tone would be decoration.
    expect(KEYS.sort()).toEqual(["bank", "cash", "credit", "digital_bank", "ewallet"]);
  });

  it("resolves every real type", () => {
    for (const key of KEYS) {
      expect(accountTone(key).ground).toBe(ACCOUNT_TONES[key].ground);
    }
  });

  it("falls back to cash rather than rendering no ground at all", () => {
    // A card with no ground reads as a MISSING tone, not as cash. The default
    // type is the honest fallback, and it must be explicit.
    expect(accountTone("something_new").ground).toBe(ACCOUNT_TONES.cash.ground);
    expect(accountTone(null).ground).toBe(ACCOUNT_TONES.cash.ground);
    expect(accountTone(undefined).ground).toBe(ACCOUNT_TONES.cash.ground);
    expect(accountTone("").ground).toBe(ACCOUNT_TONES.cash.ground);
  });
});
