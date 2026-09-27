import { createClient, getUser } from "@/lib/supabase/server";
import { cachedGetMonthlySummary as getMonthlySummary, cachedGetBudgetStatuses as getBudgetStatuses } from "@/lib/cache/shared-queries";
import { cachedGetSnapshots as getSnapshots } from "@/lib/cache/shared-queries";
import { cachedGetExpenseCategories as getExpenseCategories } from "@/lib/cache/shared-queries";
import { cachedGetSavingsGoals as getSavingsGoals } from "@/lib/cache/shared-queries";
import { cachedGetPaychecks as getPaychecks } from "@/lib/cache/shared-queries";
import { cachedGetSafeToSpend as getSafeToSpend } from "@/lib/cache/shared-queries";
import { cachedGetDebts as getDebts, cachedGetBillsDueBy as getBillsDueBy } from "@/lib/cache/shared-queries";
import { cachedGetAccountsWithBalances as getAccounts } from "@/lib/cache/shared-queries";
import { getCurrentMonthYear, getManilaNow, toISODateString } from "@/lib/utils/date";
import { getBillsDueWindow } from "@/lib/utils/bills";
import { BalanceBlock } from "@/components/dashboard/balance-block";
import { AttentionStrip } from "@/components/dashboard/attention-strip";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";import { CategoryDonutChart } from "@/components/dashboard/category-donut-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { UpcomingBillsCard } from "@/components/dashboard/upcoming-bills-card";
import { DashboardStatStrip } from "@/components/dashboard/dashboard-stat-strip";
import { ChartPair } from "@/components/dashboard/chart-pair";
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

  // calculateFinancialHealthReport is gone from this path. The Financial Health
  // rollup card was removed from the dashboard: its four sub-scores are binary
  // 0%/100% figures, so a 50/100 headline does not visibly reconcile with them,
  // and its guidance line was generic. The four metrics it rolled up are each
  // already visible where they are actionable. Only the rollup was lost, not
  // the data - and the rollup can live somewhere cheaper if it is ever missed.
  //
  // This also removes a sequential database round-trip from the dashboard's
  // render, since it was awaited outside the Promise.all above.
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
    <div className="space-y-4">
      {/* space-y-4 between rows, not space-y-6. This is the "dashboard is too
          long" lever — 8 rows at 8px saved each. Deliberately not applied to
          the shared FintechCard p-6 default, which every other page inherits. */}
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

      {/* Whether the card renders is "do I have bills or debts at all", NOT
          "is something due right now". Those are different predicates, and only
          the second one makes the empty state dead:

            occurrences.length > 0  implies  billItems.length > 0
                                     implies  items.length > 0

          so a gate on occurrences alone guaranteed the card could never reach
          its own "Nothing due" branch. Worse, that gate counted BILLS only,
          while the card is titled "Bills & Debt Payments" and is handed the
          debts - so an unpaid debt falling due with no active bill was
          invisible. A paused bill and a real obligation cancelled each other.

          Gating on existence also makes the empty branch reachable: a debt that
          is fully paid off, or overdue (the card filters both out of
          debtItems), renders the card and lets it say "Nothing due". */}
      {(billsDueBy.occurrences.length > 0 || debtView.debts.length > 0) && (
        <UpcomingBillsCard
          billsDueBy={billsDueBy}
          debts={debtView.debts}
          payments={debtView.payments}
          todayIso={todayIso}
        />
      )}

      {/* Supporting detail, lower weight. */}
      {/* MOBILE COMPOSITION. These four are DESKTOP blocks and they are not on
          the phone at all.

          Each has a home that already exists: the charts live on Forecasting,
          transactions on /transactions, goals on /savings, and the three
          figures the stat strip carries are on /savings and /expenses. None is
          exclusive to the dashboard, so cutting them loses no information - only
          proximity.

          That is the whole argument for cutting rather than compressing. The
          desktop dashboard carries seven blocks because they fit two-up at a
          desk. A phone answers one question: am I okay, and what is coming. So
          mobile is the hero, the gauge, safe-to-spend, the alert and Upcoming -
          measured at about 993px, 1.5 folds, against 5.28 before any of this.

          The risk is real and accepted: with nothing due, the mobile dashboard
          is very short. Short is the goal, not a failure mode.

          hidden lg:block rather than a conditional, so the server render and the
          client tree stay identical - the alternative is a viewport check, which
          is a hydration bug waiting for a rotation. */}

      <div className="hidden lg:block">
        <DashboardStatStrip stats={stats} />
      </div>
      <div className="hidden lg:block">
        <ChartPair
          trends={<IncomeExpenseChart snapshots={snapshots} />}
          categories={
            <CategoryDonutChart categorySpending={summary.categorySpending} categories={categories} />
          }
        />
      </div>

      {/* Goals and Recent Transactions share a two-up row on desktop, which is
          the densest pair on the page - and on mobile that row is the single
          largest remaining block (322px + 250px). Both have a screen of their
          own, so the whole row goes rather than either half. */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
        {/* Goals, whose rows are 2-up. Stacked, three rows cost 3 x 71px; side
            by side they cost one row. The card is half width now anyway, so
            two rows across it is the same density the full-width version was
            reaching for with wasted space. */}
        <FintechCard className="flex flex-col">
        <FintechCardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <FintechCardTitle>Savings Goals</FintechCardTitle>
            <p className="text-xs text-muted-foreground">Target financial milestones</p>
          </div>
          <Link
            href="/savings"
            className="text-xs font-semibold text-sulpot-deep dark:text-sulpot-bright hover:underline flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> New Goal
          </Link>
        </FintechCardHeader>
        <FintechCardContent className="pt-0">
          {goals.length === 0 ? (
            <EmptyState
              icon={<Target className="h-6 w-6" />}
              title="Start Your First Goal"
              description="Create an Emergency Fund, Motorcycle Fund, Travel Fund, or Gadget Fund."
              actionLabel="Create Goal"
              actionHref="/savings"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {goals.slice(0, 3).map((goal) => {
              const target = Number(goal.target_amount);
              const current = Number(goal.current_amount);
              const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

              const ringDasharray = 100.48; // 2 * PI * 16
              const ringDashoffset = ringDasharray - (ringDasharray * progress) / 100;

              return (
                /* Borderless inset row on the Tide surface. This row
                   previously painted a near-black, blue-cast legacy panel
                   inside a Tide card, so the card read as a different app
                   from the ones above it. */
                <div
                  key={goal.id}
                  className="flex items-center gap-4 p-3.5 rounded-lg bg-muted/30 transition-colors hover:bg-muted/50"
                >
                  <div className="relative h-12 w-12 flex items-center justify-center shrink-0">
                    <svg className="h-full w-full transform -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
                      {/* Track is chrome, not data — a Tide neutral, never slate. */}
                      <circle cx="20" cy="20" r="16" className="stroke-border" strokeWidth="4" fill="transparent" />
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        className="stroke-sulpot transition-all duration-700"
                        strokeWidth="4"
                        strokeDasharray={ringDasharray}
                        strokeDashoffset={ringDashoffset}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <span className="type-measurement absolute text-[10px] font-bold text-foreground tabular-nums">
                      {progress}%
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="type-section-label truncate normal-case tracking-normal text-foreground">
                      {goal.name}
                    </h4>
                    {/* Currency, not a measurement: this is a peso amount, so
                        it stays in the function face. Only the ring's % and
                        the axis ticks take Martian. */}
                    <p className="figure-inline text-[11px] text-muted-foreground tabular-nums">
                      ₱{current.toLocaleString()} of {formatCompactAmount(target)}
                    </p>
                  </div>
                </div>
            );
            })}
            </div>
          )}
        </FintechCardContent>
      </FintechCard>

        {/* Recent Activity, sharing the row with Savings Goals. A two-up row
            does not shorten a block, it takes the block out of the stack:
            255 + 484 + a gap became one 418px row. Date is hidden because the
            table is a real <table> in an overflow-x-auto and would otherwise
            scroll sideways inside the card — see RecentTransactions' hideDate.
            items-start keeps the shorter goals card from stretching. */}
        <RecentTransactions transactions={transactions} hideDate />
      </div>
    </div>
  );
}
