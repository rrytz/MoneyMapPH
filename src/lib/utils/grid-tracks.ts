/**
 * How many tracks a card grid should use for `count` items, given a maximum.
 *
 * A fixed column count meeting a variable item count leaves a hole: three
 * tracks and two items is one empty column. Measured on /accounts, that was a
 * 402px empty column worth 97,284 px^2 - more dead space than the 75,783 px^2
 * of column slack the /budgets composition pass spent two slices reducing.
 *
 * So: pick the track count that wastes the fewest slots *without adding a row*.
 * Adding a row is never worth it, which is why the rule declines some grids
 * outright - five items in a two-up stays two-up, because one-up would be five
 * rows instead of three. The hole is the cheaper problem.
 *
 *   2 items, max 3 -> 2   (was 3: one empty column, same single row)
 *   1 item,  max 3 -> 1   (was 3: two empty columns)
 *   4 items, max 3 -> 2   (was 3: two empty slots, same two rows)
 *   6 items, max 3 -> 3   (already exact)
 *   5 items, max 2 -> 2   (declined: one-up would be five rows, not three)
 *   7 items, max 3 -> 3   (declined: two-up would be four rows, not three)
 */
export function gridTracksFor(count: number, maxTracks: number): number {
  if (maxTracks < 1) return 1;
  if (count <= 0) return maxTracks;

  const rowsAtMax = Math.ceil(count / maxTracks);
  let best = maxTracks;
  let bestWaste = Math.ceil(count / maxTracks) * maxTracks - count;

  for (let tracks = maxTracks - 1; tracks >= 1; tracks -= 1) {
    if (Math.ceil(count / tracks) > rowsAtMax) continue; // would add a row
    const waste = Math.ceil(count / tracks) * tracks - count;
    if (waste < bestWaste) {
      best = tracks;
      bestWaste = waste;
    }
  }
  return best;
}
