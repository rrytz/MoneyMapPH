import type { BillsDueBy, Debt, DebtPayment } from "@/lib/types";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { debtPaidOffAmount, debtRemaining, isDebtPaidOff, isDebtOverdue } from "@/lib/utils/debt";
import { formatDate } from "@/lib/utils/date";
import { ReceiptText, HandCoins, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The card is a dashboard block, so it is capped rather than unbounded - an
 * uncapped list would make the page arbitrarily tall and undo the fold budget
 * the composition pass established.
 *
 * The cap used to be silent, which made the header a lying number: it said
 * "Due through {horizon}" and totalled EVERY item in the window while the list
 * showed six of them, with nothing saying anything was hidden. The totals are
 * true facts about the window, so they stay; what was untrue was the implication
 * that the six rows were all of them. So the header now states how many it is
 * showing, and the omission is disclosed at the point of the claim rather than
 * left for the reader to infer from arithmetic that does not add up.
 *
 * Disclosing rather than removing the cap, because that stays correct whether
 * or not a dedicated timeline screen ever lands. Removing the cap would fix this
 * card and be undone by the screen; and if the screen arrives, this card still
 * has to be honest on its own.
 */
const UPCOMING_LIMIT = 6;

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

  const allItems = [...billItems, ...debtItems].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate)
  );
  const items = allItems.slice(0, UPCOMING_LIMIT);
  const hiddenCount = allItems.length - items.length;

  const billTotal = billItems.reduce((sum, item) => sum + item.amount, 0);
  const debtTotal = debtItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <FintechCard className="flex flex-col">
      <FintechCardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <FintechCardTitle>Upcoming Bills &amp; Debt Payments</FintechCardTitle>
          <p className="text-xs text-muted-foreground">
            Due through {formatDate(billsDueBy.horizonDate, "MMM d")}
            {hiddenCount > 0 && (
              <>
                {" · showing "}
                <span className="font-semibold text-foreground">
                  {items.length} of {allItems.length}
                </span>
              </>
            )}
            {" · "}
            <CurrencyDisplay amount={billTotal} className="figure-inline" /> bills + <CurrencyDisplay amount={debtTotal} className="figure-inline" /> debts
          </p>
        </div>
        <Link
          href="/income"
          className="text-xs font-semibold text-sulpot-deep dark:text-sulpot-bright hover:underline flex items-center gap-1"
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
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/70 hover:border-sulpot/30 transition-colors"
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