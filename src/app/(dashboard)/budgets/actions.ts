"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createBudget, updateBudgetCategory, copyBudgetFromPreviousMonth } from "@/lib/services/budget.service";
import { generateSnapshot } from "@/lib/services/snapshot.service";
import { budgetSchema } from "@/lib/utils/validators";

export async function addBudget(formData: {
  month: number;
  year: number;
  categories: Array<{ category_id: string; amount: number }>;
}) {
  const parsed = budgetSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createBudget(supabase, user.id, parsed.data);
    await generateSnapshot(supabase, user.id, parsed.data.month, parsed.data.year);
    revalidatePath("/budgets");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: "Failed to create budget" };
  }
}

export async function updateBudgetCategoryLimit(budgetCategoryId: string, amount: number, month: number, year: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateBudgetCategory(supabase, budgetCategoryId, amount);
    await generateSnapshot(supabase, user.id, month, year);
    revalidatePath("/budgets");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: "Failed to update category budget" };
  }
}

export async function copyPreviousMonthBudget(targetMonth: number, targetYear: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const result = await copyBudgetFromPreviousMonth(supabase, user.id, targetMonth, targetYear);
    if (!result) return { error: "No budget found for previous month" };
    await generateSnapshot(supabase, user.id, targetMonth, targetYear);
    revalidatePath("/budgets");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: "Failed to copy previous budget" };
  }
}
