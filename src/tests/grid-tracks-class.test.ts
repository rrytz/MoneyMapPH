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
  });

  it("honours the breakpoint prefix", () => {
    expect(gridTracksClass(2, "lg")).toBe("lg:grid-cols-2");
    expect(gridTracksClass(1, "lg")).toBe("");
  });

  it("THROWS on a track count it has no literal for", () => {
    // 3 is a plausible value nobody has wired up yet. It must not quietly
    // render one column.
    expect(() => gridTracksClass(3)).toThrow(/no literal class/);
    expect(() => gridTracksClass(0)).toThrow(/no literal class/);
    expect(() => gridTracksClass(7)).toThrow(/no literal class/);
  });

  it("every returned class is a complete, valid Tailwind utility", () => {
    // An interpolated class is only half-checked by Tailwind; a literal one is
    // scannable. Assert the shape so a typo cannot pass as a class.
    for (const t of [1, 2]) {
      const cls = gridTracksClass(t);
      if (cls === "") continue;
      expect(cls).toMatch(/^(sm|md|lg|xl):grid-cols-[1-9]$/);
    }
  });
});
