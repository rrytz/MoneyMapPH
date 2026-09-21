import { describe, it, expect } from "vitest";
import { computeDashboardStats } from "@/lib/services/dashboard-stats";
import type { MonthlySummary, MonthlySnapshot, SavingsGoal, Debt, DebtPayment } from "@/lib/types";

const summary: MonthlySummary = {
  totalIncome: 25000,
  totalExpenses: 16000,
  totalBudget: 20000,
  remainingBudget: 4000,
  savingsAmount: 9000,
  savingsRate: 36,
  categorySpending: {},
  incomeBySource: {},
  budgetUtilization: 80,
};

const snapshot = (partial: Partial<MonthlySnapshot> & { month: number; year: number; total_expenses: number }): MonthlySnapshot => ({
  id: "s",
  user_id: "u",
  total_income: 0,
  total_budget: 0,
  savings_amount: 0,
  savings_rate: 0,
  category_breakdown: {},
  income_breakdown: {},
  snapshot_date: "",
  created_at: "",
  updated_at: "",
  ...partial,
});

const goal = (id: string, current: number): SavingsGoal => ({
  id,
  user_id: "u",
  name: "g",
  current_amount: current,
  target_amount: 0,
  target_date: null,
  notes: null,
  is_emergency_fund: false,
  created_at: "",
  updated_at: "",
});

const debt = (id: string, total: string, due: string): Debt => ({
  id,
  user_id: "u",
  name: "debt",
  total_amount: String(total),
  due_date: due,
  category_id: null,
  notes: null,
  created_at: "",
  updated_at: "",
});

const payment = (debtId: string, amount: number, paidAt: string): DebtPayment => ({
  id: `${debtId}-p`,
  debt_id: debtId,
  amount: String(amount),
  paid_at: paidAt,
  expense_id: null,
  created_at: "",
  updated_at: "",
});

describe("computeDashboardStats", () => {
  const now = new Date("2026-09-21T00:00:00Z");

  it("reports accounts balance without a delta (history unavailable)", () => {
    const res = computeDashboardStats({ summary, snapshots: [], totalLiquidity: 3300, goals: [], debts: [], payments: [], now });
    expect(res.accountsBalance).toBe(3300);
    expect(res.accountsBalanceDelta).toBeNull();
  });

  it("sums savings goal balances and omits a delta", () => {
    const res = computeDashboardStats({ summary, snapshots: [], totalLiquidity: 0, goals: [goal("g1", 5000), goal("g2", 3000)], debts: [], payments: [], now });
    expect(res.savingsBalance).toBe(8000);
    expect(res.savingsBalanceDelta).toBeNull();
  });

  it("reports zero savings balance when there are no goals", () => {
    const res = computeDashboardStats({ summary, snapshots: [], totalLiquidity: 0, goals: [], debts: [], payments: [], now });
    expect(res.savingsBalance).toBe(0);
  });

  it("computes total remaining debt after recorded payments", () => {
    const debts = [debt("d1", "10000", "2026-10-06"), debt("d2", "1500", "2026-12-01")];
    const payments = [payment("d1", 4000, "2026-09-10T00:00:00Z")];
    const res = computeDashboardStats({ summary, snapshots: [], totalLiquidity: 0, goals: [], debts, payments, now });
    expect(res.debtRemaining).toBe(7500);
  });

  it("estimates debt delta from payments in the trailing 30-day window only", () => {
    const debts = [debt("d1", "10000", "2026-10-06"), debt("d2", "1500", "2026-12-01")];
    const payments = [
      payment("d1", 4000, "2026-09-10T00:00:00Z"),
      payment("d1", 1000, "2026-06-01T00:00:00Z"),
    ];
    const res = computeDashboardStats({ summary, snapshots: [], totalLiquidity: 0, goals: [], debts, payments, now });
    // remaining: d1 10000 - (4000+1000) = 5000, d2 1500 -> 6500; prior = 6500 + 4000 (window) = 10500 -> -38.0952%
    expect(res.debtDeltaPercent).toBeCloseTo(-38.0952, 2);
    expect(res.debtPaidInWindow).toBe(4000);
  });

  it("returns null debt delta when no payments fall in the window", () => {
    const debts = [debt("d1", "10000", "2026-10-06")];
    const payments = [payment("d1", 1000, "2026-06-01T00:00:00Z")];
    const res = computeDashboardStats({ summary, snapshots: [], totalLiquidity: 0, goals: [], debts, payments, now });
    expect(res.debtDeltaPercent).toBeNull();
  });

  it("returns null debt delta when prior remaining is zero", () => {
    const debts = [debt("d1", "1000", "2026-10-06")];
    const payments = [payment("d1", 1000, "2026-06-01T00:00:00Z")];
    const res = computeDashboardStats({ summary, snapshots: [], totalLiquidity: 0, goals: [], debts, payments, now });
    expect(res.debtRemaining).toBe(0);
    expect(res.debtDeltaPercent).toBeNull();
  });

  it("reports -100% debt delta when fully paid within the window", () => {
    const debts = [debt("d1", "1000", "2026-10-06")];
    const payments = [payment("d1", 1000, "2026-09-01T00:00:00Z")];
    const res = computeDashboardStats({ summary, snapshots: [], totalLiquidity: 0, goals: [], debts, payments, now });
    expect(res.debtRemaining).toBe(0);
    expect(res.debtDeltaPercent).toBe(-100);
  });

  it("computes monthly spending delta against the previous snapshot", () => {
    const snapshots = [
      snapshot({ month: 8, year: 2026, total_expenses: 20000 }),
      snapshot({ month: 9, year: 2026, total_expenses: 16000 }),
    ];
    const res = computeDashboardStats({ summary, snapshots, totalLiquidity: 0, goals: [], debts: [], payments: [], now });
    expect(res.monthlySpending).toBe(16000);
    expect(res.spendingDeltaPercent).toBeCloseTo(-20, 2);
  });

  it("returns null spending delta with fewer than two snapshots or zero prior spending", () => {
    const one = computeDashboardStats({ summary, snapshots: [snapshot({ month: 9, year: 2026, total_expenses: 16000 })], totalLiquidity: 0, goals: [], debts: [], payments: [], now });
    expect(one.spendingDeltaPercent).toBeNull();
    const zeroPrior = computeDashboardStats({
      summary,
      snapshots: [snapshot({ month: 8, year: 2026, total_expenses: 0 }), snapshot({ month: 9, year: 2026, total_expenses: 16000 })],
      totalLiquidity: 0,
      goals: [],
      debts: [],
      payments: [],
      now,
    });
    expect(zeroPrior.spendingDeltaPercent).toBeNull();
  });
});