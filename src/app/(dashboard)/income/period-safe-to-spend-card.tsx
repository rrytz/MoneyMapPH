"use client";

import { CalendarRange } from "lucide-react";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { SafeToSpendStatus } from "@/lib/types";

function BreakdownRow({ label, amount, accent }: { label: string; amount: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <CurrencyDisplay amount={amount} className={cn("font-semibold tabular-nums", accent)} />
    </div>
  );
}

export function PeriodSafeToSpendCard({ status }: { status: SafeToSpendStatus }) {
  return (
    <FintechCard>
      <FintechCardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CalendarRange className="h-4 w-4" />
          </div>
          <div>
            <FintechCardTitle>This cutoff</FintechCardTitle>
            <p className="text-xs text-muted-foreground">
              {formatDate(status.periodStart)} – {formatDate(status.periodEnd)}
            </p>
          </div>
        </div>
      </FintechCardHeader>
      <FintechCardContent className="space-y-3">
        {!status.hasPaychecks ? (
          <p className="text-xs text-muted-foreground">
            Log your paycheck to unlock safe-to-spend. Core income counts paychecks only.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">Safe to spend</span>
              <CurrencyDisplay
                amount={status.safeToSpend}
                signed
                className={cn(
                  "text-2xl font-bold tracking-tight tabular-nums",
                  status.safeToSpend <= 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"
                )}
              />
            </div>
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <BreakdownRow label="Core income" amount={status.coreIncome} />
              <BreakdownRow label="Incentives logged" amount={status.incentiveIncomeLogged} accent="text-emerald-600 dark:text-emerald-400" />
              <BreakdownRow label="Spent this cutoff" amount={status.spentThisPeriod} accent="text-rose-500" />
            </div>
            <p className="text-[11px] text-muted-foreground">{status.daysRemaining} days left in this cutoff</p>
          </>
        )}
      </FintechCardContent>
    </FintechCard>
  );
}