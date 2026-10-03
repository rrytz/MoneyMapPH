"use client";

import { ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { classifySummaryVerdict } from "@/lib/utils/bills-summary";
import type { SummaryVerdict } from "@/lib/types";

const VERDICT: Record<
  SummaryVerdict,
  { label: string; variant: "income" | "warning" | "expense"; color: string }
> = {
  covered: {
    label: "Covered",
    variant: "income",
    color: "text-sulpot-deep dark:text-sulpot-bright",
  },
  tight: {
    label: "Tight this cutoff",
    variant: "warning",
    color: "text-amber-500",
  },
  short: {
    label: "Short this cutoff",
    variant: "expense",
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
      <FintechCardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-ink-faint" />
              Bills before next paycheck
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Due through {formatDate(horizonDate, "MMM d")} · paid {formatDate(payoutDate, "MMM d")}
            </p>
          </div>
          <Badge
            variant={v.variant}
            className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5"
          >
            {v.label}
          </Badge>
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