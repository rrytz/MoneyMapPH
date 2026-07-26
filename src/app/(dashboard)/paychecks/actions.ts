"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPaycheck, deletePaycheck } from "@/lib/services/paycheck.service";
import { paycheckSchema } from "@/lib/utils/validators";

export async function addPaycheck(formData: {
  name: string;
  amount: number;
  date: string;
  notes?: string;
  allocations: Array<{ category_id?: string; label: string; amount: number }>;
}) {
  const parsed = paycheckSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createPaycheck(supabase, user.id, parsed.data);
    revalidatePath("/paychecks");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: "Failed to add paycheck" };
  }
}

export async function removePaycheck(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deletePaycheck(supabase, id);
    revalidatePath("/paychecks");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: "Failed to delete paycheck" };
  }
}
