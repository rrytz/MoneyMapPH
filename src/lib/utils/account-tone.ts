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
