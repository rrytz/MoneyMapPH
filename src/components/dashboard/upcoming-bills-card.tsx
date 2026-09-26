import type { BillsDueBy, Debt, DebtPayment } from "@/lib/types";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { debtPaidOffAmount, debtRemaining, isDebtPaidOff, isDebtOverdue } from "@/lib/utils/debt";
import { formatDate } from "@/lib/utils/date";
import { ReceiptText, HandCoins, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface UpcomingBillsCardProps {
  billsDueBy: BillsDueBy;
  debts: Debt[];
  payments: DebtPayment[];
  todayIso: string;
}

type UpcomingItem = {
  key: string;
  kind: "bill" | "debt";
  name: string;
  dueDate: string;
  amount: number;
  overdue: boolean;
};

export function UpcomingBillsCard({ billsDueBy, debts, payments, todayIso }: UpcomingBillsCardProps) {
  const billItems: UpcomingItem[] = billsDueBy.occurrences.map((o) => ({
    key: `bill-${o.bill_id}-${o.dueDate}`,
    kind: "bill",
    name: o.billName,
    dueDate: o.dueDate,
    amount: o.expectedAmount,
    overdue: o.dueDate < todayIso,
  }));

  const debtItems: UpcomingItem[] = debts
    .map((debt) => {
      const paid = debtPaidOffAmount(payments.filter((p) => p.debt_id === debt.id));
      return {
        debt,
        paid,
        remaining: debtRemaining(debt, paid),
        paidOff: isDebtPaidOff(debt, paid),
      };
    })
    .filter((r) => !r.paidOff && r.debt.due_date >= todayIso)
    .map((r) => ({
      key: `debt-${r.debt.id}`,
      kind: "debt",
      name: r.debt.name,
      dueDate: r.debt.due_date,
      amount: r.remaining,
      overdue: isDebtOverdue(r.debt, r.paid, todayIso),
    }));

  const items = [...billItems, ...debtItems]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);

  const billTotal = billItems.reduce((sum, item) => sum + item.amount, 0);
  const debtTotal = debtItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <FintechCard className="flex flex-col">
      <FintechCardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <FintechCardTitle>Upcoming Bills &amp; Debt Payments</FintechCardTitle>
          <p className="text-xs text-muted-foreground">
            Due through {formatDate(billsDueBy.horizonDate, "MMM d")} ·{" "}
            <CurrencyDisplay amount={billTotal} className="figure-inline" /> bills + <CurrencyDisplay amount={debtTotal} className="figure-inline" /> debts
          </p>
        </div>
        <Link
          href="/income"
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
        >
          Plan <ArrowRight className="h-3 w-3" />
        </Link>
      </FintechCardHeader>

      <FintechCardContent className="flex-1">
        {items.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-6 w-6" />}
            title="Nothing due"
            description="No bills or debt payments are due in the coming pay window."
          />
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              return (
                <div
                  key={item.key}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border/70 hover:border-emerald-200 transition-colors"
                >
                  <div
                    className={cn(
                      "p-2 rounded-md shrink-0",
                      item.kind === "debt"
                        ? "bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.kind === "debt" ? <HandCoins className="h-3.5 w-3.5" /> : <ReceiptText className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                    <p className={cn("text-[11px]", item.overdue ? "text-rose-500 font-semibold" : "text-muted-foreground")}>
                      {item.overdue ? "Overdue · " : "Due "}
                      {formatDate(item.dueDate, "MMM d")}
                      {item.kind === "debt" ? " · debt payment" : " · bill"}
                    </p>
                  </div>
                  <div className="text-xs font-bold tabular-nums text-foreground">
                    <CurrencyDisplay amount={item.amount} className="figure-inline" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </FintechCardContent>
    </FintechCard>
  );
}