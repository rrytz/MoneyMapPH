import { SupabaseClient } from "@supabase/supabase-js";
import type { MonthlySnapshot } from "@/lib/types";
import { getMonthlySummary } from "./financial.service";

export async function generateSnapshot(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<void> {
  const summary = await getMonthlySummary(supabase, userId, month, year);

  const snapshotData = {
    user_id: userId,
    month,
    year,
    total_income: summary.totalIncome,
    total_expenses: summary.totalExpenses,
    total_budget: summary.totalBudget,
    savings_amount: summary.savingsAmount,
    savings_rate: summary.savingsRate,
    category_breakdown: summary.categorySpending,
    income_breakdown: summary.incomeBySource,
    snapshot_date: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("monthly_snapshots")
    .upsert(snapshotData, { onConflict: "user_id,month,year" });

  if (error) throw error;
}

export async function getSnapshots(
  supabase: SupabaseClient,
  userId: string,
  months: number
): Promise<MonthlySnapshot[]> {
  const now = new Date();
  const startMonth = now.getMonth() + 1 - months + 1;
  const startYear = now.getFullYear();

  let sMonth = startMonth;
  let sYear = startYear;
  while (sMonth <= 0) {
    sMonth += 12;
    sYear -= 1;
  }

  const { data, error } = await supabase
    .from("monthly_snapshots")
    .select("*")
    .eq("user_id", userId)
    .or(
      `and(year.gt.${sYear},year.lte.${now.getFullYear()}),and(year.eq.${sYear},month.gte.${sMonth})`
    )
    .order("year", { ascending: true })
    .order("month", { ascending: true });

  if (error) throw error;
  return (data || []) as MonthlySnapshot[];
}
