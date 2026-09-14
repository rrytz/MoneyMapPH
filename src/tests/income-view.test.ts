import { describe, it, expect } from "vitest";
import { resolveIncomeViewEntries, isInShownMonth } from "@/lib/utils/income-view";
import type { IncomeEntry } from "@/lib/types";

const entry = (over: Partial<IncomeEntry> = {}): IncomeEntry => ({
  id: "e1",
  user_id: "u1",
  amount: 100,
  source_id: "s1",
  date: "2026-09-08",
  notes: null,
  paycheck_id: null,
  created_at: "x",
  updated_at: "x",
  ...over,
});

describe("resolveIncomeViewEntries", () => {
  const monthEntries = [entry({ id: "m1", date: "2026-09-01" })];
  const allEntries = [
    entry({ id: "a1", date: "2026-07-28" }),
    entry({ id: "m1b", date: "2026-09-01" }),
  ];

  it("returns month entries for the default view", () => {
    expect(resolveIncomeViewEntries(monthEntries, allEntries, "month")).toBe(monthEntries);
    expect(resolveIncomeViewEntries(monthEntries, allEntries, undefined)).toBe(monthEntries);
  });

  it("returns the all-history list for the 'all' view", () => {
    expect(resolveIncomeViewEntries(monthEntries, allEntries, "all")).toBe(allEntries);
  });
});

describe("isInShownMonth", () => {
  it("is true when the entry date falls in the shown month", () => {
    expect(isInShownMonth("2026-09-08", 9, 2026)).toBe(true);
    expect(isInShownMonth("2026-09-01", 9, 2026)).toBe(true);
  });

  it("is false for other months and years", () => {
    expect(isInShownMonth("2026-07-28", 9, 2026)).toBe(false);
    expect(isInShownMonth("2025-09-08", 9, 2026)).toBe(false);
  });

  it("handles malformed dates gracefully", () => {
    expect(isInShownMonth("", 9, 2026)).toBe(false);
    expect(isInShownMonth("not-a-date", 9, 2026)).toBe(false);
  });
});