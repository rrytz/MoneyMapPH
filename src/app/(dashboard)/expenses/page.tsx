import { createClient, getUser } from "@/lib/supabase/server";
import { getExpenses } from "@/lib/services/expense.service";
import { getAccountsWithBalances } from "@/lib/services/account.service";
import {
  cachedGetExpenseCategories as getExpenseCategories,
  cachedGetMonthlyExpenseAggregation as getExpenseAggregation,
} from "@/lib/cache/shared-queries";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { resolveViewMonth } from "@/lib/utils/view-month";
import { ExpensesPageClient } from "./expenses-page-client";

interface ExpensesPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

// The query was already month-scoped but the month was hardcoded to the current
// one, so the log could not be moved off September. The URL now drives it, the
// same idiom /budgets uses, which means this screen and its sibling agree about
// what period they are showing.
export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const params = await searchParams;
  const { month, year } = resolveViewMonth(params.month, params.year, getCurrentMonthYear());
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
      key={`${month}-${year}`}
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
