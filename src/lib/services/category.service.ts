import { SupabaseClient } from "@supabase/supabase-js";
import type { ExpenseCategory, IncomeSource, IncomeSourceType } from "@/lib/types";

export async function getExpenseCategories(
  supabase: SupabaseClient,
  userId: string
): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data || []) as ExpenseCategory[];
}

export async function getIncomeSources(
  supabase: SupabaseClient,
  userId: string
): Promise<IncomeSource[]> {
  const { data, error } = await supabase
    .from("income_sources")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data || []) as IncomeSource[];
}

export async function createExpenseCategory(
  supabase: SupabaseClient,
  userId: string,
  data: { name: string; icon?: string; color?: string }
): Promise<ExpenseCategory> {
  const { data: maxOrder } = await supabase
    .from("expense_categories")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: category, error } = await supabase
    .from("expense_categories")
    .insert({
      user_id: userId,
      name: data.name,
      icon: data.icon || null,
      color: data.color || null,
      sort_order: (maxOrder?.sort_order || 0) + 1,
    })
    .select()
    .single();

  if (error) throw error;
  return category as ExpenseCategory;
}

export async function updateExpenseCategory(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string,
  data: { name?: string; icon?: string; color?: string }
): Promise<ExpenseCategory> {
  const { data: category, error } = await supabase
    .from("expense_categories")
    .update(data)
    .eq("id", categoryId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return category as ExpenseCategory;
}

export async function deleteExpenseCategory(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string
): Promise<void> {
  const { error } = await supabase
    .from("expense_categories")
    .delete()
    .eq("id", categoryId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function createIncomeSource(
  supabase: SupabaseClient,
  userId: string,
  data: { name: string; type?: IncomeSourceType }
): Promise<IncomeSource> {
  const { data: maxOrder } = await supabase
    .from("income_sources")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: source, error } = await supabase
    .from("income_sources")
    .insert({
      user_id: userId,
      name: data.name,
      type: data.type ?? "core",
      sort_order: (maxOrder?.sort_order || 0) + 1,
    })
    .select()
    .single();

  if (error) throw error;
  return source as IncomeSource;
}

export async function updateIncomeSource(
  supabase: SupabaseClient,
  userId: string,
  sourceId: string,
  data: { name: string; type?: IncomeSourceType }
): Promise<IncomeSource> {
  const { data: source, error } = await supabase
    .from("income_sources")
    .update(data)
    .eq("id", sourceId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return source as IncomeSource;
}

export async function deleteIncomeSource(
  supabase: SupabaseClient,
  userId: string,
  sourceId: string
): Promise<void> {
  const { error } = await supabase
    .from("income_sources")
    .delete()
    .eq("id", sourceId)
    .eq("user_id", userId);

  if (error) throw error;
}

