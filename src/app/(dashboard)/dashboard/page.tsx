import { createClient, getUser } from "@/lib/supabase/server";
import { cachedGetMonthlySummary as getMonthlySummary, cachedGetBudgetStatuses as getBudgetStatuses } from "@/lib/cache/shared-queries";
import { cachedGetSnapshots as getSnapshots } from "@/lib/cache/shared-queries";
import { cachedGetExpenseCategories as getExpenseCategories } from "@/lib/cache/shared-queries";
import { cachedGetSavingsGoals as getSavingsGoals } from "@/lib/cache/shared-queries";
import { cachedGetPaychecks as getPaychecks } from "@/lib/cache/shared-queries";
import { cachedGetSafeToSpend as getSafeToSpend } from "@/lib/cache/shared-queries";
import { cachedGetDebts as getDebts, cachedGetBillsDueBy as getBillsDueBy } from "@/lib/cache/shared-queries";
import { cachedGetAccountsWithBalances as getAccounts } from "@/lib/cache/shared-queries";
import { calculateFinancialHealthReport } from "@/lib/services/health.service";
import { getCurrentMonthYear, getManilaNow, toISODateString } from "@/lib/utils/date";
import { SAVINGS_RATE_LABEL } from "@/lib/utils/health-breakdown";
import { getBillsDueWindow } from "@/lib/utils/bills";
import { BalanceBlock } from "@/components/dashboard/balance-block";
import { AttentionStrip } from "@/components/dashboard/attention-strip";
import { FinancialHealthHeroCard } from "@/components/dashboard/health-hero-card";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { CategoryDonutChart } from "@/components/dashboard/category-donut-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { UpcomingBillsCard } from "@/components/dashboard/upcoming-bills-card";
import { DashboardStatStrip } from "@/components/dashboard/dashboard-stat-strip";
import { computeDashboardStats } from "@/lib/services/dashboard-stats";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Wallet, PiggyBank, Target, Plus } from "lucide-react";
import Link from "next/link";

import { formatCompactAmount } from "@/lib/utils/currency";

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { month, year } = getCurrentMonthYear();
  const now = getManilaNow();
  const todayIso = toISODateString(now);
  const { fromISO, toISO } = getBillsDueWindow(now);

  const [
    summary,
    snapshots,
    categories,
    goals,
    recentIncome,
    recentExpenses,
    budgetStatuses,
    paychecks,
    safeToSpend,
    debtView,
    accountsView,
    billsDueBy,
  ] = await Promise.all([
    getMonthlySummary(supabase, user.id, month, year),
    getSnapshots(supabase, user.id, 6),
    getExpenseCategories(supabase, user.id),
    getSavingsGoals(supabase, user.id),
    supabase
      .from("income_entries")
      .select("id, amount, date, source:income_sources(name)")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("expenses")
      .select("id, title, amount, date, category:expense_categories(name)")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(5),
    getBudgetStatuses(supabase, user.id, month, year),
    getPaychecks(supabase, user.id, month, year),
    getSafeToSpend(supabase, user.id),
    getDebts(supabase, user.id),
    getAccounts(supabase, user.id, false),
    getBillsDueBy(supabase, user.id, fromISO, toISO),
  ]);

  const healthReport = await calculateFinancialHealthReport(supabase, user.id, {
    summary,
    goals,
    snapshots,
    budgetStatuses,
    paychecks,
  });

  const stats = computeDashboardStats({
    summary,
    snapshots,
    totalLiquidity: accountsView.totalLiquidity,
    goals,
    debts: debtView.debts,
    payments: debtView.payments,
  });

  const lastMonthSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const incomeChange = lastMonthSnapshot && Number(lastMonthSnapshot.total_income) > 0
    ? ((summary.totalIncome - Number(lastMonthSnapshot.total_income)) / Number(lastMonthSnapshot.total_income)) * 100
    : null;

  const transactions = [
    ...(recentIncome.data || []).map((e) => {
      const item = e as unknown as { id: string; amount: number; date: string; source: { name: string } | null };
      return {
        id: item.id,
        type: "income" as const,
        title: item.source?.name || "Income",
        amount: Number(item.amount),
        date: item.date,
      };
    }),
    ...(recentExpenses.data || []).map((e) => {
      const item = e as unknown as { id: string; title: string; amount: number; date: string; category: { name: string } | null };
      return {
        id: item.id,
        type: "expense" as const,
        title: item.title,
        amount: Number(item.amount),
        date: item.date,
        category: item.category?.name,
      };
    }),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* S5b — the dominant element. Everything below is subordinate. */}
      <BalanceBlock
        totalBalance={accountsView.totalLiquidity}
        safeToSpend={safeToSpend}
        hasAnyAccount={accountsView.accounts.length > 0}
        monthIncome={summary.totalIncome}
        monthExpenses={summary.totalExpenses}
      />

      {/* Attention — urgency only, and only when something is actually due.
          The old SafeToSpendCard restated the balance block's numbers at
          ledger-figure weight, putting two loud figures on one surface. */}
      <AttentionStrip safeToSpend={safeToSpend} />

      {/* Supporting: the one Featured card (Financial Health), now the only
          large surface below the balance block. */}
      <FinancialHealthHeroCard report={healthReport} />

      {/* Attention — rendered only when something is actually due. */}
      {billsDueBy.occurrences.length > 0 && (
        <UpcomingBillsCard
          billsDueBy={billsDueBy}
          debts={debtView.debts}
          payments={debtView.payments}
          todayIso={todayIso}
        />
      )}

      {/* Supporting detail, lower weight. */}
      <DashboardStatStrip stats={stats} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <IncomeExpenseChart snapshots={snapshots} />
        <CategoryDonutChart categorySpending={summary.categorySpending} categories={categories} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FintechCard className="flex flex-col">
          <FintechCardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <FintechCardTitle>Savings Goals</FintechCardTitle>
              <p className="text-xs text-muted-foreground">Target financial milestones</p>
            </div>
            <Link
              href="/savings"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> New Goal
            </Link>
          </FintechCardHeader>
          <FintechCardContent className="space-y-4 flex-1">
            {goals.length === 0 ? (
              <EmptyState
                icon={<Target className="h-6 w-6" />}
                title="Start Your First Goal"
                description="Create an Emergency Fund, Motorcycle Fund, Travel Fund, or Gadget Fund."
                actionLabel="Create Goal"
                actionHref="/savings"
              />
            ) : (
              goals.slice(0, 3).map((goal) => {
                const target = Number(goal.target_amount);
                const current = Number(goal.current_amount);
                const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

                const ringDasharray = 100.48; // 2 * PI * 16
                const ringDashoffset = ringDasharray - (ringDasharray * progress) / 100;

                return (
                  <div
                    key={goal.id}
                    className="flex items-center gap-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border/70 hover:border-emerald-200 transition-colors"
                  >
                    <div className="relative h-12 w-12 flex items-center justify-center shrink-0">
                      <svg className="h-full w-full transform -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
                        <circle cx="20" cy="20" r="16" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="4" fill="transparent" />
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          className="stroke-emerald-500 transition-all duration-700"
                          strokeWidth="4"
                          strokeDasharray={ringDasharray}
                          strokeDashoffset={ringDashoffset}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                      <span className="absolute text-[10px] font-bold text-foreground tabular-nums">
                        {progress}%
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate">{goal.name}</h4>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        ₱{current.toLocaleString()} of {formatCompactAmount(target)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </FintechCardContent>
        </FintechCard>
      </div>

      {/* Row 5: Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <RecentTransactions transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
