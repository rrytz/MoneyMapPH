"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createIncomeEntry, updateIncomeEntry, deleteIncomeEntry } from "@/lib/services/income.service";
import { createPaycheck, deletePaycheck } from "@/lib/services/paycheck.service";
import { generateSnapshot } from "@/lib/services/snapshot.service";
import { incomeSchema, paycheckSchema } from "@/lib/utils/validators";

export async function addIncome(formData: {
  amount: number;
  source_id: string;
  date: string;
  notes?: string;
  paycheck_id?: string;
}) {
  const parsed = incomeSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createIncomeEntry(supabase, user.id, parsed.data);
    const date = new Date(parsed.data.date);
    await generateSnapshot(supabase, user.id, date.getMonth() + 1, date.getFullYear());
    revalidatePath("/income");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to add income entry:", err);
    return { success: false, error: "Unable to save income entry. Please verify your inputs and try again." };
  }
}

export async function editIncome(id: string, formData: {
  amount: number;
  source_id: string;
  date: string;
  notes?: string;
  paycheck_id?: string;
}) {
  const parsed = incomeSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateIncomeEntry(supabase, user.id, id, parsed.data);
    const date = new Date(parsed.data.date);
    await generateSnapshot(supabase, user.id, date.getMonth() + 1, date.getFullYear());
    revalidatePath("/income");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to update income entry:", err);
    return { success: false, error: "Unable to update income entry. Please try again." };
  }
}

export async function removeIncome(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const { data: entry } = await supabase
      .from("income_entries")
      .select("date")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    await deleteIncomeEntry(supabase, user.id, id);

    if (entry) {
      const date = new Date(entry.date);
      await generateSnapshot(supabase, user.id, date.getMonth() + 1, date.getFullYear());
    }

    revalidatePath("/income");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete income entry:", err);
    return { success: false, error: "Unable to remove income entry. Please try again." };
  }
}

export async function addPaycheck(formData: {
  name: string;
  amount: number;
  date: string;
  notes?: string;
  allocations: Array<{ category_id?: string; label: string; amount: number }>;
}) {
  const parsed = paycheckSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createPaycheck(supabase, user.id, parsed.data);
    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Failed to add paycheck:", err);
    return { success: false, error: "Unable to record paycheck. Please verify allocations and try again." };
  }
}

export async function removePaycheck(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deletePaycheck(supabase, user.id, id);
    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete paycheck:", err);
    return { success: false, error: "Unable to remove paycheck. Please try again." };
  }
}
