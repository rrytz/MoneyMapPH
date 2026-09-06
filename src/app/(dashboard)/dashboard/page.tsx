import { createClient, getUser } from "@/lib/supabase/server";
import { getMonthlySummary } from "@/lib/services/financial.service";
import { getSnapshots } from "@/lib/services/snapshot.service";
import { getExpenseCategories } from "@/lib/services/category.service";
import { getSavingsGoals } from "@/lib/services/goal.service";
import { calculateFinancialHealthReport } from "@/lib/services/health.service";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { FinancialHealthHeroCard } from "@/components/dashboard/health-hero-card";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { CategoryDonutChart } from "@/components/dashboard/category-donut-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
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

  const [summary, snapshots, categories, goals, healthReport] = await Promise.all([
    getMonthlySummary(supabase, user.id, month, year),
    getSnapshots(supabase, user.id, 6),
    getExpenseCategories(supabase, user.id),
    getSavingsGoals(supabase, user.id),
    calculateFinancialHealthReport(supabase, user.id),
  ]);

  const lastMonthSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const incomeChange = lastMonthSnapshot && Number(lastMonthSnapshot.total_income) > 0
    ? ((summary.totalIncome - Number(lastMonthSnapshot.total_income)) / Number(lastMonthSnapshot.total_income)) * 100
    : null;

  const [{ data: recentIncome }, { data: recentExpenses }] = await Promise.all([
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
  ]);

  const transactions = [
    ...(recentIncome || []).map((e) => {
      const item = e as unknown as { id: string; amount: number; date: string; source: { name: string } | null };
      return {
        id: item.id,
        type: "income" as const,
        title: item.source?.name || "Income",
        amount: Number(item.amount),
        date: item.date,
      };
    }),
    ...(recentExpenses || []).map((e) => {
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
      {/* Top Section: Health Hero Card + Top KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1">
          <FinancialHealthHeroCard report={healthReport} />
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <KpiCard
            title="Remaining Budget"
            value={summary.remainingBudget}
            icon={Wallet}
            changePercent={incomeChange}
            iconBgClass="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
          <KpiCard
            title="Savings Rate"
            value={summary.savingsRate}
            icon={PiggyBank}
            isCurrency={false}
            isPercentage={true}
            badge="25% goal"
            iconBgClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
          />
        </div>
      </div>

      {/* Row 2: Performance Charts & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeExpenseChart snapshots={snapshots} />
        <CategoryDonutChart categorySpending={summary.categorySpending} categories={categories} />
      </div>

      {/* Row 3: Savings Goals & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-border/70 hover:border-emerald-200 transition-colors"
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

        <RecentTransactions transactions={transactions} />
      </div>
    </div>
  );
}
