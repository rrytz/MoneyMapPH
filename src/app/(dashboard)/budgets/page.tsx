import { createClient, getUser } from "@/lib/supabase/server";
import { cachedGetBudgetStatuses as getBudgetStatuses } from "@/lib/cache/shared-queries";
import { cachedGetExpenseCategories as getExpenseCategories } from "@/lib/cache/shared-queries";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { BudgetsPageClient } from "./budgets-page-client";

export default async function BudgetsPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { month, year } = getCurrentMonthYear();
  const [statuses, categories] = await Promise.all([
    getBudgetStatuses(supabase, user.id, month, year),
    getExpenseCategories(supabase, user.id),
  ]);

  return (
    <BudgetsPageClient
      statuses={statuses}
      categories={categories}
      currentMonth={month}
      currentYear={year}
    />
  );
}
