import { createClient, getUser } from "@/lib/supabase/server";
import { getExpenses } from "@/lib/services/expense.service";
import { getAccountsWithBalances } from "@/lib/services/account.service";
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
  const [{ data: entries }, categories, aggregation, accountsResult] = await Promise.all([
    // limit 10_000, not 50, matching /transactions. At 50 this was a ceiling
    // rather than a page size: a user with more than 50 expenses in a month had
    // entries that could not be reached at all, and the pager added last slice
    // would have shown an empty page 4 rather than admitting one. Fetch broadly
    // and let the client's 15-per-page pager do the narrowing, which is what
    // its sibling already does.
    getExpenses(supabase, user.id, { month, year, limit: 10_000 }),
    getExpenseCategories(supabase, user.id),
    getExpenseAggregation(supabase, user.id, month, year),
    getAccountsWithBalances(supabase, user.id, false).catch(() => ({ accounts: [], unassigned: { unassignedIncome: 0, unassignedExpenses: 0 }, totalLiquidity: 0 })),
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
      accounts={accountsResult.accounts}
    />
  );
}
