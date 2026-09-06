"use client";

import { cn } from "@/lib/utils";

interface FinancialPulseProps {
  budgetUtilization: number;
}

export function FinancialPulse({ budgetUtilization }: FinancialPulseProps) {
  const safeUtilization = Number.isFinite(budgetUtilization) ? Math.max(0, budgetUtilization) : 0;

  const pulseColor =
    safeUtilization >= 100
      ? "bg-rose-500"
      : safeUtilization >= 75
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="h-1 w-full overflow-hidden bg-slate-100 dark:bg-slate-800/60 rounded-full">
      <div
        className={cn("h-full transition-all duration-500 rounded-full", pulseColor)}
        style={{ width: `${Math.min(100, Math.max(3, safeUtilization))}%` }}
      />
    </div>
  );
}
