import type { MonthlySummary, MonthlySnapshot, SavingsGoal, Debt, DebtPayment } from "@/lib/types";
import { debtPaidOffAmount, debtRemaining } from "@/lib/utils/debt";

const TRAILING_DAYS = 30;

export interface DashboardStatsInput {
  summary: MonthlySummary;
  snapshots: MonthlySnapshot[];
  totalLiquidity: number;
  goals: SavingsGoal[];
  debts: Debt[];
  payments: DebtPayment[];
  now?: Date;
}

export interface DashboardStats {
  accountsBalance: number;
  accountsBalanceDelta: null;
  savingsBalance: number;
  savingsBalanceDelta: null;
  debtRemaining: number;
  debtDeltaPercent: number | null;
  debtPaidInWindow: number;
  monthlySpending: number;
  spendingDeltaPercent: number | null;
}

export function computeDashboardStats(input: DashboardStatsInput): DashboardStats {
  const now = input.now ?? new Date();
  const windowStart = new Date(now.getTime() - TRAILING_DAYS * 24 * 60 * 60 * 1000);

  const debtRemainingTotal = input.debts.reduce(
    (sum, d) => sum + debtRemaining(d, debtPaidOffAmount(input.payments.filter((p) => p.debt_id === d.id))),
    0
  );

  const debtPaidInWindow = input.payments
    .filter((p) => new Date(p.paid_at).getTime() >= windowStart.getTime())
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const priorRemaining = debtRemainingTotal + debtPaidInWindow;
  const debtDeltaPercent =
    debtPaidInWindow > 0 && priorRemaining > 0
      ? ((debtRemainingTotal - priorRemaining) / priorRemaining) * 100
      : null;

  const prev = input.snapshots.length >= 2 ? input.snapshots[input.snapshots.length - 2] : null;
  const prevSpending = prev ? Number(prev.total_expenses) : 0;
  const spendingDeltaPercent =
    prev !== null && prevSpending > 0
      ? ((input.summary.totalExpenses - prevSpending) / prevSpending) * 100
      : null;

  return {
    accountsBalance: input.totalLiquidity,
    accountsBalanceDelta: null,
    savingsBalance: input.goals.reduce((sum, g) => sum + Number(g.current_amount), 0),
    savingsBalanceDelta: null,
    debtRemaining: debtRemainingTotal,
    debtDeltaPercent,
    debtPaidInWindow,
    monthlySpending: input.summary.totalExpenses,
    spendingDeltaPercent,
  };
}