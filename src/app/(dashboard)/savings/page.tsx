import { createClient } from "@/lib/supabase/server";
import { getSavingsGoals } from "@/lib/services/goal.service";
import { getExpenseCategories } from "@/lib/services/category.service";
import { calculateEmergencyFundStatus } from "@/lib/services/forecast.service";
import { SavingsPageClient } from "./savings-page-client";
import { redirect } from "next/navigation";

export default async function SavingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [goals, categories, emergencyStatus] = await Promise.all([
    getSavingsGoals(supabase, user.id),
    getExpenseCategories(supabase, user.id),
    calculateEmergencyFundStatus(supabase, user.id),
  ]);

  return (
    <SavingsPageClient
      initialGoals={goals}
      categories={categories}
      emergencyStatus={emergencyStatus}
    />
  );
}
