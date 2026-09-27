/**
 * The account type's tone. The GROUND, not an accent.
 *
 * Why it exists: every account card was `bg-sulpot/10` and `text-sulpot` -
 * one green for all five types. Measured on /accounts, Maribank (a bank) and
 * Gcash (an e-wallet) rendered pixel-identical in tone. The ICON was already
 * type-derived; only the colour was missing. This wires the existing switch to
 * the ground rather than building new type infrastructure.
 *
 * ------------------------------------------------------------------
 * MEASURED, not chosen by eye. Both axes are in `account-tone.test.ts`:
 *
 *   contrast vs the dark card surface #141b16   all five >= 6.4:1 (need 4.5)
 *   distance from the state palette             all five >= 149 (need 90)
 *   distance from each OTHER tone               min 95 (need 90)
 *
 * Two candidates were rejected before this set existed:
 *
 *   credit as PINK #f472b6 - passed contrast at 6.62:1 and was still rejected,
 *   at distance 68 from the rose state. The collision test is what caught it,
 *   and it caught it because a tone is the GROUND: a pink credit card beside a
 *   negative rose card puts two meanings on one surface, and ground-level
 *   collisions do not announce themselves the way a bad border does.
 *
 *   credit as AMBER - not rejected, UNAVAILABLE. Amber is a state colour,
 *   measured in use in three places: the budgets progress bar, the bills
 *   "Incomplete" pill, and the transfer list. "Unavailable, not rejected" is
 *   the distinction that matters: one is this design's decision, the other is
 *   the system's.
 * ------------------------------------------------------------------
 *
 * State is NOT yielded to. Three layers, three surfaces, three jobs:
 *   ground  = type   (this file)      always present
 *   figure  = state  (the balance)    rose when negative
 *   accent  = state  (border/badge)   rose when negative
 *
 * `cash` is near-neutral stone, which is the tightest pair here (95 from
 * digital_bank). That is deliberate rather than a shortfall: cash is the
 * default account type and the fallback, and a neutral ground says "plain
 * money" in a way a fifth saturated hue would not. The icon and the name
 * still carry the type, so the ground is redundancy rather than the only
 * channel - which is also what makes yielding defensible if it is ever needed.
 */
export const ACCOUNT_TONES = {
  bank: { ground: "#17b963", label: "sulpot green" },
  ewallet: { ground: "#38bdf8", label: "sky" },
  digital_bank: { ground: "#a78bfa", label: "violet" },
  credit: { ground: "#a3e635", label: "lime" },
  cash: { ground: "#d6d3d1", label: "stone" },
} as const;

export type AccountTypeKey = keyof typeof ACCOUNT_TONES;

/** The state palette a tone must not collide with. Rose and amber, measured in use. */
export const STATE_GROUNDS = {
  negative: "#f06274",
  warning: "#d99213",
} as const;

/** The dark card surface every tone was measured against. */
export const DARK_SURFACE = "#141b16";

/**
 * The alpha the ground is painted at, and why it is not a taste value.
 *
 * The palette above is specified as PURE hex, and the original test measured
 * separation on those pure values - a minimum of 95, comfortably clear. The
 * cards were then unreadable.
 *
 * Because a ground is a WASH, what renders is not the tone: it is the tone at
 * `GROUND_ALPHA` composited over the card surface, and that composite is what
 * two cards are compared against. Measured at the original 7%:
 *
 * ```
 *   bank        #14261b   12 from untoned
 *   ewallet     #172626   20
 *   digital_bank #1e2326  20
 *   credit      #1e2918   17
 *   cash        #222823   23
 *
 *   tone-to-tone, composited: minimum 7   (digital_bank / cash)
 * ```
 *
 * **7 apart from each other, while 12-23 from nothing.** The grounds were closer
 * to one another than to the absence of a ground, which is precisely the
 * condition under which a wash carries no information. Two accounts of different
 * types were indistinguishable, and reading them as the same was correct.
 *
 * The eye compares the two cards to EACH OTHER, not to the blank page. So the
 * threshold that matters is tone-to-tone on the COMPOSITE, and the test now
 * asserts that rather than the pure hex. `GROUND_ALPHA` is the value at which
 * the composited minimum clears the floor, measured rather than chosen.
 *
 * The failure generalises: a test on the specified value is not a test on the
 * rendered one. Every token that passes through an alpha, a blend or a gradient
 * needs its assertion moved to the far side of that transform.
 */
export const GROUND_ALPHA = 0.2;

/** The icon's own fill behind the type mark. Above the ground so the mark reads on it. */
export const ICON_ALPHA = 0.28;

/** The dark card surface composited under a ground at `GROUND_ALPHA`. */
export function compositedGround(ground: string, alpha = GROUND_ALPHA): string {
  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [tr, tg, tb] = rgb(ground);
  const [sr, sg, sb] = rgb(DARK_SURFACE);
  const mix = (t: number, s: number) => Math.round(t * alpha + s * (1 - alpha));
  return (
    "#" +
    [mix(tr, sr), mix(tg, sg), mix(tb, sb)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** RGB euclidean distance - the "is this distinguishable" measure used throughout. */
export function toneDistance(a: string, b: string): number {
  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return Math.round(
    Math.sqrt(Math.pow(ar - br, 2) + Math.pow(ag - bg, 2) + Math.pow(ab - bb, 2))
  );
}

/**
 * The tone for an account type, falling back to `cash` - the default type, and
 * the one the DB uses for an unrecognised value. A missing key must not render
 * a card with no ground, which reads as a missing tone rather than cash.
 */
export function accountTone(type: string | null | undefined): {
  ground: string;
  label: string;
} {
  const key = (type ?? "cash") as AccountTypeKey;
  return ACCOUNT_TONES[key] ?? ACCOUNT_TONES.cash;
}
