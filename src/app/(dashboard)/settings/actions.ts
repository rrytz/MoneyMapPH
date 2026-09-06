"use server";

import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "@/lib/services/profile.service";
import {
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  createIncomeSource,
  updateIncomeSource,
  deleteIncomeSource,
} from "@/lib/services/category.service";
import { revalidatePath } from "next/cache";
import { profileSchema, categorySchema, sourceSchema } from "@/lib/utils/validators";

export async function updateProfileSettings(data: {
  display_name: string;
  currency: string;
  theme: "light" | "dark" | "system";
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const validated = profileSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  try {
    const profile = await updateProfile(supabase, user.id, data);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { data: profile };
  } catch (error) {
    console.error("Failed to update profile settings:", error);
    return { error: "Unable to update profile settings. Please try again." };
  }
}

export async function addExpenseCategorySetting(data: { name: string; icon?: string; color?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const validated = categorySchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  try {
    const category = await createExpenseCategory(supabase, user.id, data);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/expenses");
    revalidatePath("/budgets");
    return { data: category };
  } catch (error) {
    console.error("Failed to add expense category:", error);
    return { error: "Unable to add expense category. Please verify your inputs." };
  }
}

export async function editExpenseCategorySetting(
  categoryId: string,
  data: { name: string; icon?: string; color?: string }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const validated = categorySchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  try {
    const category = await updateExpenseCategory(supabase, user.id, categoryId, data);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/expenses");
    revalidatePath("/budgets");
    return { data: category };
  } catch (error) {
    console.error("Failed to update expense category:", error);
    return { error: "Unable to update expense category. Please try again." };
  }
}

export async function removeExpenseCategorySetting(categoryId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deleteExpenseCategory(supabase, user.id, categoryId);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/expenses");
    revalidatePath("/budgets");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete expense category:", error);
    return { error: "Unable to delete expense category. It may be linked to existing transactions." };
  }
}

export async function addIncomeSourceSetting(data: { name: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const validated = sourceSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  try {
    const source = await createIncomeSource(supabase, user.id, data);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/income");
    return { data: source };
  } catch (error) {
    console.error("Failed to add income source:", error);
    return { error: "Unable to add income source. Please verify your inputs." };
  }
}

export async function editIncomeSourceSetting(sourceId: string, data: { name: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const validated = sourceSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  try {
    const source = await updateIncomeSource(supabase, user.id, sourceId, data);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/income");
    return { data: source };
  } catch (error) {
    console.error("Failed to update income source:", error);
    return { error: "Unable to update income source. Please try again." };
  }
}

export async function removeIncomeSourceSetting(sourceId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deleteIncomeSource(supabase, user.id, sourceId);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/income");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete income source:", error);
    return { error: "Unable to delete income source. It may be linked to existing entries." };
  }
}
