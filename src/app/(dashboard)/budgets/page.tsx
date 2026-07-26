import { createClient } from "@/lib/supabase/server";
import { getBudgetStatuses } from "@/lib/services/financial.service";
import { getExpenseCategories } from "@/lib/services/category.service";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { BudgetsPageClient } from "./budgets-page-client";

export default async function BudgetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
