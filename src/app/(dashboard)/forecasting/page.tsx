import { createClient } from "@/lib/supabase/server";
import { generateSavingsForecast } from "@/lib/services/forecast.service";
import { getSavingsGoals } from "@/lib/services/goal.service";
import { ForecastingClient } from "./forecasting-client";
import { redirect } from "next/navigation";

export default async function ForecastingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [forecastData, goals] = await Promise.all([
    generateSavingsForecast(supabase, user.id),
    getSavingsGoals(supabase, user.id),
  ]);

  return <ForecastingClient forecastData={forecastData} goals={goals} />;
}
