/**
 * Unit tests for simulation.service.ts
 *
 * calculatePurchaseImpact is a pure synchronous function — no Supabase dependency.
 * We test it directly without mocking.
 */

import { describe, it, expect } from "vitest";
import { calculatePurchaseImpact } from "@/lib/services/simulation.service";
import type { EmergencyFundStatus } from "@/lib/services/forecast.service";
import type { SavingsGoal } from "@/lib/types";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const ADEQUATE_EF: EmergencyFundStatus = {
  hasFund: true,
  currentBalance: 90000,
  targetAmount: 90000,
  averageExpenses: 15000,
  monthsCovered: 6,
  status: "adequate",
};

const NO_EF: EmergencyFundStatus = {
  hasFund: false,
  currentBalance: 0,
  targetAmount: 0,
  averageExpenses: 0,
  monthsCovered: 0,
  status: "not_configured",
};

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: "g1",
    user_id: "u1",
    name: "Travel Fund",
    target_amount: 50000,
    current_amount: 10000,
    target_date: null,
    notes: null,
    is_emergency_fund: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("calculatePurchaseImpact — emergency fund impact", () => {
  it("reduces afterBalance by purchaseAmount", () => {
    const impact = calculatePurchaseImpact(20000, ADEQUATE_EF, [], 5000);

    expect(impact.emergencyFundImpact.afterBalance).toBe(70000);
    expect(impact.emergencyFundImpact.beforeBalance).toBe(90000);
  });

  it("afterBalance cannot go below 0", () => {
    const impact = calculatePurchaseImpact(200000, ADEQUATE_EF, [], 5000);

    expect(impact.emergencyFundImpact.afterBalance).toBeGreaterThanOrEqual(0);
  });

  it("afterMonthsCovered decreases proportionally", () => {
    const impact = calculatePurchaseImpact(30000, ADEQUATE_EF, [], 5000);

    // afterBalance = 60000, averageExpenses = 15000 → 4 months
    expect(impact.emergencyFundImpact.afterMonthsCovered).toBeCloseTo(4, 1);
  });

  it("isSeverelyImpacted is true when purchase drops adequate→critical", () => {
    // Purchase 75000 from 90000 balance → afterBalance = 15000 → 1 month → critical
    const impact = calculatePurchaseImpact(75000, ADEQUATE_EF, [], 5000);

    expect(impact.emergencyFundImpact.afterStatus).toBe("critical");
    expect(impact.emergencyFundImpact.isSeverelyImpacted).toBe(true);
  });

  it("isSeverelyImpacted is false when no emergency fund (hasFund = false)", () => {
    const impact = calculatePurchaseImpact(10000, NO_EF, [], 5000);

    expect(impact.emergencyFundImpact.isSeverelyImpacted).toBe(false);
  });

  it("afterMonthsCovered is 0 when averageExpenses is 0 (no Infinity)", () => {
    const zeroExpEF: EmergencyFundStatus = {
      ...ADEQUATE_EF,
      averageExpenses: 0,
    };
    const impact = calculatePurchaseImpact(10000, zeroExpEF, [], 5000);

    expect(Number.isFinite(impact.emergencyFundImpact.afterMonthsCovered)).toBe(true);
    expect(impact.emergencyFundImpact.afterMonthsCovered).toBe(0);
  });
});

describe("calculatePurchaseImpact — goals timeline impact", () => {
  it("returns delayMonths as purchaseAmount / monthlyNetSavings", () => {
    const goal = makeGoal();
    const impact = calculatePurchaseImpact(10000, ADEQUATE_EF, [goal], 5000);

    // delay = ceil(10000 / 5000) = 2 months
    expect(impact.goalsImpact[0].delayMonths).toBe(2);
  });

  it("delayMonths is 'infinite' when monthlyNetSavings is 0", () => {
    const goal = makeGoal();
    const impact = calculatePurchaseImpact(10000, ADEQUATE_EF, [goal], 0);

    expect(impact.goalsImpact[0].delayMonths).toBe("infinite");
    expect(impact.goalsImpact[0].afterMonthsToReach).toBe("infinite");
  });

  it("beforeMonthsToReach = 0 for already-achieved goals", () => {
    const completedGoal = makeGoal({ current_amount: 50000, target_amount: 50000 });
    const impact = calculatePurchaseImpact(5000, ADEQUATE_EF, [completedGoal], 5000);

    expect(impact.goalsImpact[0].beforeMonthsToReach).toBe(0);
    expect(impact.goalsImpact[0].afterMonthsToReach).toBe(0);
  });

  it("afterMonthsToReach adds delayMonths to beforeMonthsToReach", () => {
    const goal = makeGoal({ current_amount: 0, target_amount: 30000 });
    const impact = calculatePurchaseImpact(5000, ADEQUATE_EF, [goal], 5000);

    // before = ceil(30000/5000) = 6, delay = ceil(5000/5000) = 1, after = 7
    const goalImpact = impact.goalsImpact[0];
    expect(goalImpact.beforeMonthsToReach).toBe(6);
    expect(goalImpact.afterMonthsToReach).toBe(7);
    expect(goalImpact.delayMonths).toBe(1);
  });

  it("handles multiple goals independently", () => {
    const goals = [
      makeGoal({ id: "g1", current_amount: 0, target_amount: 10000 }),
      makeGoal({ id: "g2", current_amount: 5000, target_amount: 50000 }),
    ];
    const impact = calculatePurchaseImpact(5000, ADEQUATE_EF, goals, 5000);

    expect(impact.goalsImpact).toHaveLength(2);
    expect(impact.goalsImpact[0].id).toBe("g1");
    expect(impact.goalsImpact[1].id).toBe("g2");
  });

  it("returns empty goalsImpact array when no goals", () => {
    const impact = calculatePurchaseImpact(10000, ADEQUATE_EF, [], 5000);

    expect(impact.goalsImpact).toHaveLength(0);
  });

  it("purchaseAmount is echoed in the result", () => {
    const impact = calculatePurchaseImpact(25000, ADEQUATE_EF, [], 5000);

    expect(impact.purchaseAmount).toBe(25000);
  });
});
