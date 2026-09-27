/**
 * How many tracks a card grid should use, given how many tracks its items
 * currently occupy and the most it is allowed.
 *
 * A fixed column count meeting a variable item count leaves a hole: three
 * tracks and two items is one empty column. Measured on /accounts, that was a
 * 402px empty column worth 97,284 px^2 - more dead space than the 75,783 px^2
 * of column slack the /budgets composition pass spent two slices reducing.
 *
 * So: pick the track count that wastes the fewest slots *without adding a row*.
 * Adding a row is never worth it, which is why the rule declines some grids
 * outright rather than pretending to help.
 *
 *   2 occupied, max 3 -> 2   closes the /accounts hole; cards 402px -> 610px
 *   1 occupied, max 3 -> 1   two empty columns become none
 *   4 occupied, max 3 -> 2   two empty slots become none, same two rows
 *   6 occupied, max 3 -> 3   already exact
 *   5 occupied, max 2 -> 2   DECLINED: one track would be five rows, not three
 *   7 occupied, max 3 -> 3   DECLINED: two tracks would be four rows, not three
 *
 * ---------------------------------------------------------------------------
 * PRECONDITION: the first argument is OCCUPIED TRACKS, not a child count.
 *
 * Those are the same number only for a grid of uniform children. They differ
 * the moment a child spans more than one track, and passing a child count
 * there is not a near miss - it breaks the layout.
 *
 * /simulator is the worked example, and the reason this note exists. Its grid
 * is `lg:grid-cols-3` holding two children: a one-column form, and a results
 * panel with `lg:col-span-2`. Measured, the children cover 1 + 2 = 3 tracks
 * and there is no hole at all. Handed a child count of 2 this function returns
 * 2, and a two-track grid whose second child claims two tracks overflows its
 * row. So: a probe that compares child count against track count reports a
 * hole that is not there, and this function would "fix" it into a broken one.
 *
 * Counting children is how that false positive was found. The child count was
 * the number; the occupied tracks were the fact.
 *
 * For a uniform grid - every child one track - the child count IS the occupied
 * count, which is why the two call sites can pass it straight through. Both
 * were checked: no col-span in either.
 * ---------------------------------------------------------------------------
 */
/**
 * The Tailwind class for a track count, as a LITERAL.
 *
 * This exists because `grid-cols-${tracks}` compiles to nothing when the value
 * is not in Tailwind's scanned set, and the failure is silent: the grid falls
 * back to one column and looks deliberate. A class assembled by interpolation
 * is a class that is allowed to not exist, with no error to say so.
 *
 * So the two track counts `gridTracksFor` can return are spelled out, and an
 * unrecognised value throws rather than rendering a single column.
 */
export function gridTracksClass(tracks: number, prefix = "sm"): string {
  // An EMPTY prefix means the base class, with no breakpoint - which is the
  // whole difference between a grid that pairs on a phone and one that waits
  // for 640px. Getting this wrong produced `sm:grid-cols-2` on a 375px
  // viewport, which renders one column and looks like the rule did not apply.
  const at = (base: string) => (prefix ? `${prefix}:${base}` : base);
  const literal: Record<number, string> = {
    1: "",
    2: at("grid-cols-2"),
    3: at("grid-cols-3"),
  };
  const cls = literal[tracks];
  if (cls === undefined) {
    throw new Error(
      `gridTracksClass: no literal class for ${tracks} tracks. ` +
        `Add it to the map, or Tailwind will silently render one column.`
    );
  }
  return cls;
}

export function gridTracksFor(occupiedTracks: number, maxTracks: number): number {
  if (maxTracks < 1) return 1;
  if (occupiedTracks <= 0) return maxTracks;

  const rowsAtMax = Math.ceil(occupiedTracks / maxTracks);
  let best = maxTracks;
  let bestWaste = Math.ceil(occupiedTracks / maxTracks) * maxTracks - occupiedTracks;

  for (let tracks = maxTracks - 1; tracks >= 1; tracks -= 1) {
    if (Math.ceil(occupiedTracks / tracks) > rowsAtMax) continue; // would add a row
    const waste = Math.ceil(occupiedTracks / tracks) * tracks - occupiedTracks;
    if (waste < bestWaste) {
      best = tracks;
      bestWaste = waste;
    }
  }
  return best;
}
