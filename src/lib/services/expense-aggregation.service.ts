import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpenseCategory, MonthlyExpenseAggregation, UnbudgetedCategorySpend } from "@/lib/types";
import { getMonthDateRange } from "@/lib/utils/date";

// goal-linked rows are intentionally INCLUDED: the ledger and the planner's
// "Total Actual Spending" must match the Expenses page exactly. This is the
// "all transactions" view, distinct from getMonthlySummary's net-flow view.

export function sumExpenses(rows: Array<{ amount: number | string }>): number {
  return rows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

export function groupExpensesByCategory(
  rows: Array<{ amount: number | string; category_id: string }>
): Record<string, number> {
  const byCategory: Record<string, number> = {};
  (rows || []).forEach((e) => {
    byCategory[e.category_id] = (byCategory[e.category_id] || 0) + (Number(e.amount) || 0);
  });
  return byCategory;
}

export function computeBudgetedSpent(
  byCategory: Record<string, number>,
  budgetedCategoryIds: string[]
): number {
  return budgetedCategoryIds.reduce((sum, cid) => sum + (byCategory[cid] || 0), 0);
}

export function computeUnbudgetedSpent(totalExpenses: number, budgetedSpent: number): number {
  return totalExpenses - budgetedSpent;
}

export function computeRemainingBudget(totalBudget: number, spent: number): number {
  return totalBudget - spent;
}

export function buildUnbudgetedCategoryViews(
  byCategory: Record<string, number>,
  budgetedCategoryIds: string[],
  categories: ExpenseCategory[]
): UnbudgetedCategorySpend[] {
  const budgeted = new Set(budgetedCategoryIds);
  return Object.entries(byCategory)
    .filter(([categoryId]) => !budgeted.has(categoryId))
    .map(([categoryId, spent]) => {
      const cat = categories.find((c) => c.id === categoryId);
      return {
        categoryId,
        name: cat?.name || "Uncategorized",
        icon: cat?.icon || null,
        color: cat?.color || null,
        spent,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

export async function getMonthlyExpenseAggregation(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<MonthlyExpenseAggregation> {
  const { start, end } = getMonthDateRange(month, year);

  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("amount, category_id")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end);

  if (error) throw error;

  const rows = (expenses || []) as Array<{ amount: number; category_id: string }>;

  return {
    month,
    year,
    totalExpenses: sumExpenses(rows),
    expenseCount: rows.length,
    byCategory: groupExpensesByCategory(rows),
  };
}