import { createClient, getUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/services/profile.service";
import { getExpenseCategories, getIncomeSources } from "@/lib/services/category.service";
import { SettingsClient } from "./settings-client";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const [profile, categories, sources] = await Promise.all([
    getProfile(supabase, user.id),
    getExpenseCategories(supabase, user.id),
    getIncomeSources(supabase, user.id),
  ]);

  return (
    <SettingsClient
      profile={profile}
      categories={categories}
      sources={sources}
    />
  );
}
