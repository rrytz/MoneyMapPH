import { SupabaseClient } from "@supabase/supabase-js";
import type { Expense } from "@/lib/types";
import { getMonthDateRange } from "@/lib/utils/date";

export async function getExpenses(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    month?: number;
    year?: number;
    categoryId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: Expense[]; count: number }> {
  let query = supabase
    .from("expenses")
    .select("*, category:expense_categories(*)", { count: "exact" })
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (options?.month && options?.year) {
    const { start, end } = getMonthDateRange(options.month, options.year);
    query = query.gte("date", start).lte("date", end);
  }

  if (options?.categoryId) {
    query = query.eq("category_id", options.categoryId);
  }

  if (options?.search) {
    query = query.ilike("title", `%${options.search}%`);
  }

  if (options?.limit) {
    const offset = options.offset || 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data || []) as Expense[], count: count || 0 };
}

export async function createExpense(
  supabase: SupabaseClient,
  userId: string,
  entry: {
    title: string;
    amount: number;
    category_id: string;
    date: string;
    notes?: string;
    paycheck_id?: string;
  }
): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      title: entry.title,
      amount: entry.amount,
      category_id: entry.category_id,
      date: entry.date,
      notes: entry.notes || null,
      paycheck_id: entry.paycheck_id || null,
    })
    .select("*, category:expense_categories(*)")
    .single();

  if (error) throw error;
  return data as Expense;
}

export async function updateExpense(
  supabase: SupabaseClient,
  expenseId: string,
  entry: {
    title?: string;
    amount?: number;
    category_id?: string;
    date?: string;
    notes?: string;
    paycheck_id?: string;
  }
): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .update(entry)
    .eq("id", expenseId)
    .select("*, category:expense_categories(*)")
    .single();

  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(
  supabase: SupabaseClient,
  expenseId: string
): Promise<void> {
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId);

  if (error) throw error;
}
