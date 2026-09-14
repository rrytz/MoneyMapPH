import { createClient, getUser } from "@/lib/supabase/server";
import { getExpenses } from "@/lib/services/expense.service";
import {
  cachedGetExpenseCategories as getExpenseCategories,
  cachedGetMonthlyExpenseAggregation as getExpenseAggregation,
} from "@/lib/cache/shared-queries";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { ExpensesPageClient } from "./expenses-page-client";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { month, year } = getCurrentMonthYear();
  const [{ data: entries }, categories, aggregation] = await Promise.all([
    getExpenses(supabase, user.id, { month, year, limit: 50 }),
    getExpenseCategories(supabase, user.id),
    getExpenseAggregation(supabase, user.id, month, year),
  ]);

  return (
    <ExpensesPageClient
      initialEntries={entries}
      categories={categories}
      totalThisMonth={aggregation.totalExpenses}
      expenseCount={aggregation.expenseCount}
      categoryTotals={aggregation.byCategory}
      currentMonth={month}
      currentYear={year}
    />
  );
}
