"use server";

import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "@/lib/services/profile.service";
import { sniffImageKind } from "@/lib/utils/image-kind";
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
import { revalidateUserFinancialCache } from "@/lib/cache/tags";

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

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_PATH = (userId: string) => `${userId}/avatar.webp`;

/**
 * Profile-avatar upload. Same shape as uploadAccountQr, adapted: the key is
 * fixed per user (client always normalizes to WebP, so no kind-change
 * cleanup), the cap is 2 MB (avatars, not documents), and the column is
 * profiles.avatar_path. Upload first, write the column only once the bytes
 * land; a failed upload leaves the old avatar exactly as it was.
 */
export async function uploadAvatar(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file first." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { error: "That image is too large (max 2 MB)." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Magic bytes, never the extension or client MIME - both lie. The client
  // normalizes to WebP, so anything else arriving here bypassed it.
  const kind = sniffImageKind(bytes);
  if (!kind) {
    return { error: "That file is not a PNG, JPEG, or WebP image." };
  }

  const path = AVATAR_PATH(user.id);
  try {
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, bytes, { contentType: "image/webp", upsert: true });
    if (uploadError) throw uploadError;

    await updateProfile(supabase, user.id, { avatar_path: path });
    revalidatePath("/settings");
    return { success: true, path };
  } catch (err: unknown) {
    console.error("Failed to upload avatar:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unable to save the profile picture. Please try again." };
  }
}

/**
 * Profile-avatar removal. Column first, object second (the QR removal
 * ordering): a failed storage delete leaves an invisible orphan rather
 * than a path pointing at nothing. Display falls back to avatar_url,
 * never straight to initials.
 */
export async function removeAvatar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: row } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();
  try {
    await updateProfile(supabase, user.id, { avatar_path: null });
    if (row?.avatar_path) {
      await supabase.storage.from(AVATAR_BUCKET).remove([row.avatar_path]);
    }
    revalidatePath("/settings");
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to remove avatar:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unable to remove the profile picture. Please try again." };
  }
}

/**
 * Signed read URL for the settings thumbnail. Minted when the Profile tab
 * renders with a path set (the QR-modal idiom); the topbar mints its own
 * copy during chrome refresh. Never a public URL.
 */
export async function getAvatarUrl() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();
  if (!profile?.avatar_path) return { error: "No profile picture on file." };

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(profile.avatar_path, 300);
  if (error || !data?.signedUrl) return { error: "Unable to load the profile picture right now." };
  return { success: true, url: data.signedUrl };
}

export async function addExpenseCategorySetting(data: { name: string; icon?: string; color?: string }) {  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const validated = categorySchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  try {
    const category = await createExpenseCategory(supabase, user.id, data);
    revalidateUserFinancialCache(user.id);
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
    revalidateUserFinancialCache(user.id);
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
    revalidateUserFinancialCache(user.id);
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

export async function addIncomeSourceSetting(data: { name: string; type?: "core" | "incentive" }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const validated = sourceSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  try {
    const source = await createIncomeSource(supabase, user.id, data);
    revalidateUserFinancialCache(user.id);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/income");
    return { data: source };
  } catch (error) {
    console.error("Failed to add income source:", error);
    return { error: "Unable to add income source. Please verify your inputs." };
  }
}

export async function editIncomeSourceSetting(sourceId: string, data: { name: string; type?: "core" | "incentive" }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const validated = sourceSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  try {
    const source = await updateIncomeSource(supabase, user.id, sourceId, data);
    revalidateUserFinancialCache(user.id);
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
    revalidateUserFinancialCache(user.id);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/income");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete income source:", error);
    return { error: "Unable to delete income source. It may be linked to existing entries." };
  }
}
