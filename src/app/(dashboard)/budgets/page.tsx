import { createClient, getUser } from "@/lib/supabase/server";
import { cachedGetBudgetStatuses as getBudgetStatuses } from "@/lib/cache/shared-queries";
import { cachedGetExpenseCategories as getExpenseCategories } from "@/lib/cache/shared-queries";
import { cachedGetMonthlyExpenseAggregation as getExpenseAggregation } from "@/lib/cache/shared-queries";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { BudgetsPageClient } from "./budgets-page-client";

export default async function BudgetsPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { month, year } = getCurrentMonthYear();
  const [statuses, categories, aggregation] = await Promise.all([
    getBudgetStatuses(supabase, user.id, month, year),
    getExpenseCategories(supabase, user.id),
    getExpenseAggregation(supabase, user.id, month, year),
  ]);

  return (
    <BudgetsPageClient
      statuses={statuses}
      categories={categories}
      aggregation={aggregation}
      currentMonth={month}
      currentYear={year}
    />
  );
}
