"use client";

import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import type { LeanStatus } from "@/lib/types";

export function LeanStatusChip({ status }: { status: LeanStatus }) {
  if (status.phase === "insufficient") {
    return (
      <Badge
        variant="outline"
        title={`Lean alerts activate after ~6 logged cutoffs. You have ${status.periodsUsed}. Income basis is paycheck entries only.`}
      >
        Reading your cutoffs… lean alerts need ~3 pay periods
      </Badge>
    );
  }

  const { targetPeriodEnd, targetIncome, median, ratio } = status;
  const drop = ratio != null && ratio < 1 ? Math.round((1 - ratio) * 100) : 0;

  if (status.phase === "lean") {
    return (
      <Badge
        className="bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300"
        title={`Paycheck income only. Based on ${status.periodsUsed} logged cutoffs. Ratio vs median: ${Math.round((ratio ?? 0) * 100)}%.`}
      >
        Lean cutoff · <CurrencyDisplay amount={targetIncome} /> vs typical{" "}
        <CurrencyDisplay amount={Math.round(median)} /> (−{drop}%)
      </Badge>
    );
  }

  return (
    <Badge
      variant="income"
      title={`Paycheck income only. Based on ${status.periodsUsed} logged cutoffs.`}
    >
      On track · <CurrencyDisplay amount={targetIncome} /> vs typical{" "}
      <CurrencyDisplay amount={Math.round(median)} />
    </Badge>
  );
}
