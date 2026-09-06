"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Persist a dismissed notification ID for the current user.
 * Stored in Supabase Auth user_metadata (no extra table needed).
 * The layout's getDynamicNotifications will filter these out on next load.
 */
export async function dismissNotification(notificationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const existing: string[] = (user.user_metadata?.dismissed_notification_ids as string[]) || [];
  if (existing.includes(notificationId)) {
    return { success: true }; // already dismissed, idempotent
  }

  const updated = [...existing, notificationId];
  const { error } = await supabase.auth.updateUser({
    data: { dismissed_notification_ids: updated },
  });

  if (error) {
    console.error("Failed to persist dismissed notification:", error.message);
    return { error: "Unable to dismiss notification. Please try again." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Clear all dismissed notifications for the current user (reset).
 */
export async function clearDismissedNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase.auth.updateUser({
    data: { dismissed_notification_ids: [] },
  });

  if (error) {
    console.error("Failed to clear dismissed notifications:", error.message);
    return { error: "Unable to clear notifications. Please try again." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
