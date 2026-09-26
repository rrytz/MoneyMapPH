"use client";

import { ReceiptText } from "lucide-react";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { classifySummaryVerdict } from "@/lib/utils/bills-summary";
import type { SummaryVerdict } from "@/lib/types";

const VERDICT: Record<
  SummaryVerdict,
  { label: string; pill: string; color: string }
> = {
  covered: {
    label: "Covered",
    pill: "text-sulpot-deep dark:text-sulpot-bright bg-sulpot-tint dark:bg-sulpot-tint dark:text-sulpot-bright border-sulpot/30",
    color: "text-sulpot-deep dark:text-sulpot-bright",
  },
  tight: {
    label: "Tight this cutoff",
    pill: "text-amber-700 bg-muted/60 dark:text-amber-400 border-amber-200/50",
    color: "text-amber-500",
  },
  short: {
    label: "Short this cutoff",
    pill: "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/50",
    color: "text-rose-500",
  },
};

export function BillsSummaryCard({
  paidTotal,
  upcomingTotal,
  totalDue,
  horizonDate,
  payoutDate,
  safeToSpend,
}: {
  paidTotal: number;
  upcomingTotal: number;
  totalDue: number;
  horizonDate: string;
  payoutDate: string;
  safeToSpend: number;
}) {
  const verdict = classifySummaryVerdict(upcomingTotal, safeToSpend);
  const v = VERDICT[verdict];

  return (
    <FintechCard>
      <FintechCardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-slate-400" />
              Bills before next paycheck
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Due through {formatDate(horizonDate, "MMM d")} · paid {formatDate(payoutDate, "MMM d")}
            </p>
          </div>
          <span className={cn("text-[11px] font-semibold px-2.5 py-0.5 rounded-full border", v.pill)}>
            {v.label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Paid this cutoff</p>
            <CurrencyDisplay amount={paidTotal} className={cn("type-ledger", cn("text-sm font-semibold"))} />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Upcoming</p>
            <CurrencyDisplay amount={upcomingTotal} className={cn("type-ledger", cn("text-sm font-semibold", v.color))} />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Total</p>
            <CurrencyDisplay amount={totalDue} className="type-ledger text-sm font-semibold" />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {upcomingTotal > safeToSpend
            ? `Upcoming bills exceed what's left this cutoff.`
            : `What's left this cutoff (${formatDate(payoutDate, "MMM d")}) covers your upcoming bills.`}
        </p>
      </FintechCardContent>
    </FintechCard>
  );
}