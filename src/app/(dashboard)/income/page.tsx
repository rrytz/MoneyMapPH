import { createClient } from "@/lib/supabase/server";
import { getIncomeEntries } from "@/lib/services/income.service";
import { getIncomeSources, getExpenseCategories } from "@/lib/services/category.service";
import { getPaychecks } from "@/lib/services/paycheck.service";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { IncomePageClient } from "./income-page-client";

export default async function IncomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { month, year } = getCurrentMonthYear();
  const [{ data: entries, count }, sources, paychecks, categories] = await Promise.all([
    getIncomeEntries(supabase, user.id, { month, year, limit: 20 }),
    getIncomeSources(supabase, user.id),
    getPaychecks(supabase, user.id, month, year),
    getExpenseCategories(supabase, user.id),
  ]);

  const totalThisMonth = entries.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <IncomePageClient
      initialEntries={entries}
      initialCount={count}
      sources={sources}
      paychecks={paychecks}
      categories={categories}
      totalThisMonth={totalThisMonth}
      currentMonth={month}
      currentYear={year}
    />
  );
}