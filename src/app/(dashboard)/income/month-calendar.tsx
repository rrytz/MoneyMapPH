"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { endOfMonth, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { buildCalendarCells } from "@/lib/utils/calendar-cells";
import { getBillDueDate, isOneTimeBill, listBillOccurrences, visibleCalendarOccurrences } from "@/lib/utils/bills";
import { billDraftForDate, type BillDraft } from "@/lib/utils/bill-draft";
import { formatDate, toISODateString } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PayBillForm } from "./pay-bill-form";
import { BillForm } from "./bill-form";
import { createBillAction } from "./bills/actions";
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
  // The date whose Sheet is open, and the draft it opened with. The draft is
  // BUILT by billDraftForDate, which sets the date and the toggle together, so
  // there is no path that opens a dated form with "repeats monthly" still on.
  const [addTarget, setAddTarget] = useState<{ date: string; draft: BillDraft } | null>(null);
  const [addDraft, setAddDraft] = useState<BillDraft | null>(null);
  // Roving tabindex: exactly one day is in the tab order, so Tab crosses the
  // calendar once instead of stopping 31 times. Which one is remembered across
  // month changes, so arrowing to the 20th and paging to October keeps you on
  // the 20th rather than jumping back to day 1.
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const dayRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const todayISO = formatDate(new Date(), "yyyy-MM-dd");

  // Which occurrences are PAID, for the "has this occurrence been settled"
  // question. Whether an occurrence is one-time is NOT resolved here - it
  // arrives on the occurrence itself, computed once where the occurrence is
  // built. The calendar used to derive its own set of one-time bill ids for the
  // filter and use the same predicate for the chip; both now read one field, so
  // they cannot disagree.
  const paidKeys = new Set(payments.map((p) => `${p.bill_id}|${p.due_date}`));

  // OCCURRENCES FOR THE MONTH BEING VIEWED, not the month the page was served.
  //
  // `occurrences` arrives as a server prop fetched by getBillView for the
  // page's INITIAL month, and nothing refetched it when viewMonth changed. So
  // the header and the grid moved but the data did not: October showed
  // September's grid with September's bills, and November and December showed
  // nothing at all. That last part is what identifies the cause - a month-index
  // bug would have shifted the data, so November would have carried October's
  // bills. Empty is not shifted.
  //
  // bills and payments are both unscoped (every bill, every payment, all time),
  // and listBillOccurrences is the same pure function the server used, so the
  // viewed month is derived here with no refetch and no duplicated logic. The
  // prop is now unused by this component.
  const monthOccurrences = useMemo(() => {
    const from = startOfMonth(new Date(viewYear, viewMonth, 1));
    const to = endOfMonth(new Date(viewYear, viewMonth, 1));
    return listBillOccurrences(bills, from, to);
  }, [bills, viewYear, viewMonth]);

  // A PAID one-time bill leaves the calendar, and a paid recurring bill keeps
  // its tick. The rule and its two directions live in visibleCalendarOccurrences
  // so they can be pinned in tests; the payment record survives in the Paid
  // list either way.
  const visibleOccurrences = visibleCalendarOccurrences(monthOccurrences, paidKeys);

  const cells = buildCalendarCells(viewYear, viewMonth, visibleOccurrences, payments, todayISO);

  // The one cell in the tab order. Prefers the day already chosen, then today
  // if it is on screen, then the first of the month. A grid that is never
  // tabbable at all is worse than one with a single sensible entry point.
  const tabbableDate = (() => {
    if (activeDate && cells.some((c) => c.date === activeDate)) return activeDate;
    if (cells.some((c) => c.date === todayISO)) return todayISO;
    return cells.find((c) => c.isInMonth)?.date ?? cells[0]?.date ?? null;
  })();

  const focusDay = (iso: string) => {
    setActiveDate(iso);
    dayRefs.current.get(iso)?.focus();
  };

  /**
   * Spatial navigation. The MECHANISM is the roving tabindex already proven in
   * filter-pills, but the CONTRACT is different and deliberately so: pills move
   * linearly left-to-right, a calendar moves in two dimensions, and every
   * platform's date picker agrees on what the arrow keys mean.
   *
   *   Left/Right  +/- 1 day      Up/Down  +/- 1 week
   *   Home/End    start/end of the containing WEEK, not the month
   *
   * Home/End being week bounds rather than month bounds is the detail that
   * makes this a calendar instead of a list with dates on it. Movement clamps
   * at the grid edges rather than wrapping, so arrowing past the 1st does not
   * teleport you to the 31st of the previous month.
   */
  const onDayKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, iso: string) => {
    const idx = cells.findIndex((c) => c.date === iso);
    if (idx < 0) return;
    // Same Monday-start arithmetic buildCalendarCells uses to pad the grid, so
    // "start of this week" lands on the same column the header calls Monday.
    const mondayOffset = (new Date(`${iso}T00:00:00`).getDay() + 6) % 7;
    const weekStart = idx - mondayOffset;
    const weekEnd = Math.min(cells.length - 1, weekStart + 6);

    let next: number | null = null;
    switch (e.key) {
      case "ArrowLeft": next = idx - 1; break;
      case "ArrowRight": next = idx + 1; break;
      case "ArrowUp": next = idx - 7; break;
      case "ArrowDown": next = idx + 7; break;
      case "Home": next = weekStart; break;
      case "End": next = weekEnd; break;
      default: return;
    }
    if (next === null) return;
    e.preventDefault();
    if (next < 0 || next >= cells.length) return; // clamp, do not wrap
    focusDay(cells[next].date);
  };

  /**
   * Close the Sheet and put the user back where they were.
   *
   * ONE close path, deliberately. It was originally written into onOpenChange
   * only, and the save handler set the state to null itself - so saving dropped
   * focus on <body> and left the user stranded at the top of a 31-cell grid,
   * with the keyboard navigation they had just been using now unreachable.
   * Three exits (backdrop, Escape, save) all go through here instead.
   */
  const closeAddSheet = () => {
    const back = addTarget?.date ?? null;
    setAddTarget(null);
    setAddDraft(null);
    if (back) {
      // After the dialog has actually unmounted, or the element is still
      // inside an inert subtree and focus() is a no-op.
      requestAnimationFrame(() => focusDayOrFallback(back));
    }
  };

  /**
   * Focus the day we came from - or, if the view moved while the sheet was
   * open, the best cell that still exists.
   *
   * Opening a padding day navigates to that day's month, so the cell that
   * opened the sheet may not exist in the grid we return to: August 31 is a
   * leading cell in September, but October's grid starts September 28 and has
   * no August 31 at all. Without a fallback, focus would land on <body> and
   * the grid would be unreachable again.
   */
  const focusDayOrFallback = (iso: string) => {
    const exact = dayRefs.current.get(iso);
    if (exact) {
      exact.focus();
      return;
    }
    const dayOfMonth = new Date(`${iso}T00:00:00`).getDate();
    // getBillDueDate clamps, so a 31st lands on the 30th in a short month
    // instead of rolling into the next one.
    const sameDay = toISODateString(getBillDueDate(dayOfMonth, viewYear, viewMonth));
    const clamped = dayRefs.current.get(sameDay);
    if (clamped) {
      setActiveDate(sameDay);
      clamped.focus();
      return;
    }
    const first = cells.find((c) => c.isInMonth)?.date;
    if (first) {
      setActiveDate(first);
      dayRefs.current.get(first)?.focus();
    }
  };

  /**
   * Activate a day: show the month that day belongs to, and open the form for
   * it.
   *
   * A padding day is a REAL date that this month does not display, and every
   * month grid treats it as such - Google and Apple both move the view to that
   * month when you click one. Creating the bill without moving would leave the
   * calendar pointing at a different month than the bill the user just made,
   * and the dimmed cell implies "a day in THIS month" while meaning another.
   *
   * Doing both - navigate AND open - means the user gets the bill they came for
   * and ends up looking at the month it lives in, so the result is visible in
   * context rather than one navigation away.
   */
  const openAddSheet = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear) {
      setViewMonth(d.getMonth());
      setViewYear(d.getFullYear());
    }
    // One line, and it is the whole contract: the date and the toggle move
    // together. A separate setDraft({due_date}) here is the silent-loss bug.
    const draft = billDraftForDate(iso);
    setAddDraft(draft);
    setAddTarget({ date: iso, draft });
    setActiveDate(iso);
  };

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

        {/* role="grid", not a radiogroup. A calendar is two-dimensional and the
            arrow keys mean day and week, so the grid pattern is the honest
            description. The roving tabindex below is the same MECHANISM as
            filter-pills; only the contract differs. */}
        <div role="grid" aria-label="Bills calendar" className="grid grid-cols-7 gap-1">
          {cells.map((cell) => (
            <div
              key={cell.date}
              role="gridcell"
              aria-label={formatDate(new Date(`${cell.date}T00:00:00`), "MMMM d, yyyy")}
              className={cn(
                "relative min-h-16 rounded-lg border p-1.5 text-xs",
                cell.isInMonth ? "bg-muted/30" : "bg-transparent opacity-40",
                cell.isToday && "ring-2 ring-sulpot/60"
              )}
            >
              {/* ONE button, sized to the cell it represents.

                  The button used to wrap the day number and be sized to it, so
                  the hit area was the digits while the affordance - border,
                  padding, hover - was the whole cell. Clicking the empty part of
                  a day did nothing, which is the surface saying one thing and
                  the behaviour saying another.

                  It cannot simply become the cell's content, because the cell
                  also holds the occurrence chips and a <button> may not contain
                  another <button>. So the button is absolutely positioned over
                  the cell instead: still ONE element, still ONE action, and the
                  focus ring now traces the cell rather than the digits, which
                  is the right shape for a target this size. */}
              <button
                type="button"
                ref={(el) => {
                  if (el) dayRefs.current.set(cell.date, el);
                  else dayRefs.current.delete(cell.date);
                }}
                tabIndex={cell.date === tabbableDate ? 0 : -1}
                onKeyDown={(e) => onDayKeyDown(e, cell.date)}
                onClick={() => openAddSheet(cell.date)}
                aria-haspopup="dialog"
                // A button's accessible name comes from its own content, and its
                // content is the day number. "22" is a poor name: it does not
                // say which month, and it does not say what pressing it does.
                // The gridcell's label does not cover this, because the cell is
                // not the thing you activate.
                aria-label={`${formatDate(new Date(`${cell.date}T00:00:00`), "MMMM d, yyyy")} — add a bill`}
                className="absolute -inset-px z-0 flex items-start rounded-lg p-1.5 text-left hover:bg-sulpot/5 focus-visible:ring-2 focus-visible:ring-sulpot/60 focus-visible:outline-none"
              >
                <span className="type-measurement px-0.5 text-[10px] font-medium">
                  {Number(cell.date.slice(8, 10))}
                </span>
              </button>
              {cell.isCutoffAnchor && (
                <span
                  className="pointer-events-none absolute right-2 top-2 z-10 h-1 w-1 rounded-full bg-sulpot"
                  title="Cutoff anchor"
                />
              )}
              {/* The chips sit ABOVE the day button so they stay clickable, and
                  this wrapper is pointer-events-none so the gaps BETWEEN chips
                  fall through to the day button underneath. Without that, the
                  wrapper's own box would swallow every empty click in the cell
                  and the bug would survive the fix. Each chip turns pointer
                  events back on for itself. */}
              <div className="pointer-events-none relative z-10 space-y-1 pt-3.5">
                {cell.occurrences.slice(0, 3).map((occ) => {
                  // The same field the filter above reads, so a chip cannot say
                  // "one-time" while the rule that removes paid ones disagrees.
                  const oneTime = occ.oneTime;
                  return (
                    <button
                      key={`${occ.bill_id}-${occ.dueDate}`}
                      type="button"
                      onClick={() => openPayForm(occ)}
                      title={oneTime ? `${occ.billName} - one-time` : occ.billName}
                      className={cn(
                        "pointer-events-auto flex w-full items-center justify-between rounded px-1 py-0.5 text-left text-[10px] leading-tight",
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

        {/* The Sheet is the ONE creation surface for a dated bill, and it is
            rendered through a portal so it is not clipped by the card. Clicking
            a day is the trigger; the date it opens with comes from
            billDraftForDate, which set the date and the toggle together. */}
        {addTarget && addDraft && (
          <Sheet open onOpenChange={(open) => { if (!open) closeAddSheet(); }}>
            <SheetContent side="right" className="sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>New bill</SheetTitle>
                <SheetDescription>
                  One-time, due {formatDate(new Date(`${addTarget.date}T00:00:00`), "MMMM d, yyyy")}.
                  Switch to &ldquo;repeats monthly&rdquo; to make it recurring instead.
                </SheetDescription>
              </SheetHeader>
              <BillForm
                draft={addDraft}
                onChange={setAddDraft}
                categories={categories}
                submitLabel="Save bill"
                autoFocusName
                onCancel={closeAddSheet}
                onSubmit={async (values) => {
                  const res = await createBillAction({
                    name: values.name,
                    expected_amount: values.expected_amount,
                    category_id: values.category_id,
                    day_of_month: values.day_of_month,
                    due_date: values.due_date,
                  });
                  if (res.error) return toast.error(res.error);
                  toast.success("Bill added");
                  closeAddSheet();
                }}
              />
            </SheetContent>
          </Sheet>
        )}

        {/* No createPortal and no `open` prop: PayBillForm is the shared Dialog
            primitive now, which portals itself. The key still resets its amount
            and date per occurrence, which is why it is here and not inside
            BillForm's world. */}
        {payTarget && (
          <PayBillForm
            key={`${payTarget.occurrence.bill_id}-${payTarget.occurrence.dueDate}`}
            onClose={() => setPayTarget(null)}
            occurrence={payTarget.occurrence}
            paidPaymentId={payTarget.paidPaymentId}
            categoryId={bills.find((b) => b.id === payTarget.occurrence.bill_id)?.category_id ?? null}
            categories={categories}
          />
        )}
      </FintechCardContent>
    </FintechCard>
  );
}