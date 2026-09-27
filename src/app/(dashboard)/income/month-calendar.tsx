"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { buildCalendarCells } from "@/lib/utils/calendar-cells";
import { isOneTimeBill, visibleCalendarOccurrences } from "@/lib/utils/bills";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { PayBillForm } from "./pay-bill-form";
import type { Bill, BillOccurrence, BillPayment, ExpenseCategory } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarOccurrence = BillOccurrence & { paid: boolean; overdue: boolean };

export function MonthCalendar({
  bills,
  occurrences,
  payments,
  categories,
  month,
  year,
}: {
  bills: Bill[];
  occurrences: BillOccurrence[];
  payments: BillPayment[];
  categories: ExpenseCategory[];
  month: number;
  year: number;
}) {
  const [viewMonth, setViewMonth] = useState(month - 1); // 0-based
  const [viewYear, setViewYear] = useState(year);
  const [payTarget, setPayTarget] = useState<{ occurrence: CalendarOccurrence; paidPaymentId?: string } | null>(null);

  const todayISO = formatDate(new Date(), "yyyy-MM-dd");

  // Which bills are one-time, resolved ONCE from the same predicate that styles
  // the chip below. Driving the filter and the visual from one predicate is the
  // point: a chip that says "one-time" and a rule that hides it are the same
  // fact, and if they ever disagree the surface is lying in one direction.
  const oneTimeIds = new Set(bills.filter(isOneTimeBill).map((b) => b.id));
  const paidKeys = new Set(payments.map((p) => `${p.bill_id}|${p.due_date}`));

  // A PAID one-time bill leaves the calendar, and a paid recurring bill keeps
  // its tick. The rule and its two directions live in visibleCalendarOccurrences
  // so they can be pinned in tests; the payment record survives in the Paid
  // list either way.
  const visibleOccurrences = visibleCalendarOccurrences(occurrences, oneTimeIds, paidKeys);

  const cells = buildCalendarCells(viewYear, viewMonth, visibleOccurrences, payments, todayISO);

  const openPayForm = (occ: CalendarOccurrence) => {
    const found = occ.paid
      ? payments.find((p) => p.bill_id === occ.bill_id && p.due_date === occ.dueDate)
      : undefined;
    setPayTarget({ occurrence: occ, paidPaymentId: occ.paid ? found?.id : undefined });
  };

  const shift = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <FintechCard>
      <FintechCardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-ink-faint" /> Bills calendar
          </h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium capitalize">{formatDate(new Date(viewYear, viewMonth, 1), "MMMM yyyy")}</span>
            <Button variant="ghost" size="sm" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => (
            <div
              key={cell.date}
              className={cn(
                "min-h-16 rounded-lg border p-1.5 text-xs",
                cell.isInMonth ? "bg-muted/30" : "bg-transparent opacity-40",
                cell.isToday && "ring-2 ring-sulpot/60"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="type-measurement text-[10px] font-medium">{Number(cell.date.slice(8, 10))}</span>
                {cell.isCutoffAnchor && <span className="h-1 w-1 rounded-full bg-sulpot" title="Cutoff anchor" />}
              </div>
              <div className="space-y-1 mt-1">
                {cell.occurrences.slice(0, 3).map((occ) => {
                  const oneTime = oneTimeIds.has(occ.bill_id);
                  return (
                    <button
                      key={`${occ.bill_id}-${occ.dueDate}`}
                      type="button"
                      onClick={() => openPayForm(occ)}
                      title={oneTime ? `${occ.billName} - one-time` : occ.billName}
                      className={cn(
                        "flex w-full items-center justify-between rounded px-1 py-0.5 text-left text-[10px] leading-tight",
                        // A one-time bill is outlined and dashed rather than
                        // filled, so recurrence is visible at a glance: a chip
                        // that reappears every month is one thing, and a chip
                        // that will not come back is another. Same decision as
                        // the One-time badge in the list - outline means "this
                        // happens once".
                        oneTime && "border border-dashed border-sulpot/50 bg-transparent",
                        !oneTime && (occ.paid
                          ? "bg-sulpot-tint text-sulpot-deep dark:text-sulpot-bright dark:bg-sulpot-tint dark:text-sulpot-bright opacity-70"
                          : occ.overdue
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                            : "bg-muted text-muted-foreground")
                      )}
                    >
                      <span className="truncate">{occ.billName}</span>
                      <span className="tabular-nums font-semibold">{occ.paid ? "✓" : <CurrencyDisplay amount={occ.expectedAmount} className="type-ledger inline text-[10px]" />}</span>
                    </button>
                  );
                })}
                {cell.occurrences.length > 3 && (
                  // The cell is capped at three so a busy day cannot blow out
                  // the row height. It now SAYS so. A silent truncation is the
                  // same defect as the dashboard card's ".slice(0, 6)": the
                  // surface looks complete and is not. This is disclosure, not
                  // a control - it does not expand, exactly as the card's
                  // "showing 6 of N" does not.
                  <div className="px-1 text-[10px] leading-tight text-muted-foreground">
                    +{cell.occurrences.length - 3} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {payTarget &&
          createPortal(
            <PayBillForm
              key={`${payTarget.occurrence.bill_id}-${payTarget.occurrence.dueDate}`}
              open
              onClose={() => setPayTarget(null)}
              occurrence={payTarget.occurrence}
              paidPaymentId={payTarget.paidPaymentId}
              categoryId={bills.find((b) => b.id === payTarget.occurrence.bill_id)?.category_id ?? null}
              categories={categories}
            />,
            document.body
          )}
      </FintechCardContent>
    </FintechCard>
  );
}