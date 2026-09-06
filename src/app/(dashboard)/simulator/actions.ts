"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSimulatedPurchase, deleteSimulatedPurchase } from "@/lib/services/simulation.service";
import { simulatedPurchaseSchema } from "@/lib/utils/validators";

export async function addSimulation(formData: {
  name: string;
  amount: number;
  target_date?: string;
  notes?: string;
}) {
  const parsed = simulatedPurchaseSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createSimulatedPurchase(supabase, user.id, parsed.data);
    revalidatePath("/simulator");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Failed to save simulated purchase:", err);
    return { success: false, error: "Unable to save simulated purchase. Please verify your inputs." };
  }
}

export async function removeSimulation(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deleteSimulatedPurchase(supabase, user.id, id);
    revalidatePath("/simulator");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete simulation:", err);
    return { success: false, error: "Unable to remove simulated purchase. Please try again." };
  }
}
