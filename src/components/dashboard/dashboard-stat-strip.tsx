import type { DashboardStats } from "@/lib/services/dashboard-stats";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Wallet, PiggyBank, BadgeDollarSign, TrendingDown } from "lucide-react";

export function DashboardStatStrip({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      <KpiCard
        title="Total Accounts Balance"
        value={stats.accountsBalance}
        icon={Wallet}
        iconBgClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
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
        title="Monthly Spending"
        value={stats.monthlySpending}
        icon={TrendingDown}
        changePercent={stats.spendingDeltaPercent}
        favorableWhenDown={true}
        iconBgClass="bg-muted text-rose-600 dark:text-rose-400"
      />
    </div>
  );
}