import { describe, it, expect } from "vitest";
import { resolveViewMonth, isValidMonthYear } from "@/lib/utils/view-month";

const CURRENT = { month: 9, year: 2026 };

describe("resolveViewMonth", () => {
  it("uses valid month/year query params", () => {
    expect(resolveViewMonth("8", "2026", CURRENT)).toEqual({ month: 8, year: 2026 });
  });

  it("falls back to the current month when params are missing", () => {
    expect(resolveViewMonth(undefined, undefined, CURRENT)).toEqual(CURRENT);
    expect(resolveViewMonth("8", undefined, CURRENT)).toEqual(CURRENT);
    expect(resolveViewMonth(undefined, "2026", CURRENT)).toEqual(CURRENT);
  });

  it("falls back to the current month for invalid values", () => {
    expect(resolveViewMonth("0", "2026", CURRENT)).toEqual(CURRENT); // month 0
    expect(resolveViewMonth("13", "2026", CURRENT)).toEqual(CURRENT); // month 13
    expect(resolveViewMonth("8", "1999", CURRENT)).toEqual(CURRENT); // year too small
    expect(resolveViewMonth("8", "2101", CURRENT)).toEqual(CURRENT); // year too large
    expect(resolveViewMonth("abc", "2026", CURRENT)).toEqual(CURRENT);
    expect(resolveViewMonth("8", "abc", CURRENT)).toEqual(CURRENT);
    expect(resolveViewMonth("8.5", "2026", CURRENT)).toEqual(CURRENT); // not an integer
    expect(resolveViewMonth("", "2026", CURRENT)).toEqual(CURRENT); // empty string
  });

  it("accepts the first element when params are string arrays", () => {
    expect(resolveViewMonth(["8"], ["2026"], CURRENT)).toEqual({ month: 8, year: 2026 });
  });
});

describe("isValidMonthYear", () => {
  it("bounds checks month and year", () => {
    expect(isValidMonthYear(1, 2000)).toBe(true);
    expect(isValidMonthYear(12, 2100)).toBe(true);
    expect(isValidMonthYear(0, 2026)).toBe(false);
    expect(isValidMonthYear(13, 2026)).toBe(false);
    expect(isValidMonthYear(8, 1999)).toBe(false);
    expect(isValidMonthYear(8, 2101)).toBe(false);
    expect(isValidMonthYear(8.5, 2026)).toBe(false);
  });
});