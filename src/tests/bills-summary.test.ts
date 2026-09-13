import { describe, it, expect } from "vitest";
import { classifySummaryVerdict } from "@/lib/utils/bills-summary";

describe("classifySummaryVerdict", () => {
  it("covered when upcoming fits within safe-to-spend", () => {
    expect(classifySummaryVerdict(1000, 5000)).toBe("covered");
    expect(classifySummaryVerdict(0, 500)).toBe("covered");
  });
  it("tight when upcoming exceeds the 75% comfortable band but is still within the remaining money", () => {
    expect(classifySummaryVerdict(4200, 5000)).toBe("tight");
  });
  it("short when upcoming exceeds what's left, or nothing is left", () => {
    expect(classifySummaryVerdict(6000, 5000)).toBe("short");
    expect(classifySummaryVerdict(100, -50)).toBe("short");
    expect(classifySummaryVerdict(100, 0)).toBe("short");
  });
});