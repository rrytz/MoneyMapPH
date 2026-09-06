import { SupabaseClient } from "@supabase/supabase-js";
import type { IncomeEntry } from "@/lib/types";
import { getMonthDateRange } from "@/lib/utils/date";

export async function getIncomeEntries(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    month?: number;
    year?: number;
    sourceId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: IncomeEntry[]; count: number }> {
  let query = supabase
    .from("income_entries")
    .select("*, source:income_sources(*)", { count: "exact" })
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (options?.month && options?.year) {
    const { start, end } = getMonthDateRange(options.month, options.year);
    query = query.gte("date", start).lte("date", end);
  }

  if (options?.sourceId) {
    query = query.eq("source_id", options.sourceId);
  }

  if (options?.limit) {
    const offset = options.offset || 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data || []) as IncomeEntry[], count: count || 0 };
}

export async function createIncomeEntry(
  supabase: SupabaseClient,
  userId: string,
  entry: {
    amount: number;
    source_id: string;
    date: string;
    notes?: string;
    paycheck_id?: string;
  }
): Promise<IncomeEntry> {
  const { data, error } = await supabase
    .from("income_entries")
    .insert({
      user_id: userId,
      amount: entry.amount,
      source_id: entry.source_id,
      date: entry.date,
      notes: entry.notes || null,
      paycheck_id: entry.paycheck_id || null,
    })
    .select("*, source:income_sources(*)")
    .single();

  if (error) throw error;
  return data as IncomeEntry;
}

export async function updateIncomeEntry(
  supabase: SupabaseClient,
  userId: string,
  entryId: string,
  entry: {
    amount?: number;
    source_id?: string;
    date?: string;
    notes?: string;
    paycheck_id?: string;
  }
): Promise<IncomeEntry> {
  const { data, error } = await supabase
    .from("income_entries")
    .update(entry)
    .eq("id", entryId)
    .eq("user_id", userId)
    .select("*, source:income_sources(*)")
    .single();

  if (error) throw error;
  return data as IncomeEntry;
}

export async function deleteIncomeEntry(
  supabase: SupabaseClient,
  userId: string,
  entryId: string
): Promise<void> {
  const { error } = await supabase
    .from("income_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId);

  if (error) throw error;
}
