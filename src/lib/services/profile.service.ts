import { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data as Profile;
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  data: Partial<Pick<Profile, "display_name" | "currency" | "theme" | "avatar_url">>
): Promise<Profile> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return profile as Profile;
}
