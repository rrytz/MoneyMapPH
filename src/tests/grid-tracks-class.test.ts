import { describe, expect, it } from "vitest";
import { gridTracksClass } from "@/lib/utils/grid-tracks";

describe("the track class is a literal, not an interpolation", () => {
  // The failure this exists to prevent is SILENT. `grid-cols-${tracks}` compiles
  // to nothing when the value was not in Tailwind's scanned set: no error, no
  // warning, the grid just quietly falls back to one column and looks like a
  // decision. So the contract is that an unknown track count is loud.
  it("returns a real class for the counts gridTracksFor can produce", () => {
    expect(gridTracksClass(1)).toBe("");
    expect(gridTracksClass(2)).toBe("sm:grid-cols-2");
    // 3 exists because /accounts asks for it at `lg`, where maxTracks is 3.
    // It is a literal for the same reason 2 is: an interpolated `grid-cols-3`
    // is a class allowed to not exist.
    expect(gridTracksClass(3)).toBe("sm:grid-cols-3");
  });

  it("honours the breakpoint prefix", () => {
    expect(gridTracksClass(2, "lg")).toBe("lg:grid-cols-2");
    expect(gridTracksClass(3, "lg")).toBe("lg:grid-cols-3");
    expect(gridTracksClass(1, "lg")).toBe("");
  });

  it("an EMPTY prefix gives the BASE class, with no breakpoint", () => {
    // This is the difference between a grid that pairs on a 375px phone and one
    // that waits for 640px. Defaulting to `sm` here shipped a card grid that
    // stayed one-up on mobile and looked like the rule simply had not applied.
    expect(gridTracksClass(2, "")).toBe("grid-cols-2");
    expect(gridTracksClass(3, "")).toBe("grid-cols-3");
    // and it must not produce a leading colon
    expect(gridTracksClass(2, "")).not.toContain(":");
  });

  it("THROWS on a track count it has no literal for", () => {
    // 4 is a plausible value nobody has wired up yet. It must not quietly
    // render one column.
    expect(() => gridTracksClass(4)).toThrow(/no literal class/);
    expect(() => gridTracksClass(0)).toThrow(/no literal class/);
    expect(() => gridTracksClass(7)).toThrow(/no literal class/);
  });

  it("every returned class is a complete, valid Tailwind utility", () => {
    // An interpolated class is only half-checked by Tailwind; a literal one is
    // scannable. Assert the shape so a typo cannot pass as a class.
    for (const t of [1, 2, 3]) {
      const cls = gridTracksClass(t);
      if (cls === "") continue;
      expect(cls).toMatch(/^(sm|md|lg|xl):grid-cols-[1-9]$/);
    }
  });
});
