import type { DashboardStats } from "@/lib/services/dashboard-stats";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PiggyBank, BadgeDollarSign, TrendingDown } from "lucide-react";

export function DashboardStatStrip({ stats }: { stats: DashboardStats }) {
  // "Total Accounts Balance" is GONE, and it was not a styling problem.
  //
  // `computeDashboardStats` sets `accountsBalance: input.totalLiquidity`, and
  // the page passes `accountsView.totalLiquidity` to the hero's BalanceBlock.
  // Same value, same variable name, computed once - rendered twice on one
  // screen. It is not two figures that happened to agree; it is one datum shown
  // twice, which is the same collision as the Savings Rate and the second
  // Safe-to-Spend headline.
  //
  // On mobile that cost a whole card: four 192px cards stacked is 768px, and
  // one of those four was a copy of the largest number already on the page.
  // The hero owns that figure. Three genuine ones remain.
  //
  // The three are comparable in MEANING - all current-state figures, not
  // things-and-events - so per R2 they pair rather than stack. At 375px two
  // across and one spanning is 384px, against 576px for 1-up and 768px for the
  // four it replaced.
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <KpiCard
        title="Savings"
        value={stats.savingsBalance}
        icon={PiggyBank}
        iconBgClass="bg-muted text-muted-foreground"
      />
      <KpiCard
        title="Total Debt"
        value={stats.debtRemaining}
        icon={BadgeDollarSign}
        changePercent={stats.debtDeltaPercent}
        badge={stats.debtDeltaPercent !== null ? "est." : undefined}
        iconBgClass="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
      />
      {/* Spans the pair on the narrow grid, where an odd third would otherwise
          leave a hole. Back to one column at lg, where the three sit in a row. */}
      <KpiCard
        title="Calendar month spending"
        value={stats.monthlySpending}
        icon={TrendingDown}
        changePercent={stats.spendingDeltaPercent}
        favorableWhenDown={true}
        className="col-span-2 lg:col-span-1"
        iconBgClass="bg-muted text-rose-600 dark:text-rose-400"
      />
    </div>
  );
}
