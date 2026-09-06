/**
 * Unit tests for forecast.service.ts
 *
 * Covers:
 * - calculateMonthlyNetSavings: zero snapshots, real snapshots, fallback
 * - calculateEmergencyFundStatus: zero average expenses (Infinity guard)
 * - generateSavingsForecast: shape of output
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Mock all upstream services ───────────────────────────────────────────────

vi.mock("@/lib/services/snapshot.service", () => ({
  getSnapshots: vi.fn(),
}));
vi.mock("@/lib/services/goal.service", () => ({
  getSavingsGoals: vi.fn(),
}));
vi.mock("@/lib/services/financial.service", () => ({
  getMonthlySummary: vi.fn(),
}));
vi.mock("@/lib/utils/date", () => ({
  getCurrentMonthYear: () => ({ month: 9, year: 2026 }),
  getMonthName: (m: number) => {
    const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return names[(m - 1) % 12];
  },
}));

import { getSnapshots } from "@/lib/services/snapshot.service";
import { getSavingsGoals } from "@/lib/services/goal.service";
import { getMonthlySummary } from "@/lib/services/financial.service";
import {
  calculateMonthlyNetSavings,
  calculateEmergencyFundStatus,
  generateSavingsForecast,
} from "@/lib/services/forecast.service";

const mockGetSnapshots = getSnapshots as ReturnType<typeof vi.fn>;
const mockGetSavingsGoals = getSavingsGoals as ReturnType<typeof vi.fn>;
const mockGetMonthlySummary = getMonthlySummary as ReturnType<typeof vi.fn>;

const MOCK_SUPABASE = {} as SupabaseClient;
const USER_ID = "user-forecast";

describe("calculateMonthlyNetSavings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 0 (not a fallback constant) when there are no snapshots and no budget data", async () => {
    mockGetSnapshots.mockResolvedValue([]);
    mockGetMonthlySummary.mockRejectedValue(new Error("no budget"));

    const result = await calculateMonthlyNetSavings(MOCK_SUPABASE, USER_ID);

    expect(result).toBe(0);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("returns 0 when there are no snapshots and budget net is 0", async () => {
    mockGetSnapshots.mockResolvedValue([]);
    mockGetMonthlySummary.mockResolvedValue({
      totalIncome: 5000, totalExpenses: 5000,
      savingsRate: 0, totalBudget: 5000, remainingBudget: 0,
      savingsAmount: 0, categorySpending: {}, incomeBySource: {}, budgetUtilization: 100,
    });

    const result = await calculateMonthlyNetSavings(MOCK_SUPABASE, USER_ID);

    expect(result).toBe(0);
  });

  it("computes average net savings from snapshot history", async () => {
    mockGetSnapshots.mockResolvedValue([
      { total_income: 20000, total_expenses: 14000, month: 7, year: 2026 },
      { total_income: 20000, total_expenses: 16000, month: 8, year: 2026 },
    ]);

    const result = await calculateMonthlyNetSavings(MOCK_SUPABASE, USER_ID);

    // Avg: ((20000-14000) + (20000-16000)) / 2 = (6000 + 4000) / 2 = 5000
    expect(result).toBe(5000);
  });

  it("caps net savings at 0 (no negative projections)", async () => {
    mockGetSnapshots.mockResolvedValue([
      { total_income: 10000, total_expenses: 15000, month: 8, year: 2026 },
    ]);

    const result = await calculateMonthlyNetSavings(MOCK_SUPABASE, USER_ID);

    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("returns a finite number always (NaN/Infinity guard)", async () => {
    mockGetSnapshots.mockResolvedValue([
      { total_income: 0, total_expenses: 0, month: 8, year: 2026 },
    ]);

    const result = await calculateMonthlyNetSavings(MOCK_SUPABASE, USER_ID);

    expect(Number.isFinite(result)).toBe(true);
    expect(Number.isNaN(result)).toBe(false);
  });
});

describe("calculateEmergencyFundStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not_configured status when no emergency fund goal exists", async () => {
    mockGetSavingsGoals.mockResolvedValue([
      { id: "g1", name: "Travel", is_emergency_fund: false, current_amount: 5000, target_amount: 50000, target_date: null },
    ]);

    const result = await calculateEmergencyFundStatus(MOCK_SUPABASE, USER_ID);

    expect(result.hasFund).toBe(false);
    expect(result.status).toBe("not_configured");
    expect(result.monthsCovered).toBe(0);
  });

  it("returns insufficient_data when no snapshots and no budget (averageExpenses = 0)", async () => {
    mockGetSavingsGoals.mockResolvedValue([
      { id: "ef1", name: "Emergency Fund", is_emergency_fund: true, current_amount: 30000, target_amount: 90000, target_date: null },
    ]);
    mockGetSnapshots.mockResolvedValue([]); // no history
    mockGetMonthlySummary.mockResolvedValue({
      totalBudget: 0, totalIncome: 0, totalExpenses: 0, remainingBudget: 0,
      savingsAmount: 0, savingsRate: 0, categorySpending: {}, incomeBySource: {}, budgetUtilization: 0,
    });

    const result = await calculateEmergencyFundStatus(MOCK_SUPABASE, USER_ID);

    // averageExpenses = 0 → cannot divide → status insufficient_data
    expect(result.status).toBe("insufficient_data");
    expect(result.hasFund).toBe(true);
    // monthsCovered must not be Infinity
    expect(Number.isFinite(result.monthsCovered)).toBe(true);
  });

  it("returns adequate status when emergency fund covers >= 6 months", async () => {
    mockGetSavingsGoals.mockResolvedValue([
      { id: "ef1", name: "Emergency Fund", is_emergency_fund: true, current_amount: 90000, target_amount: 90000, target_date: null },
    ]);
    mockGetSnapshots.mockResolvedValue([
      { total_income: 25000, total_expenses: 15000, month: 7, year: 2026 },
    ]);

    const result = await calculateEmergencyFundStatus(MOCK_SUPABASE, USER_ID);

    // 90000 / 15000 = 6 months
    expect(result.monthsCovered).toBeCloseTo(6, 1);
    expect(result.status).toBe("adequate");
  });

  it("returns critical status when emergency fund covers < 3 months", async () => {
    mockGetSavingsGoals.mockResolvedValue([
      { id: "ef1", name: "Emergency Fund", is_emergency_fund: true, current_amount: 10000, target_amount: 90000, target_date: null },
    ]);
    mockGetSnapshots.mockResolvedValue([
      { total_income: 25000, total_expenses: 15000, month: 7, year: 2026 },
    ]);

    const result = await calculateEmergencyFundStatus(MOCK_SUPABASE, USER_ID);

    // 10000 / 15000 = 0.67 months → critical
    expect(result.monthsCovered).toBeLessThan(3);
    expect(result.status).toBe("critical");
  });
});

describe("generateSavingsForecast", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 12 future forecast data points", async () => {
    mockGetSnapshots.mockResolvedValue([]);
    mockGetSavingsGoals.mockResolvedValue([
      { id: "g1", name: "Travel", is_emergency_fund: false, current_amount: 20000, target_amount: 100000, target_date: null },
    ]);
    mockGetMonthlySummary.mockResolvedValue({
      totalIncome: 25000, totalExpenses: 18000, savingsRate: 28,
      totalBudget: 20000, remainingBudget: 2000, savingsAmount: 7000,
      categorySpending: {}, incomeBySource: {}, budgetUtilization: 90,
    });

    const forecast = await generateSavingsForecast(MOCK_SUPABASE, USER_ID);

    const futurePoints = forecast.filter((p) => p.forecasted !== undefined && p.historical === undefined);
    expect(futurePoints).toHaveLength(12);
  });

  it("forecasted balances are always non-negative", async () => {
    mockGetSnapshots.mockResolvedValue([
      { total_income: 10000, total_expenses: 15000, month: 8, year: 2026 }, // negative net → capped at 0
    ]);
    mockGetSavingsGoals.mockResolvedValue([
      { id: "g1", name: "Emergency Fund", is_emergency_fund: true, current_amount: 5000, target_amount: 50000, target_date: null },
    ]);

    const forecast = await generateSavingsForecast(MOCK_SUPABASE, USER_ID);

    for (const point of forecast) {
      if (typeof point.forecasted === "number") {
        expect(point.forecasted).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
