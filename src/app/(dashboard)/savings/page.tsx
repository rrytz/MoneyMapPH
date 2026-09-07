import { createClient, getUser } from "@/lib/supabase/server";
import { cachedGetSavingsGoals as getSavingsGoals } from "@/lib/cache/shared-queries";
import { cachedGetExpenseCategories as getExpenseCategories } from "@/lib/cache/shared-queries";
import { cachedGetSnapshots as getSnapshots } from "@/lib/cache/shared-queries";
import { calculateEmergencyFundStatus } from "@/lib/services/forecast.service";
import { SavingsPageClient } from "./savings-page-client";
import { redirect } from "next/navigation";

export default async function SavingsPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const [goals, categories, snapshots] = await Promise.all([
    getSavingsGoals(supabase, user.id),
    getExpenseCategories(supabase, user.id),
    getSnapshots(supabase, user.id, 6),
  ]);

  const emergencyStatus = await calculateEmergencyFundStatus(supabase, user.id, {
    goals,
    snapshots,
  });

  return (
    <SavingsPageClient
      initialGoals={goals}
      categories={categories}
      emergencyStatus={emergencyStatus}
    />
  );
}
