import { SupabaseClient } from "@supabase/supabase-js";
import { getMonthlySummary, getBudgetStatuses } from "./financial.service";
import { calculateEmergencyFundStatus } from "./forecast.service";
import { getPaychecks } from "./paycheck.service";
import { getCurrentMonthYear } from "@/lib/utils/date";
import type { FinancialHealthReport, MonthlySummary, SavingsGoal, MonthlySnapshot, Paycheck, BudgetStatus } from "@/lib/types";

interface HealthPreload {
  summary?: MonthlySummary;
  goals?: SavingsGoal[];
  snapshots?: MonthlySnapshot[];
  budgetStatuses?: BudgetStatus[];
  paychecks?: Paycheck[];
}

export async function calculateFinancialHealthReport(
  supabase: SupabaseClient,
  userId: string,
  preloaded?: HealthPreload
): Promise<FinancialHealthReport> {
  const { month, year } = getCurrentMonthYear();

  // Fetch metrics concurrently; pages that already have this data pass it along
  // to skip redundant Supabase round trips.
  const [summary, emergencyStatus, budgetStatuses, paychecks] = await Promise.all([
    preloaded?.summary ?? getMonthlySummary(supabase, userId, month, year),
    calculateEmergencyFundStatus(supabase, userId, {
      goals: preloaded?.goals,
      snapshots: preloaded?.snapshots,
    }),
    preloaded?.budgetStatuses ?? getBudgetStatuses(supabase, userId, month, year),
    preloaded?.paychecks ?? getPaychecks(supabase, userId, month, year),
  ]);

  // 1. Savings Rate Score (Max 30 pts)
  // Linear scale up to 30% savings rate; 0 if no income recorded
  const rawSavingsRate = Number.isFinite(summary.savingsRate) ? summary.savingsRate : 0;
  const savingsRate = Math.max(0, rawSavingsRate);
  const savingsRateScore = summary.totalIncome > 0
    ? Math.round(Math.min(30, Math.max(0, (savingsRate / 30) * 30)))
    : 0;

  // 2. Emergency Fund Score (Max 30 pts)
  // Covers 6 months = 30 pts; 3 months = 15 pts; 0 months = 0 pts
  const monthsCovered = Number.isFinite(emergencyStatus.monthsCovered) ? Math.max(0, emergencyStatus.monthsCovered) : 0;
  const emergencyFundScore = !emergencyStatus.hasFund
    ? 0
    : Math.round(Math.min(30, Math.max(0, (monthsCovered / 6) * 30)));

  // 3. Budget Adherence Score (Max 20 pts)
  // Deduct points proportionally for categories that go over budget
  let budgetAdherenceScore = 20;
  if (budgetStatuses.length > 0) {
    const overBudgetCategories = budgetStatuses.filter((s) => s.status === "over").length;
    const totalCategories = budgetStatuses.length;
    const adherenceRatio = totalCategories > 0 ? (totalCategories - overBudgetCategories) / totalCategories : 1;
    budgetAdherenceScore = Math.round(20 * Math.max(0, adherenceRatio));
  }

  // 4. Paycheck Allocation Score (Max 20 pts)
  // Deduct points for unallocated paycheck balances
  let paycheckAllocationScore = 20;
  if (paychecks.length > 0) {
    const totalPaycheckAmount = paychecks.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalUnallocated = paychecks.reduce((sum, p) => {
      const allocations = p.allocations || [];
      const allocated = allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0);
      return sum + Math.max(0, (Number(p.amount) || 0) - allocated);
    }, 0);

    if (totalPaycheckAmount > 0) {
      const allocationRate = Math.max(0, (totalPaycheckAmount - totalUnallocated) / totalPaycheckAmount);
      paycheckAllocationScore = Math.round(allocationRate * 20);
    }
  }

  // Sum up Total Score strictly between 0 and 100
  const rawTotal = savingsRateScore + emergencyFundScore + budgetAdherenceScore + paycheckAllocationScore;
  const score = Number.isFinite(rawTotal) ? Math.min(100, Math.max(0, Math.round(rawTotal))) : 0;

  // Map Score to Grade
  let grade: FinancialHealthReport["grade"] = "Critical";
  if (score >= 85) {
    grade = "Excellent";
  } else if (score >= 70) {
    grade = "Good";
  } else if (score >= 50) {
    grade = "Fair";
  }

  // Generate Recommendations
  const recommendations: string[] = [];
  if (summary.totalIncome <= 0) {
    recommendations.push(
      "Log your monthly income to activate savings rate metrics and personalized financial health scoring."
    );
  } else if (savingsRate < 20) {
    recommendations.push(
      `Increase your savings rate (currently ${savingsRate}%). Aim for at least 20% by cutting discretionary spending.`
    );
  }
  if (!emergencyStatus.hasFund) {
    recommendations.push(
      "Create an emergency fund target on the Savings tab to set aside 3 to 6 months of expenses."
    );
  } else if (monthsCovered < 3) {
    recommendations.push(
      `Your emergency fund covers only ${monthsCovered} months of expenses. Focus on building it up to cover at least 3 months.`
    );
  }
  if (budgetStatuses.some((s) => s.status === "over")) {
    const overCategories = budgetStatuses
      .filter((s) => s.status === "over")
      .map((s) => s.categoryName)
      .join(", ");
    recommendations.push(
      `Reduce spending in categories exceeding budget allocations: ${overCategories}.`
    );
  }
  
  // Find paychecks with unallocated funds
  const unallocatedPaychecks = paychecks.filter((p) => {
    const allocated = (p.allocations || []).reduce((s, a) => s + Number(a.amount), 0);
    return Number(p.amount) - allocated > 0;
  });

  if (unallocatedPaychecks.length > 0) {
    const names = unallocatedPaychecks.map((p) => p.name).join(", ");
    recommendations.push(
      `Fully allocate your paycheck earnings in the paycheck planner (unallocated balances found in: ${names}).`
    );
  }

  // Fallback default recommendation
  if (recommendations.length === 0) {
    recommendations.push(
      "Great work! Your financial habits are healthy. Keep tracking your transactions and goals."
    );
  }

  return {
    score,
    grade,
    breakdown: {
      savingsRateScore,
      emergencyFundScore,
      budgetAdherenceScore,
      paycheckAllocationScore,
    },
    recommendations,
  };
}
