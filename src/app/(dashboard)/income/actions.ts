"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createIncomeEntry, updateIncomeEntry, deleteIncomeEntry } from "@/lib/services/income.service";
import { generateSnapshot } from "@/lib/services/snapshot.service";
import { incomeSchema } from "@/lib/utils/validators";

export async function addIncome(formData: {
  amount: number;
  source_id: string;
  date: string;
  notes?: string;
  paycheck_id?: string;
}) {
  const parsed = incomeSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
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
    return { success: true };
  } catch (e) {
    return { error: "Failed to add income entry" };
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
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateIncomeEntry(supabase, id, parsed.data);
    const date = new Date(parsed.data.date);
    await generateSnapshot(supabase, user.id, date.getMonth() + 1, date.getFullYear());
    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: "Failed to update income entry" };
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
      .single();

    await deleteIncomeEntry(supabase, id);

    if (entry) {
      const date = new Date(entry.date);
      await generateSnapshot(supabase, user.id, date.getMonth() + 1, date.getFullYear());
    }

    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: "Failed to delete income entry" };
  }
}
