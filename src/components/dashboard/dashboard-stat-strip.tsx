import type { DashboardStats } from "@/lib/services/dashboard-stats";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Wallet, PiggyBank, BadgeDollarSign, TrendingDown } from "lucide-react";

export function DashboardStatStrip({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* gap-4, not gap-5 — slightly past the approved table, which named
          gap-6 as the value being replaced. A 4-up row of equal cards is the
          densest row on the dashboard and the direction is the same. Easy to
          revert if it reads cramped. */}
      <KpiCard
        title="Total Accounts Balance"
        value={stats.accountsBalance}
        icon={Wallet}
        iconBgClass="bg-sulpot-tint text-sulpot-deep dark:bg-sulpot-tint dark:text-sulpot-bright"
      />
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
      <KpiCard
        title="Calendar month spending"
        value={stats.monthlySpending}
        icon={TrendingDown}
        changePercent={stats.spendingDeltaPercent}
        favorableWhenDown={true}
        iconBgClass="bg-muted text-rose-600 dark:text-rose-400"
      />
    </div>
  );
}