import { createClient, getUser } from "@/lib/supabase/server";
import { getIncomeEntries } from "@/lib/services/income.service";
import { cachedGetIncomeSources as getIncomeSources, cachedGetExpenseCategories as getExpenseCategories } from "@/lib/cache/shared-queries";
import { cachedGetPaychecks as getPaychecks, cachedGetLeanStatus as getLeanStatus, cachedGetSafeToSpend as getSafeToSpend, cachedGetBillView, cachedGetBillsDueBy } from "@/lib/cache/shared-queries";
import { getCurrentMonthYear, toISODateString } from "@/lib/utils/date";
import { getNextPayoutDate } from "@/lib/utils/bills";
import { IncomePageClient } from "./income-page-client";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const params = await searchParams;
  const activeTab = params.tab === "bills" ? "bills" : "income";

  const { month, year } = getCurrentMonthYear();
  const [incomeData, sources, paychecks, categories, leanStatus, safeToSpend] = await Promise.all([
    getIncomeEntries(supabase, user.id, { month, year, limit: 20 }),
    getIncomeSources(supabase, user.id),
    getPaychecks(supabase, user.id, month, year),
    getExpenseCategories(supabase, user.id),
    getLeanStatus(supabase, user.id),
    getSafeToSpend(supabase, user.id),
  ]);

  let billView = undefined as Awaited<ReturnType<typeof cachedGetBillView>> | undefined;
  let billsDueBy = undefined as Awaited<ReturnType<typeof cachedGetBillsDueBy>> | undefined;
  if (activeTab === "bills") {
    const now = new Date();
    const nextPayout = toISODateString(getNextPayoutDate(now));
    const todayPlus7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayPlus7ISO = toISODateString(todayPlus7);
    const horizon = todayPlus7ISO > nextPayout ? todayPlus7ISO : nextPayout;
    [billView, billsDueBy] = await Promise.all([
      cachedGetBillView(supabase, user.id, year, month),
      cachedGetBillsDueBy(supabase, user.id, horizon),
    ]);
  }

  const totalThisMonth = incomeData.data.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <IncomePageClient
      initialEntries={incomeData.data}
      sources={sources}
      paychecks={paychecks}
      categories={categories}
      leanStatus={leanStatus}
      safeToSpend={safeToSpend}
      totalThisMonth={totalThisMonth}
      currentMonth={month}
      currentYear={year}
      initialActiveTab={activeTab}
      billView={billView}
      billsDueBy={billsDueBy}
    />
  );
}