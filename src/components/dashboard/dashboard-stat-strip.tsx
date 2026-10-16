import type { DashboardStats } from "@/lib/services/dashboard-stats";
import { CurrencyDisplay } from "@/components/shared/currency-display";

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
    <section className="border-t border-b border-border">
      <div className="grid grid-cols-1 sm:grid-cols-3">
        <div className="py-4 pl-0 pr-4 border-b border-border sm:border-b-0 sm:border-r">
          <span className="type-section-label block">Savings</span>
          <CurrencyDisplay amount={stats.savingsBalance} className="type-ledger mt-1 block text-[28px] font-semibold tabular-nums text-foreground" />
        </div>
        <div className="py-4 px-4 border-b border-border sm:border-b-0 sm:border-r">
          <span className="type-section-label block">Total Debt</span>
          <CurrencyDisplay amount={stats.debtRemaining} className="type-ledger mt-1 block text-[28px] font-semibold tabular-nums text-foreground" />
          {stats.debtDeltaPercent !== null && (
            <span className="mt-1 block text-xs text-muted-foreground">est.</span>
          )}
        </div>
        <div className="py-4 px-4 pr-0">
          <span className="type-section-label block">Calendar month spending</span>
          <CurrencyDisplay amount={stats.monthlySpending} className="type-ledger mt-1 block text-[28px] font-semibold tabular-nums text-foreground" />
        </div>
      </div>
    </section>
  );
}
