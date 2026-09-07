import { createClient, getUser } from "@/lib/supabase/server";
import { getSavingsGoals } from "@/lib/services/goal.service";
import { getExpenseCategories } from "@/lib/services/category.service";
import { getSnapshots } from "@/lib/services/snapshot.service";
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
