import { SupabaseClient } from "@supabase/supabase-js";
import type { MonthlySummary, BudgetStatus } from "@/lib/types";
import { BUDGET_THRESHOLDS } from "@/lib/constants";
import { getMonthDateRange } from "@/lib/utils/date";

export async function getMonthlySummary(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<MonthlySummary> {
  const { start, end } = getMonthDateRange(month, year);

  const { data: incomeData } = await supabase
    .from("income_entries")
    .select("amount, source_id")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end);

  const { data: expenseData } = await supabase
    .from("expenses")
    .select("amount, category_id")
    .eq("user_id", userId)
    .is("goal_id", null)
    .gte("date", start)
    .lte("date", end);

  const { data: budget } = await supabase
    .from("budgets")
    .select("id, budget_categories(amount)")
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  const totalIncome = (incomeData || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalExpenses = (expenseData || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const totalBudget = budget?.budget_categories
    ? (budget.budget_categories as Array<{ amount: number }>).reduce((sum, bc) => sum + (Number(bc.amount) || 0), 0)
    : 0;

  const remainingBudget = totalBudget - totalExpenses;
  const savingsAmount = totalIncome - totalExpenses;
  const rawSavingsRate = totalIncome > 0 ? (savingsAmount / totalIncome) * 100 : 0;
  const savingsRate = Number.isFinite(rawSavingsRate) ? rawSavingsRate : 0;
  const rawUtilization = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;
  const budgetUtilization = Number.isFinite(rawUtilization) ? rawUtilization : 0;

  const categorySpending: Record<string, number> = {};
  (expenseData || []).forEach((e) => {
    categorySpending[e.category_id] = (categorySpending[e.category_id] || 0) + (Number(e.amount) || 0);
  });

  const incomeBySource: Record<string, number> = {};
  (incomeData || []).forEach((e) => {
    incomeBySource[e.source_id] = (incomeBySource[e.source_id] || 0) + (Number(e.amount) || 0);
  });

  return {
    totalIncome,
    totalExpenses,
    totalBudget,
    remainingBudget,
    savingsAmount,
    savingsRate: Math.round(savingsRate * 100) / 100,
    categorySpending,
    incomeBySource,
    budgetUtilization: Math.round(budgetUtilization * 100) / 100,
  };
}

export async function getBudgetStatuses(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<BudgetStatus[]> {
  const { start, end } = getMonthDateRange(month, year);

  const { data: budget } = await supabase
    .from("budgets")
    .select(`
      id,
      budget_categories (
        category_id,
        amount,
        category:expense_categories (id, name, icon, color)
      )
    `)
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  if (!budget?.budget_categories) return [];

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount, category_id")
    .eq("user_id", userId)
    .is("goal_id", null)
    .gte("date", start)
    .lte("date", end);

  const spendingByCategory: Record<string, number> = {};
  (expenses || []).forEach((e) => {
    spendingByCategory[e.category_id] = (spendingByCategory[e.category_id] || 0) + Number(e.amount);
  });

  return (budget.budget_categories as unknown as Array<{
    category_id: string;
    amount: number;
    category: { id: string; name: string; icon: string | null; color: string | null } | null;
  }>).map((bc) => {
    const spent = spendingByCategory[bc.category_id] || 0;
    const budgeted = Number(bc.amount);
    const remaining = budgeted - spent;
    const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;

    let status: "under" | "near" | "over";
    if (percentage > BUDGET_THRESHOLDS.NEAR) {
      status = "over";
    } else if (percentage >= BUDGET_THRESHOLDS.UNDER) {
      status = "near";
    } else {
      status = "under";
    }

    return {
      categoryId: bc.category_id,
      categoryName: bc.category?.name || "Unknown",
      categoryIcon: bc.category?.icon || null,
      categoryColor: bc.category?.color || null,
      budgeted,
      spent,
      remaining,
      percentage: Math.round(percentage * 100) / 100,
      status,
    };
  });
}
