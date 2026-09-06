"use server";

import { createClient } from "@/lib/supabase/server";
import { createReminder, updateReminder, deleteReminder } from "@/lib/services/reminder.service";
import { reminderSchema } from "@/lib/utils/validators";
import { revalidatePath } from "next/cache";

export async function addReminder(data: { title: string; due_date: string; notes?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = reminderSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { error: errorMsg || "Invalid input" };
  }

  try {
    const reminder = await createReminder(supabase, user.id, parsed.data);
    revalidatePath("/dashboard");
    return { data: reminder };
  } catch (error) {
    console.error("Failed to create reminder:", error);
    return { error: "Unable to create reminder. Please verify your inputs." };
  }
}

export async function toggleReminder(id: string, completed: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const reminder = await updateReminder(supabase, user.id, id, { completed });
    revalidatePath("/dashboard");
    return { data: reminder };
  } catch (error) {
    console.error("Failed to update reminder:", error);
    return { error: "Unable to update reminder. Please try again." };
  }
}

export async function removeReminder(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deleteReminder(supabase, user.id, id);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete reminder:", error);
    return { error: "Unable to delete reminder. Please try again." };
  }
}
