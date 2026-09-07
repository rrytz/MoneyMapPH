import { BUDGET_THRESHOLDS } from "@/lib/constants";

export type BudgetStatusLevel = "under" | "near" | "over";

export interface BudgetStatusComputed {
  percentage: number;
  status: BudgetStatusLevel;
}

export function computeBudgetStatus(budgeted: number, spent: number): BudgetStatusComputed {
  const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;

  let status: BudgetStatusLevel;
  if (percentage > BUDGET_THRESHOLDS.NEAR) {
    status = "over";
  } else if (percentage >= BUDGET_THRESHOLDS.UNDER) {
    status = "near";
  } else {
    status = "under";
  }

  return {
    percentage: Math.round(percentage * 100) / 100,
    status,
  };
}