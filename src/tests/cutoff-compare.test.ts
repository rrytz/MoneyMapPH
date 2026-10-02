import { describe, expect, it } from "vitest";
import { hasPredecessorData } from "@/components/dashboard/balance-block";
import type { SafeToSpendStatus } from "@/lib/types";

// hasPredecessorData: an all-zero predecessor is "no history", not "a quiet
// fortnight" - rendering its zeros would state "spent nothing last period".
const base: SafeToSpendStatus = {
  periodStart: "2026-09-14",
  periodEnd: "2026-09-28",
  payoutDate: "2026-09-26",
  coreIncome: 10000,
  incentiveIncomeLogged: 0,
  spentThisPeriod: 9000,
  safeToSpend: 1000,
  hasPaychecks: true,
  daysTotal: 15,
  daysElapsed: 15,
  daysRemaining: 0,
  fractionElapsed: 1,
};

describe("hasPredecessorData", () => {
  it("is false for null", () => {
    expect(hasPredecessorData(null)).toBe(false);
    expect(hasPredecessorData(undefined)).toBe(false);
  });

  it("is false when every figure is zero (no history, not a quiet period)", () => {
    expect(
      hasPredecessorData({ ...base, coreIncome: 0, incentiveIncomeLogged: 0, spentThisPeriod: 0 })
    ).toBe(false);
  });

  it("is true when any figure is nonzero", () => {
    expect(hasPredecessorData(base)).toBe(true);
    expect(
      hasPredecessorData({ ...base, coreIncome: 0, incentiveIncomeLogged: 0, spentThisPeriod: 250 })
    ).toBe(true);
  });
});
