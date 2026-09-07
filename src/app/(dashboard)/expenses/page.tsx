import { createClient, getUser } from "@/lib/supabase/server";
import { getExpenses } from "@/lib/services/expense.service";
import { cachedGetExpenseCategories as getExpenseCategories } from "@/lib/cache/shared-queries";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { ExpensesPageClient } from "./expenses-page-client";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { month, year } = getCurrentMonthYear();
  const [{ data: entries }, categories] = await Promise.all([
    getExpenses(supabase, user.id, { month, year, limit: 50 }),
    getExpenseCategories(supabase, user.id),
  ]);

  const totalThisMonth = entries.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <ExpensesPageClient
      initialEntries={entries}
      categories={categories}
      totalThisMonth={totalThisMonth}
      currentMonth={month}
      currentYear={year}
    />
  );
}
