import { createClient } from "@/lib/supabase/server";
import { getSimulatedPurchases } from "@/lib/services/simulation.service";
import { getSavingsGoals } from "@/lib/services/goal.service";
import { calculateEmergencyFundStatus, calculateMonthlyNetSavings } from "@/lib/services/forecast.service";
import { SimulatorClient } from "./simulator-client";
import { redirect } from "next/navigation";

export default async function SimulatorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [simulations, goals, emergencyStatus, monthlyNetSavings] = await Promise.all([
    getSimulatedPurchases(supabase, user.id),
    getSavingsGoals(supabase, user.id),
    calculateEmergencyFundStatus(supabase, user.id),
    calculateMonthlyNetSavings(supabase, user.id),
  ]);

  return (
    <SimulatorClient
      simulations={simulations}
      goals={goals}
      emergencyStatus={emergencyStatus}
      monthlyNetSavings={monthlyNetSavings}
    />
  );
}
