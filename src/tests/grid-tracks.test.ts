import { describe, expect, it } from "vitest";
import { gridTracksFor } from "@/lib/utils/grid-tracks";

describe("gridTracksFor", () => {
  it("closes a hole when the last row would be partly empty", () => {
    // The case that started this: /accounts had two accounts in a fixed
    // lg:grid-cols-3, leaving a 402px empty column.
    expect(gridTracksFor(2, 3)).toBe(2);
    expect(gridTracksFor(4, 3)).toBe(2);
    expect(gridTracksFor(1, 3)).toBe(1);
  });

  it("leaves an exactly-filled grid alone", () => {
    expect(gridTracksFor(3, 3)).toBe(3);
    expect(gridTracksFor(6, 3)).toBe(3);
    expect(gridTracksFor(4, 2)).toBe(2);
    expect(gridTracksFor(2, 2)).toBe(2);
  });

  it("never adds a row to remove a hole", () => {
    // Five items in a two-up is three rows with a lone card. One track would
    // fill every row but cost five rows, and a taller grid is worse than a
    // hole - so the rule declines, which is why /budgets keeps its lone card.
    expect(gridTracksFor(5, 2)).toBe(2);
    // Seven in a three-up is three rows with two empty. Two-up would be four.
    expect(gridTracksFor(7, 3)).toBe(3);
  });

  it("never returns fewer rows than the maximum-track layout", () => {
    // The invariant the "never adds a row" test leans on, checked exhaustively
    // rather than by example.
    for (let max = 1; max <= 6; max += 1) {
      for (let count = 1; count <= 24; count += 1) {
        const rowsAtMax = Math.ceil(count / max);
        const rows = Math.ceil(count / gridTracksFor(count, max));
        expect(rows, `${count} items at max ${max}`).toBeLessThanOrEqual(rowsAtMax);
        expect(gridTracksFor(count, max)).toBeLessThanOrEqual(max);
        expect(gridTracksFor(count, max)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("handles degenerate input", () => {
    expect(gridTracksFor(0, 3)).toBe(3);
    expect(gridTracksFor(0, 0)).toBe(1);
    expect(gridTracksFor(5, 1)).toBe(1);
  });
});
