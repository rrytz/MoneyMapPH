import { createClient, getUser } from "@/lib/supabase/server";
import { getIncomeEntries } from "@/lib/services/income.service";
import { cachedGetIncomeSources as getIncomeSources, cachedGetExpenseCategories as getExpenseCategories } from "@/lib/cache/shared-queries";
import { cachedGetPaychecks as getPaychecks, cachedGetLeanStatus as getLeanStatus } from "@/lib/cache/shared-queries";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { IncomePageClient } from "./income-page-client";

export default async function IncomePage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { month, year } = getCurrentMonthYear();
  const [{ data: entries }, sources, paychecks, categories, leanStatus] = await Promise.all([
    getIncomeEntries(supabase, user.id, { month, year, limit: 20 }),
    getIncomeSources(supabase, user.id),
    getPaychecks(supabase, user.id, month, year),
    getExpenseCategories(supabase, user.id),
    getLeanStatus(supabase, user.id),
  ]);

  const totalThisMonth = entries.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <IncomePageClient
      initialEntries={entries}
      sources={sources}
      paychecks={paychecks}
      categories={categories}
      leanStatus={leanStatus}
      totalThisMonth={totalThisMonth}
      currentMonth={month}
      currentYear={year}
    />
  );
}