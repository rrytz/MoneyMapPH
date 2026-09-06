"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  addGoalContribution,
} from "@/lib/services/goal.service";
import { savingsGoalSchema, contributionSchema } from "@/lib/utils/validators";

export async function addGoal(formData: {
  name: string;
  target_amount: number;
  target_date?: string;
  notes?: string;
  is_emergency_fund?: boolean;
}) {
  const parsed = savingsGoalSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createSavingsGoal(supabase, user.id, parsed.data);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to create savings goal:", err);
    return { success: false, error: "Unable to create savings goal. Please verify your inputs." };
  }
}

export async function editGoal(
  goalId: string,
  formData: {
    name: string;
    target_amount: number;
    target_date?: string;
    notes?: string;
    is_emergency_fund?: boolean;
  }
) {
  const parsed = savingsGoalSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateSavingsGoal(supabase, user.id, goalId, parsed.data);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to update savings goal:", err);
    return { success: false, error: "Unable to update savings goal. Please try again." };
  }
}

export async function removeGoal(goalId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deleteSavingsGoal(supabase, user.id, goalId);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete savings goal:", err);
    return { success: false, error: "Unable to delete savings goal. Please try again." };
  }
}

export async function recordContribution(
  goalId: string,
  formData: {
    amount: number;
    date: string;
    notes?: string;
    category_id: string;
  },
  goalName: string
) {
  const parsed = contributionSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await addGoalContribution(supabase, user.id, goalId, {
      amount: parsed.data.amount,
      date: parsed.data.date,
      notes: parsed.data.notes,
      categoryId: parsed.data.category_id,
      title: `Contribution to ${goalName}`,
    });
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/expenses");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to record contribution:", err);
    return { success: false, error: "Unable to record contribution. Please verify the target goal and category." };
  }
}
