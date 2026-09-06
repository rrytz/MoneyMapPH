/**
 * Unit tests for health.service.ts
 *
 * The health score is composed of 4 sub-scores:
 *   - savingsRateScore   (0-30)
 *   - emergencyFundScore (0-30)
 *   - budgetAdherenceScore (0-20)
 *   - paycheckAllocationScore (0-20)
 *
 * We mock all upstream service calls and test the scoring logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all service dependencies ───────────────────────────────────────────

vi.mock("@/lib/services/financial.service", () => ({
  getMonthlySummary: vi.fn(),
  getBudgetStatuses: vi.fn(),
}));
vi.mock("@/lib/services/forecast.service", () => ({
  calculateEmergencyFundStatus: vi.fn(),
}));
vi.mock("@/lib/services/paycheck.service", () => ({
  getPaychecks: vi.fn(),
}));
vi.mock("@/lib/utils/date", () => ({
  getCurrentMonthYear: () => ({ month: 9, year: 2026 }),
}));

import { getMonthlySummary, getBudgetStatuses } from "@/lib/services/financial.service";
import { calculateEmergencyFundStatus } from "@/lib/services/forecast.service";
import { getPaychecks } from "@/lib/services/paycheck.service";
import { calculateFinancialHealthReport } from "@/lib/services/health.service";

// Typed mocks
const mockGetMonthlySummary = getMonthlySummary as ReturnType<typeof vi.fn>;
const mockGetBudgetStatuses = getBudgetStatuses as ReturnType<typeof vi.fn>;
const mockCalculateEmergencyFundStatus = calculateEmergencyFundStatus as ReturnType<typeof vi.fn>;
const mockGetPaychecks = getPaychecks as ReturnType<typeof vi.fn>;

const MOCK_SUPABASE = {} as never;
const USER_ID = "user-health";

// Default "ideal" state — healthy user
function setupIdealUser() {
  mockGetMonthlySummary.mockResolvedValue({
    totalIncome: 30000,
    totalExpenses: 18000,
    totalBudget: 25000,
    remainingBudget: 7000,
    savingsAmount: 12000,
    savingsRate: 40, // above 30% => max savings score
    categorySpending: {},
    incomeBySource: {},
    budgetUtilization: 72,
  });
  mockCalculateEmergencyFundStatus.mockResolvedValue({
    hasFund: true,
    currentBalance: 90000,
    targetAmount: 90000,
    averageExpenses: 15000,
    monthsCovered: 6, // adequate
    status: "adequate",
  });
  mockGetBudgetStatuses.mockResolvedValue([
    { categoryId: "c1", categoryName: "Food", status: "under", percentage: 60, budgeted: 5000, spent: 3000, remaining: 2000, categoryIcon: null, categoryColor: null },
    { categoryId: "c2", categoryName: "Transport", status: "under", percentage: 50, budgeted: 3000, spent: 1500, remaining: 1500, categoryIcon: null, categoryColor: null },
  ]);
  mockGetPaychecks.mockResolvedValue([
    { id: "p1", amount: 30000, name: "Salary", allocations: [{ amount: 30000 }] },
  ]);
}

describe("calculateFinancialHealthReport — score composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupIdealUser();
  });

  it("returns a total score between 0 and 100", async () => {
    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("returns score = 100 for fully healthy profile (savings >= 30%, 6-month EF, no over-budget, fully allocated)", async () => {
    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);
    expect(report.score).toBe(100);
    expect(report.grade).toBe("Excellent");
  });

  it("breakdown sub-scores sum equals overall score", async () => {
    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);
    const { savingsRateScore, emergencyFundScore, budgetAdherenceScore, paycheckAllocationScore } = report.breakdown;
    expect(savingsRateScore + emergencyFundScore + budgetAdherenceScore + paycheckAllocationScore).toBe(report.score);
  });

  it("savingsRateScore is 0 when income is zero (NaN guard)", async () => {
    mockGetMonthlySummary.mockResolvedValue({
      totalIncome: 0,
      totalExpenses: 0,
      savingsRate: 0,
      categorySpending: {},
      incomeBySource: {},
      totalBudget: 0,
      remainingBudget: 0,
      savingsAmount: 0,
      budgetUtilization: 0,
    });

    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);

    expect(report.breakdown.savingsRateScore).toBe(0);
    expect(Number.isFinite(report.score)).toBe(true);
    expect(Number.isNaN(report.score)).toBe(false);
  });

  it("emergencyFundScore is 0 when no emergency fund configured", async () => {
    mockCalculateEmergencyFundStatus.mockResolvedValue({
      hasFund: false,
      currentBalance: 0,
      targetAmount: 0,
      averageExpenses: 0,
      monthsCovered: 0,
      status: "not_configured",
    });

    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);

    expect(report.breakdown.emergencyFundScore).toBe(0);
  });

  it("emergencyFundScore is 0 when monthsCovered is Infinity (guard)", async () => {
    mockCalculateEmergencyFundStatus.mockResolvedValue({
      hasFund: true,
      currentBalance: 99999,
      targetAmount: 99999,
      averageExpenses: 0,
      monthsCovered: Infinity, // edge case: zero average expenses
      status: "adequate",
    });

    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);

    // With Infinity, isFinite guard should clamp to 0 or a finite value
    expect(Number.isFinite(report.breakdown.emergencyFundScore)).toBe(true);
    expect(Number.isNaN(report.breakdown.emergencyFundScore)).toBe(false);
  });

  it("budgetAdherenceScore is reduced proportionally when categories exceed budget", async () => {
    mockGetBudgetStatuses.mockResolvedValue([
      { categoryId: "c1", status: "over", categoryName: "Food", percentage: 110, budgeted: 5000, spent: 5500, remaining: -500, categoryIcon: null, categoryColor: null },
      { categoryId: "c2", status: "under", categoryName: "Transport", percentage: 50, budgeted: 3000, spent: 1500, remaining: 1500, categoryIcon: null, categoryColor: null },
    ]);

    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);

    // 1 of 2 categories over budget → adherenceRatio = 1/2 → score = 10
    expect(report.breakdown.budgetAdherenceScore).toBe(10);
  });

  it("budgetAdherenceScore is 20 when no budget is configured", async () => {
    mockGetBudgetStatuses.mockResolvedValue([]);

    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);

    expect(report.breakdown.budgetAdherenceScore).toBe(20);
  });

  it("paycheckAllocationScore is reduced for unallocated paycheck balances", async () => {
    mockGetPaychecks.mockResolvedValue([
      { id: "p1", amount: 30000, name: "Salary", allocations: [{ amount: 15000 }] }, // 50% allocated
    ]);

    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);

    // 15000 allocated out of 30000 → allocationRate = 0.5 → score = 10
    expect(report.breakdown.paycheckAllocationScore).toBe(10);
  });

  it("score is clamped to 0 minimum (no negative scores)", async () => {
    // Setup worst case: no income, over budget everywhere, no emergency fund, no paychecks
    mockGetMonthlySummary.mockResolvedValue({
      totalIncome: 0, totalExpenses: 100000, savingsRate: 0,
      totalBudget: 0, remainingBudget: -100000, savingsAmount: -100000,
      categorySpending: {}, incomeBySource: {}, budgetUtilization: 0,
    });
    mockCalculateEmergencyFundStatus.mockResolvedValue({
      hasFund: false, currentBalance: 0, targetAmount: 0,
      averageExpenses: 0, monthsCovered: 0, status: "not_configured",
    });
    mockGetBudgetStatuses.mockResolvedValue([
      { categoryId: "c1", status: "over", categoryName: "Food", percentage: 200, budgeted: 1000, spent: 2000, remaining: -1000, categoryIcon: null, categoryColor: null },
    ]);
    mockGetPaychecks.mockResolvedValue([]);

    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);

    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(report.score)).toBe(true);
  });

  it("score is clamped to 100 maximum", async () => {
    // Already tested via ideal user, but double-check no over-100 case
    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("grade is 'Excellent' for score >= 85", async () => {
    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);
    // Ideal user gets 100
    expect(report.grade).toBe("Excellent");
  });

  it("returns at least one recommendation", async () => {
    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);
    expect(report.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it("recommendations include income prompt when totalIncome is zero", async () => {
    mockGetMonthlySummary.mockResolvedValue({
      totalIncome: 0, totalExpenses: 0, savingsRate: 0,
      totalBudget: 0, remainingBudget: 0, savingsAmount: 0,
      categorySpending: {}, incomeBySource: {}, budgetUtilization: 0,
    });

    const report = await calculateFinancialHealthReport(MOCK_SUPABASE, USER_ID);

    const hasIncomeRec = report.recommendations.some((r) =>
      r.toLowerCase().includes("income")
    );
    expect(hasIncomeRec).toBe(true);
  });
});
