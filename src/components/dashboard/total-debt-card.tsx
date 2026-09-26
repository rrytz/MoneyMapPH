import type { Debt, DebtPayment } from "@/lib/types";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { debtPaidOffAmount, debtRemaining, isDebtPaidOff, isDebtOverdue } from "@/lib/utils/debt";
import { formatDate } from "@/lib/utils/date";
import { BadgeDollarSign, ArrowRight, CalendarClock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface TotalDebtCardProps {
  debts: Debt[];
  payments: DebtPayment[];
  todayIso: string;
}

export function TotalDebtCard({ debts, payments, todayIso }: TotalDebtCardProps) {
  const rows = debts.map((debt) => {
    const paid = debtPaidOffAmount(payments.filter((p) => p.debt_id === debt.id));
    const remaining = debtRemaining(debt, paid);
    const paidOff = isDebtPaidOff(debt, paid);
    const overdue = !paidOff && isDebtOverdue(debt, paid, todayIso);
    return { debt, remaining, paidOff, overdue };
  });

  const totalRemaining = rows.reduce((sum, r) => sum + r.remaining, 0);
  const outstanding = rows.filter((r) => !r.paidOff).sort((a, b) => b.remaining - a.remaining);
  const overdueCount = rows.filter((r) => r.overdue).length;
  const top = outstanding.slice(0, 3);

  return (
    <FintechCard className="flex flex-col">
      <FintechCardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <FintechCardTitle>Total Debt</FintechCardTitle>
          <p className="text-xs text-muted-foreground">
            {outstanding.length} outstanding · {overdueCount > 0 ? `${overdueCount} overdue` : "nothing overdue"}
          </p>
        </div>
        <Link
          href="/savings"
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
        >
          Track <ArrowRight className="h-3 w-3" />
        </Link>
      </FintechCardHeader>

      <FintechCardContent className="flex-1 flex flex-col gap-4">
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-950 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Remaining balance</p>
            <div className="tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
              <CurrencyDisplay amount={totalRemaining} className="type-ledger" />
            </div>
          </div>
          <div className="p-2.5 rounded-md bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
            <BadgeDollarSign className="h-5 w-5" />
          </div>
        </div>

        {outstanding.length === 0 ? (
          <div className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border/70">
            <div className="p-2 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <BadgeDollarSign className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Debt-free</h4>
              <p className="text-[11px] text-muted-foreground">
                {debts.length === 0 ? "Add debts on the Savings page to track payoff progress." : "All tracked debts are fully paid off."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {top.map(({ debt, remaining, overdue }) => (
              <div
                key={debt.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border/70 hover:border-rose-200 transition-colors"
              >
                <div
                  className={cn(
                    "p-2 rounded-md shrink-0",
                    overdue
                      ? "bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  {overdue ? <CalendarClock className="h-3.5 w-3.5" /> : <BadgeDollarSign className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{debt.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {overdue ? "Overdue · due " : "Due "}
                    {formatDate(debt.due_date, "MMM d")}
                  </p>
                </div>
                <div className="text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  <CurrencyDisplay amount={remaining} className="figure-inline" />
                </div>
              </div>
            ))}
            {outstanding.length > 3 && (
              <p className="text-[11px] text-muted-foreground text-center pt-0.5">
                +{outstanding.length - 3} more · <Link href="/savings" className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold">view all</Link>
              </p>
            )}
          </div>
        )}
      </FintechCardContent>
    </FintechCard>
  );
}