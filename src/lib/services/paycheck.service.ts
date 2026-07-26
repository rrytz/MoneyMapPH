import { SupabaseClient } from "@supabase/supabase-js";
import type { Paycheck, PaycheckSummary } from "@/lib/types";
import { getMonthDateRange } from "@/lib/utils/date";

export async function getPaychecks(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<Paycheck[]> {
  const { start, end } = getMonthDateRange(month, year);

  const { data, error } = await supabase
    .from("paychecks")
    .select(`
      *,
      allocations:paycheck_allocations (
        *,
        category:expense_categories (id, name, icon, color)
      )
    `)
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data || []) as Paycheck[];
}

export async function createPaycheck(
  supabase: SupabaseClient,
  userId: string,
  data: {
    name: string;
    amount: number;
    date: string;
    notes?: string;
    allocations: Array<{
      category_id?: string;
      label: string;
      amount: number;
    }>;
  }
): Promise<Paycheck> {
  const { data: paycheck, error: pcError } = await supabase
    .from("paychecks")
    .insert({
      user_id: userId,
      name: data.name,
      amount: data.amount,
      date: data.date,
      notes: data.notes || null,
    })
    .select()
    .single();

  if (pcError) throw pcError;

  if (data.allocations.length > 0) {
    const { error: allocError } = await supabase
      .from("paycheck_allocations")
      .insert(
        data.allocations.map((a) => ({
          paycheck_id: paycheck.id,
          category_id: a.category_id || null,
          label: a.label,
          amount: a.amount,
        }))
      );

    if (allocError) throw allocError;
  }

  return paycheck as Paycheck;
}

export async function deletePaycheck(
  supabase: SupabaseClient,
  paycheckId: string
): Promise<void> {
  const { error } = await supabase
    .from("paychecks")
    .delete()
    .eq("id", paycheckId);

  if (error) throw error;
}

export function calculatePaycheckSummary(paycheck: Paycheck): PaycheckSummary {
  const allocations = paycheck.allocations || [];
  const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.amount), 0);

  return {
    paycheck,
    totalAllocated,
    totalUnallocated: Number(paycheck.amount) - totalAllocated,
    allocationBreakdown: allocations.map((a) => ({
      label: a.label,
      amount: Number(a.amount),
      categoryId: a.category_id,
      categoryName: a.category?.name || null,
    })),
  };
}
