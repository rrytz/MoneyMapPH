import { createClient, getUser } from "@/lib/supabase/server";
import { getIncomeEntries } from "@/lib/services/income.service";
import { resolveIncomeViewEntries } from "@/lib/utils/income-view";
import type { IncomeEntry } from "@/lib/types";
import { cachedGetIncomeSources as getIncomeSources, cachedGetExpenseCategories as getExpenseCategories } from "@/lib/cache/shared-queries";
import { cachedGetPaychecks as getPaychecks, cachedGetLeanStatus as getLeanStatus, cachedGetSafeToSpend as getSafeToSpend, cachedGetBillView, cachedGetBillsDueBy } from "@/lib/cache/shared-queries";
import { getCurrentMonthYear, getManilaNow } from "@/lib/utils/date";
import { getAccountsWithBalances } from "@/lib/services/account.service";
import { getBillsDueWindow } from "@/lib/utils/bills";
import { IncomePageClient } from "./income-page-client";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const params = await searchParams;
  const activeTab = params.tab === "bills" ? "bills" : "income";
  const view = params.view === "all" ? "all" : "month";

  const { month, year } = getCurrentMonthYear();
  const [monthEntries, allEntries, sources, paychecks, categories, leanStatus, safeToSpend, accountsResult] = await Promise.all([
    getIncomeEntries(supabase, user.id, { month, year, limit: 20 }),
    view === "all" ? getIncomeEntries(supabase, user.id, { limit: 10_000 }) : Promise.resolve({ data: [] as IncomeEntry[], count: 0 }),
    getIncomeSources(supabase, user.id),
    getPaychecks(supabase, user.id, month, year),
    getExpenseCategories(supabase, user.id),
    getLeanStatus(supabase, user.id),
    getSafeToSpend(supabase, user.id),
    getAccountsWithBalances(supabase, user.id, false).catch(() => ({ accounts: [], unassigned: { unassignedIncome: 0, unassignedExpenses: 0 }, totalLiquidity: 0 })),
  ]);
  const accounts = accountsResult.accounts;

  let billView = undefined as Awaited<ReturnType<typeof cachedGetBillView>> | undefined;
  let billsDueBy = undefined as Awaited<ReturnType<typeof cachedGetBillsDueBy>> | undefined;
  if (activeTab === "bills") {
    const { fromISO, toISO } = getBillsDueWindow(getManilaNow());
    const horizon = toISO;
    [billView, billsDueBy] = await Promise.all([
      cachedGetBillView(supabase, user.id, year, month),
      cachedGetBillsDueBy(supabase, user.id, fromISO, horizon),
    ]);
  }

  const totalThisMonth = monthEntries.data.reduce((sum, e) => sum + Number(e.amount), 0);
  const activeEntries = resolveIncomeViewEntries(monthEntries.data, allEntries.data, view);

  return (
    <IncomePageClient
      key={view}
      initialEntries={activeEntries}
      monthEntries={monthEntries.data}
      view={view}
      sources={sources}
      paychecks={paychecks}
      categories={categories}
      leanStatus={leanStatus}
      safeToSpend={safeToSpend}
      totalThisMonth={totalThisMonth}
      currentMonth={month}
      currentYear={year}
      initialActiveTab={activeTab}
      accounts={accounts}
      billView={billView}
      billsDueBy={billsDueBy}
    />
  );
}