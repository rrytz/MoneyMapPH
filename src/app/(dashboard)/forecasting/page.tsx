import { createClient, getUser } from "@/lib/supabase/server";
import { generateSavingsForecast } from "@/lib/services/forecast.service";
import { cachedGetSavingsGoals as getSavingsGoals } from "@/lib/cache/shared-queries";
import { cachedGetSnapshots as getSnapshots } from "@/lib/cache/shared-queries";
import { ForecastingClient } from "./forecasting-client";
import { redirect } from "next/navigation";

export default async function ForecastingPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const [snapshots, goals] = await Promise.all([
    getSnapshots(supabase, user.id, 6),
    getSavingsGoals(supabase, user.id),
  ]);

  const forecastData = await generateSavingsForecast(supabase, user.id, {
    snapshots,
    goals,
  });

  return <ForecastingClient forecastData={forecastData} goals={goals} />;
}
