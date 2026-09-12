"use client";

import { Gauge } from "lucide-react";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { SafeToSpendStatus } from "@/lib/types";

export function SafeToSpendCard({ status }: { status: SafeToSpendStatus }) {
  if (!status.hasPaychecks) {
    return (
      <FintechCard className="relative">
        <FintechCardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <Gauge className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Safe to Spend</span>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">—</div>
            <p className="text-[11px] text-muted-foreground">Log your paycheck to unlock safe-to-spend.</p>
          </div>
        </FintechCardContent>
      </FintechCard>
    );
  }

  const received = status.coreIncome + status.incentiveIncomeLogged;
  const state =
    status.safeToSpend < 0
      ? { color: "text-rose-500", bar: "bg-rose-500", label: "Over this cutoff" }
      : status.safeToSpend === 0 || (received > 0 && status.safeToSpend / received <= 0.2)
        ? { color: "text-amber-500", bar: "bg-amber-500", label: "Nearly out this cutoff" }
        : { color: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", label: "Safe to spend this cutoff" };
  const pct = Math.min(100, Math.round(status.fractionElapsed * 100));

  return (
    <FintechCard className="relative">
      <FintechCardContent className="p-5 flex flex-col justify-between h-full space-y-4">
        <div className="flex items-center justify-between">
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Gauge className="h-4.5 w-4.5" />
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-200/50">
            {state.label}
          </span>
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Safe to Spend</span>
          <CurrencyDisplay amount={status.safeToSpend} signed className={cn("text-2xl sm:text-3xl font-bold tracking-tight tabular-nums", state.color)} />
          <p className="text-[11px] text-muted-foreground">
            this cutoff · ends {formatDate(status.periodEnd, "MMM d")}
          </p>
        </div>

        <div className="space-y-1.5 pt-1 border-t border-border/50 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px]">{status.daysRemaining} days left in this cutoff</span>
            <span className="text-muted-foreground text-[11px] tabular-nums">{pct}% elapsed</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className={cn("h-full rounded-full", state.bar)} style={{ width: `${pct}%` }} />
          </div>
          {status.incentiveIncomeLogged > 0 && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
              + <CurrencyDisplay amount={status.incentiveIncomeLogged} /> incentives logged this cutoff
            </p>
          )}
        </div>
      </FintechCardContent>
    </FintechCard>
  );
}