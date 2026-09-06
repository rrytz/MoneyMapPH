import { SupabaseClient } from "@supabase/supabase-js";
import type { IncomeEntry, Expense } from "@/lib/types";

export interface UnifiedTransaction {
  id: string;
  type: "income" | "expense";
  title: string;
  amount: number;
  date: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  notes: string | null;
}

export interface UnifiedTransactionOptions {
  startDate?: string;
  endDate?: string;
  type?: "income" | "expense";
  search?: string;
  /** Server-side page size. Defaults to 100 (all) for backward-compat with print page. */
  limit?: number;
  /** Server-side offset for cursor-based pagination. Defaults to 0. */
  offset?: number;
}

export interface UnifiedTransactionResult {
  data: UnifiedTransaction[];
  /** Total count across both tables (before pagination), useful for showing "X of Y". */
  totalCount: number;
}

export async function getUnifiedTransactions(
  supabase: SupabaseClient,
  userId: string,
  options?: UnifiedTransactionOptions
): Promise<UnifiedTransactionResult> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  // Build income query
  let incomeQuery = supabase
    .from("income_entries")
    .select("*, source:income_sources(*)", { count: "exact" })
    .eq("user_id", userId)
    .order("date", { ascending: false });

  // Build expense query
  let expenseQuery = supabase
    .from("expenses")
    .select("*, category:expense_categories(*)", { count: "exact" })
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (options?.startDate) {
    incomeQuery = incomeQuery.gte("date", options.startDate);
    expenseQuery = expenseQuery.gte("date", options.startDate);
  }
  if (options?.endDate) {
    incomeQuery = incomeQuery.lte("date", options.endDate);
    expenseQuery = expenseQuery.lte("date", options.endDate);
  }

  // Apply server-side search via ilike (title/notes for expenses, source name not directly filterable here)
  if (options?.search) {
    expenseQuery = expenseQuery.or(
      `title.ilike.%${options.search}%,notes.ilike.%${options.search}%`
    );
  }

  const [incomeResult, expenseResult] = await Promise.all([
    options?.type === "expense" ? Promise.resolve({ data: null, error: null, count: 0 }) : incomeQuery,
    options?.type === "income" ? Promise.resolve({ data: null, error: null, count: 0 }) : expenseQuery,
  ]);

  if (incomeResult.error) throw incomeResult.error;
  if (expenseResult.error) throw expenseResult.error;

  const rawIncome = (incomeResult.data || []) as Array<IncomeEntry & { source?: { name: string } }>;
  const rawExpense = (expenseResult.data || []) as Array<Expense & { category?: { name: string; icon: string | null; color: string | null } }>;

  const unified: UnifiedTransaction[] = [];

  rawIncome.forEach((inc) => {
    // Client-side income search fallback (source name, notes)
    if (options?.search) {
      const term = options.search.toLowerCase();
      const matchSource = (inc.source?.name || "").toLowerCase().includes(term);
      const matchNotes = (inc.notes || "").toLowerCase().includes(term);
      if (!matchSource && !matchNotes) return;
    }
    unified.push({
      id: inc.id,
      type: "income",
      title: inc.source?.name || "Income",
      amount: Number(inc.amount),
      date: inc.date,
      categoryName: inc.source?.name || "Income",
      categoryIcon: "💰",
      categoryColor: "#14b8a6",
      notes: inc.notes,
    });
  });

  rawExpense.forEach((exp) => {
    unified.push({
      id: exp.id,
      type: "expense",
      title: exp.title,
      amount: Number(exp.amount),
      date: exp.date,
      categoryName: exp.category?.name || "Expense",
      categoryIcon: exp.category?.icon || null,
      categoryColor: exp.category?.color || null,
      notes: exp.notes,
    });
  });

  // Sort merged list by date descending
  unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalCount = unified.length;
  // Apply pagination after merge-sort
  const paginated = unified.slice(offset, offset + limit);

  return { data: paginated, totalCount };
}
