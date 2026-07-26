import { SupabaseClient } from "@supabase/supabase-js";
import type { Budget } from "@/lib/types";

export async function getBudget(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<Budget | null> {
  const { data, error } = await supabase
    .from("budgets")
    .select(`
      *,
      budget_categories (
        *,
        category:expense_categories (*)
      )
    `)
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  if (error) throw error;
  return data as Budget | null;
}

export async function createBudget(
  supabase: SupabaseClient,
  userId: string,
  data: {
    month: number;
    year: number;
    categories: Array<{ category_id: string; amount: number }>;
  }
): Promise<Budget> {
  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .insert({ user_id: userId, month: data.month, year: data.year })
    .select()
    .single();

  if (budgetError) throw budgetError;

  if (data.categories.length > 0) {
    const { error: catError } = await supabase
      .from("budget_categories")
      .insert(
        data.categories.map((c) => ({
          budget_id: budget.id,
          category_id: c.category_id,
          amount: c.amount,
        }))
      );

    if (catError) throw catError;
  }

  return budget as Budget;
}

export async function updateBudgetCategory(
  supabase: SupabaseClient,
  budgetCategoryId: string,
  amount: number
): Promise<void> {
  const { error } = await supabase
    .from("budget_categories")
    .update({ amount })
    .eq("id", budgetCategoryId);

  if (error) throw error;
}

export async function copyBudgetFromPreviousMonth(
  supabase: SupabaseClient,
  userId: string,
  targetMonth: number,
  targetYear: number
): Promise<Budget | null> {
  let prevMonth = targetMonth - 1;
  let prevYear = targetYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const prev = await getBudget(supabase, userId, prevMonth, prevYear);
  if (!prev || !prev.budget_categories) return null;

  return createBudget(supabase, userId, {
    month: targetMonth,
    year: targetYear,
    categories: prev.budget_categories.map((bc) => ({
      category_id: bc.category_id,
      amount: Number(bc.amount),
    })),
  });
}
