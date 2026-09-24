import { describe, it, expect } from "vitest";
import { getHealthScoreBreakdown, SAVINGS_RATE_LABEL } from "@/lib/utils/health-breakdown";
import type { FinancialHealthReport } from "@/lib/types";

const breakdown: FinancialHealthReport["breakdown"] = {
  emergencyFundScore: 24,
  savingsRateScore: 15,
  budgetAdherenceScore: 18,
  paycheckAllocationScore: 10,
};

describe("health-breakdown — shared score-component derivation", () => {
  it("renders the same pct numbers as the pre-dedupe inline math (score/denominator * 100)", () => {
    expect(getHealthScoreBreakdown(breakdown)).toEqual([
      { key: "emergencyFundScore", label: "Emergency Score", pct: 80 }, // 24/30 → 80
      { key: "savingsRateScore", label: "Savings Score", pct: 50 }, // 15/30 → 50
      { key: "budgetAdherenceScore", label: "Budget Score", pct: 90 }, // 18/20 → 90
      { key: "paycheckAllocationScore", label: "Paycheck Score", pct: 50 }, // 10/20 → 50
    ]);
  });

  it("component labels never collide with the KPI savings-rate label", () => {
    const labels = getHealthScoreBreakdown(breakdown).map((c) => c.label);
    expect(labels).not.toContain(SAVINGS_RATE_LABEL);
    expect(SAVINGS_RATE_LABEL).toBe("Savings Rate");
  });

  it("is deterministic (pure function)", () => {
    expect(getHealthScoreBreakdown(breakdown)).toEqual(getHealthScoreBreakdown(breakdown));
  });
});