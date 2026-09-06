import { SupabaseClient } from "@supabase/supabase-js";
import type { SavingsGoal, SavingsGoalFormData } from "@/lib/types";

export async function getSavingsGoals(
  supabase: SupabaseClient,
  userId: string
): Promise<SavingsGoal[]> {
  const { data, error } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("user_id", userId)
    .order("is_emergency_fund", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as SavingsGoal[];
}

export async function createSavingsGoal(
  supabase: SupabaseClient,
  userId: string,
  goal: SavingsGoalFormData
): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from("savings_goals")
    .insert({
      user_id: userId,
      name: goal.name,
      target_amount: goal.target_amount,
      target_date: goal.target_date || null,
      notes: goal.notes || null,
      is_emergency_fund: goal.is_emergency_fund || false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SavingsGoal;
}

export async function updateSavingsGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  goal: Partial<SavingsGoalFormData>
): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from("savings_goals")
    .update({
      name: goal.name,
      target_amount: goal.target_amount,
      target_date: goal.target_date || null,
      notes: goal.notes || null,
      is_emergency_fund: goal.is_emergency_fund,
    })
    .eq("id", goalId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as SavingsGoal;
}

export async function deleteSavingsGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string
): Promise<void> {
  const { error } = await supabase
    .from("savings_goals")
    .delete()
    .eq("id", goalId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function addGoalContribution(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  entry: {
    amount: number;
    date: string;
    notes?: string;
    categoryId: string;
    title?: string;
  }
): Promise<unknown> {
  // Verify that the goal belongs to this user
  const { data: goal, error: goalError } = await supabase
    .from("savings_goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (goalError || !goal) {
    throw new Error("Unauthorized: Target savings goal does not exist or access denied.");
  }

  // A goal contribution is recorded as a standard expense linked to the goal
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      title: entry.title || "Goal Contribution",
      amount: entry.amount,
      category_id: entry.categoryId,
      date: entry.date,
      notes: entry.notes || null,
      goal_id: goalId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
