"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createExpense, updateExpense, deleteExpense } from "@/lib/services/expense.service";
import { generateSnapshot } from "@/lib/services/snapshot.service";
import { expenseSchema } from "@/lib/utils/validators";

export async function addExpense(formData: {
  title: string;
  amount: number;
  category_id: string;
  date: string;
  notes?: string;
  paycheck_id?: string;
}) {
  const parsed = expenseSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createExpense(supabase, user.id, parsed.data);
    const date = new Date(parsed.data.date);
    await generateSnapshot(supabase, user.id, date.getMonth() + 1, date.getFullYear());
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/budgets");
    revalidatePath("/transactions");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to add expense:", err);
    return { success: false, error: "Unable to record expense. Please verify your inputs and try again." };
  }
}

export async function editExpense(id: string, formData: {
  title: string;
  amount: number;
  category_id: string;
  date: string;
  notes?: string;
  paycheck_id?: string;
}) {
  const parsed = expenseSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateExpense(supabase, user.id, id, parsed.data);
    const date = new Date(parsed.data.date);
    await generateSnapshot(supabase, user.id, date.getMonth() + 1, date.getFullYear());
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/budgets");
    revalidatePath("/transactions");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to update expense:", err);
    return { success: false, error: "Unable to update expense. Please try again." };
  }
}

export async function removeExpense(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const { data: entry } = await supabase
      .from("expenses")
      .select("date")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    await deleteExpense(supabase, user.id, id);

    if (entry) {
      const date = new Date(entry.date);
      await generateSnapshot(supabase, user.id, date.getMonth() + 1, date.getFullYear());
    }

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/budgets");
    revalidatePath("/transactions");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete expense:", err);
    return { success: false, error: "Unable to remove expense. Please try again." };
  }
}
