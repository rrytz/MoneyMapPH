"use client";

import { useState, useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Copy, PieChart, Wallet, Target, TrendingDown, Calculator } from "lucide-react";
import { CategoryIcon } from "@/components/shared/category-icon";
import { resolveCategoryColor } from "@/lib/categories/color-map";
import { Button, buttonVariants } from "@/components/ui/button";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthYearPicker } from "@/components/shared/month-year-picker";
import { BudgetForm } from "@/components/forms/budget-form";
import { BudgetExpenseForm } from "./budget-expense-form";
import { copyPreviousMonthBudget } from "./actions";
import { addExpense } from "../expenses/actions";
import { getCurrentMonthYear, getMonthName, toISODateString } from "@/lib/utils/date";
import { computeBudgetStatus } from "@/lib/utils/budget-status";
import { computeUnbudgetedSpent, computeRemainingBudget, buildUnbudgetedCategoryViews } from "@/lib/services/expense-aggregation.service";
import { toast } from "sonner";
import type { BudgetStatus, ExpenseCategory, MonthlyExpenseAggregation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { gridTracksFor, gridTracksClass } from "@/lib/utils/grid-tracks";

interface BudgetsPageClientProps {
  statuses: BudgetStatus[];
  categories: ExpenseCategory[];
  aggregation: MonthlyExpenseAggregation;
  currentMonth: number;
  currentYear: number;
}

export function BudgetsPageClient({
  statuses,
  categories,
  aggregation,
  currentMonth: initialMonth,
  currentYear: initialYear,
}: BudgetsPageClientProps) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [formOpen, setFormOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [expenseForm, setExpenseForm] = useState<BudgetStatus | null>(null);
  const [, startTransition] = useTransition();
  // Separate from the server-action transition above, so saving a budget does
  // not dim the page. This one is only for the month navigation.
  const [isMonthPending, startMonthTransition] = useTransition();
  const router = useRouter();

  const { month: realMonth, year: realYear } = getCurrentMonthYear();
  const isCurrentMonth = month === realMonth && year === realYear;
  const viewedMonthLabel = `${getMonthName(month)} ${year}`;
  const defaultExpenseDate = isCurrentMonth
    ? toISODateString(new Date())
    : `${year}-${String(month).padStart(2, "0")}-01`;

  const [optimisticStatuses, addSpend] = useOptimistic(
    statuses,
    (state: BudgetStatus[], op: { categoryId: string; amount: number }) =>
      state.map((s) => {
        if (s.categoryId !== op.categoryId) return s;
        const { percentage, status } = computeBudgetStatus(s.budgeted, s.spent + op.amount);
        return {
          ...s,
          spent: s.spent + op.amount,
          remaining: s.budgeted - (s.spent + op.amount),
          percentage,
          status,
        };
      })
  );

  const budgetTracks = gridTracksFor(optimisticStatuses.length, 2);
 const budgetTracksClass = gridTracksClass(budgetTracks);

 // The mobile cap, and why the list is CAPPED rather than merely compressed.
 //
 // This grid had no ceiling. Below `sm` it is one column, so every budget track
 // was a full-width card and the page grew linearly with the number of
 // categories the user happened to have: 7 tracks = 4.58 folds at 375, 15
 // tracks = about 7. Unlike the dashboard, which was a fixed composition that
 // was too tall, this was a list with no ceiling - so adding a category made
 // the screen worse for everyone, and nothing on it was truncated, so nothing
 // on it was disclosed either.
 //
 // The cap is per-breakpoint and the disclosure is per-breakpoint with it: at
 // `sm` and above every track is shown and no disclosure renders at all, so
 // the count can never describe a state the reader is not in. "Showing 4 of 7"
 // on a phone and no line at all on a desk are the same fact, told honestly at
 // each size.
 const MOBILE_TRACK_CAP = 4;
 const [showAllTracks, setShowAllTracks] = useState(false);
 const hiddenTrackCount = Math.max(0, optimisticStatuses.length - MOBILE_TRACK_CAP);
  const totalBudgeted = optimisticStatuses.reduce((sum, s) => sum + s.budgeted, 0);
  const totalBudgetedSpent = optimisticStatuses.reduce((sum, s) => sum + s.spent, 0);
  const [actualTotal, setActualTotal] = useState(aggregation.totalExpenses);
  const [prevTotalExpenses, setPrevTotalExpenses] = useState(aggregation.totalExpenses);
  if (prevTotalExpenses !== aggregation.totalExpenses) {
    setPrevTotalExpenses(aggregation.totalExpenses);
    setActualTotal(aggregation.totalExpenses);
  }

  const budgetedCategoryIds = statuses.map((s) => s.categoryId);
  const unbudgetedViews = buildUnbudgetedCategoryViews(aggregation.byCategory, budgetedCategoryIds, categories);

  const totalUnbudgetedSpent = computeUnbudgetedSpent(actualTotal, totalBudgetedSpent);
  const totalRemaining = computeRemainingBudget(totalBudgeted, totalBudgetedSpent);

  function handleAddExpense(data: { title: string; amount: number; category_id: string; date: string; notes?: string }) {
    startTransition(async () => {
      addSpend({ categoryId: data.category_id, amount: data.amount });
      setActualTotal((v) => v + data.amount);
      try {
        const result = await addExpense(data);
        if (result.error) {
          toast.error(result.error);
          setActualTotal((v) => v - data.amount);
        } else {
          toast.success("Expense added");
        }
      } catch {
        toast.error("Unable to add expense. Please try again.");
        setActualTotal((v) => v - data.amount);
      }
    });
    setExpenseForm(null);
  }

  async function handleCopy() {
    setCopying(true);
    const result = await copyPreviousMonthBudget(month, year);
    setCopying(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Copied budget from previous month");
    }
  }

  return (
    <div
      className={cn(
        "space-y-6 transition-opacity duration-150",
        isMonthPending && "opacity-55 pointer-events-none"
      )}
    >
      <PageHeader title="Budget Planner" description="Set and monitor category targets for variable and fixed expenses">
        <div className="flex flex-wrap items-center gap-3">
          <MonthYearPicker
            month={month}
            year={year}
            onChange={(m, y) => {
              setMonth(m);
              setYear(y);
              // A month change is a same-segment query navigation, so
              // loading.tsx never fires for it - the segment does not change.
              // The pending flag dims the stack instead. This is the third
              // screen to get the identical treatment, after /expenses and
              // /transactions; the dim is deliberately not a skeleton, because
              // the page is not going away.
              startMonthTransition(() => {
                router.replace(`/budgets?month=${m}&year=${y}`, { scroll: false });
              });
            }}
          />
          {statuses.length === 0 ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy} disabled={copying} className="rounded-xl border-border h-9 text-xs">
                <Copy className="mr-1.5 h-4 w-4" /> Copy Previous
              </Button>
              <Button onClick={() => setFormOpen(true)} className="rounded-xl bg-primary hover:bg-primary/80 text-white h-9 text-xs">
                <Plus className="mr-1.5 h-4 w-4" /> Create Budget
              </Button>
            </div>
          ) : (
            <Button onClick={() => setFormOpen(true)} className="rounded-xl bg-primary hover:bg-primary/80 text-white h-9 text-xs">
              <Plus className="mr-1.5 h-4 w-4" /> Edit Limits
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Spend vs allowance is the page's answer. The two figures share one
          surface; targeted and untargeted spending support that comparison
          instead of reading as four unrelated KPI cards. */}
      {statuses.length > 0 && (
        <FintechCard>
          <FintechCardContent className="p-0">
            <div className="grid sm:grid-cols-2">
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <div className="p-2.5 rounded-xl bg-sulpot-tint text-sulpot-deep dark:bg-sulpot-tint dark:text-sulpot-bright">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <Badge variant="income">Allowance</Badge>
                </div>
                <span className="mt-6 block text-xs font-medium text-muted-foreground">Total budgeted</span>
                <CurrencyDisplay
                  amount={totalBudgeted}
                  className="type-ledger text-4xl sm:text-5xl font-semibold tracking-tight text-foreground"
                />
              </div>
              <div className="border-t border-border p-6 sm:border-l sm:border-t-0 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <Badge variant="expense">Spent</Badge>
                </div>
                <span className="mt-6 block text-xs font-medium text-muted-foreground">Calendar month spending</span>
                <CurrencyDisplay
                  amount={actualTotal}
                  className="type-ledger text-4xl sm:text-5xl font-semibold tracking-tight text-foreground"
                />
              </div>
            </div>
          </FintechCardContent>
        </FintechCard>
      )}

      {/* Main Budget Grid */}
      {statuses.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No budget configured for this calendar month"
          description="Create spending targets for categories to keep your expenses on track."
          actionLabel="Create Monthly Budget"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <>
        {/* Budgeted and unbudgeted are a partition of one question - what is
            covered, and what is not - so they read as one row rather than two
            full-width bands separated by a page break, which made them look
            unrelated. The saving is the hole: 755 + 289 + a 32px top margin
            becomes one row.

            The split is asymmetric on purpose. An even 2 columns would give the
            budgeted group a 608px column, and because responsive breakpoints
            read the viewport rather than the container, its own 2-up grid
            inside would then halve every category card to ~290px. 1.6fr keeps
            them at ~360px, and stacks unbudgeted 1-up in the narrower column
            where two 220px cards would not have held a Set Limit button. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        {/* Count-aware tracks, which decline here and that is the point. Five
            budgeted categories in a two-up is three rows with one lone card in
            the last. Dropping to one track would fill every row but cost five
            rows instead of three, and a taller grid is worse than a hole. So
            this stays two-up and the lone card stays - the same content
            question the /accounts grid has to answer, decided the other way
            because the arithmetic differs. */}
        <div className={cn("grid grid-cols-1 gap-5", budgetTracksClass)}>
          {optimisticStatuses.map((status, trackIndex) => {
            const isOver = status.status === "over";
            const isNear = status.status === "near";
            const statusLabel = isOver ? "Over Budget" : isNear ? "Watch" : "On Track";
            const statusVariant = isOver ? "expense" : isNear ? "warning" : "income";

            return (
              <FintechCard
                key={status.categoryId}
                className={cn(
                  "space-y-4",
                  // Hidden on a phone past the cap, shown from `sm` up where the
                  // cap does not apply. CSS rather than a slice, so the reveal is
                  // instant and the desktop DOM is complete either way.
                  trackIndex >= MOBILE_TRACK_CAP && !showAllTracks && "hidden sm:block"
                )}
              >
                {/* No `p-6` here, and that is the whole padding fix.

                    `FintechCardContent` does not pad by default - it applies
                    `pt-0` on purpose, so a body can butt up against a
                    `FintechCardHeader` without a second padding band. This card
                    has NO header, so there was nothing to butt against and the
                    `p-6` was re-adding padding `FintechCard` had already
                    applied. Measured: the card was carrying 45px of its own
                    padding plus 45px of the content's, 90px of whitespace around
                    102px of content.

                    This is deliberately NOT fixed in the component. 16 call
                    sites pass `p-6` on the content, but 5 of the 8 files
                    involved have no header either - where `pt-0` is moot and
                    `p-6` is correct. Changing the component would fix this card
                    by breaking those. The defect is local to cards that re-pad
                    without a header to justify it, so the fix is local. */}
                <FintechCardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: `${resolveCategoryColor(status.categoryColor)}18`,
                          color: resolveCategoryColor(status.categoryColor),
                        }}
                      >
                        <CategoryIcon icon={status.categoryIcon} size="md" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">{status.categoryName}</h4>
                        {/* The percentage TEXT is gone, and it is the only thing
                            removed from this card.

                            The card stated one fact three times: the percentage
                            here, the bar's fill as the same percentage, and the
                            Spent/Target figures the bar also encodes. The bar and
                            the figures stay - they do different jobs, glanceable
                            versus precise. This is the one that overlapped both,
                            because a bar you can see and a number you can read are
                            the same datum in two registers.

                            Same class as the duplicate `totalLiquidity` stat card,
                            one level in: not two components rendering one value,
                            but one component rendering it twice. Dropping the
                            figure rather than the bar keeps the card a readout -
                            you can still judge "how much is this" at a glance. */}
                      </div>
                    </div>
                    <Badge variant={statusVariant} className="text-[10px] uppercase font-bold tracking-wider">
                      {statusLabel}
                    </Badge>
                  </div>

                  <Progress
                    value={Math.min(status.percentage, 100)}
                    className={cn(
                      "h-2 rounded-full",
                      isOver
                        ? "[&>div>div]:bg-rose-500"
                        : isNear
                          ? "[&>div>div]:bg-amber-500"
                          : "[&>div>div]:bg-sulpot"
                    )}
                  />

                  {/* `figure-inline`, not `type-ledger`. This is a two-figure
                      row inside a card that is one of several; at 2rem each
                      figure competes for attention the row doesn't need. The
                      unbudgeted card's identical row (below) already used
                      `figure-inline`, so this was the odd one out rather than
                      a deliberate difference. */}
                  {/* `type-measurement` on the LABELS, and this is not a
                      workaround for the role contract breaking when the
                      percentage came out - the labels were always the
                      measurement text in this row and were carrying a bare
                      `text-xs` instead. The contract said this file must use
                      the shared measurement role, and dropping the duplicated
                      percentage left it with none. Restoring the percentage
                      would have satisfied the contract by reinstating the
                      duplication; labelling the figures satisfies it by
                      labelling them, which is what they are. */}
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-border/50">
                    <span className="type-measurement text-muted-foreground">
                      Spent: <CurrencyDisplay amount={status.spent} className="figure-inline font-bold text-foreground" />
                    </span>
                    <span className="type-measurement text-muted-foreground">
                      Target: <CurrencyDisplay amount={status.budgeted} className="figure-inline font-bold text-foreground" />
                    </span>
                  </div>

                  <Button
                    onClick={() => setExpenseForm(status)}
                    className="rounded-xl bg-primary hover:bg-primary/80 text-white h-9 text-xs w-full cursor-pointer"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add Expense
                  </Button>
                </FintechCardContent>
              </FintechCard>
            );
          })}

          {/* The disclosure, and it names the count it is actually hiding.
              "View all" without a number is a claim that something is hidden
              without saying how much, which is how a list ends up reading as
              complete. `sm:hidden` because at `sm` and above the cap does not
              apply - so on a desk this line does not exist, and the reader is
              never told about tracks they are already looking at.

              An inline toggle, not a link. A "view all" affordance that
              navigates to a mutation surface is the day-cell bug: the label
              says read, the destination edits. This reveals in place, and
              "Edit Limits" in the header remains the only thing that writes. */}
          {hiddenTrackCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllTracks((v) => !v)}
              className="sm:hidden w-full rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
            >
              {showAllTracks
                ? "Show fewer"
                : `Show all ${optimisticStatuses.length} categories · ${hiddenTrackCount} hidden`}
            </button>
          )}
        </div>

        {/* The right column carries its own heading, and that is the whole fix.
            It previously had none, so it inherited "Unbudgeted Categories" from
            its first child and anything placed here read as unbudgeted
            spending. That is what disqualified the affordance CTA from this
            column - not the layout. With its own meaning, both the breakdown
            strip and the unbudgeted cards are correct here by construction,
            which is the semantic fix rather than a layout workaround. */}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-base text-foreground">Beyond category budgets</h3>
            <p className="text-xs text-muted-foreground">Budget-level figures, and spending in categories without a target this month.</p>
          </div>

          {/* The allowance breakdown, moved out of the allowance card. It is 84px
              the card no longer carries, and the row does not grow to take it
              back because this column has slack - which is how moving a block
              into spare room shortens the stack by that block's full height.

              Stacked rather than 3-up: 468px of column leaves ~150px per track,
              too narrow for these labels. The existing `sm:block` markup already
              renders label-left / figure-right when narrow, so dropping the 3-up
              is all this needs. */}
          <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <PieChart className="h-4 w-4" /> Targeted spending
              </span>
              <CurrencyDisplay amount={totalBudgetedSpent} className="type-ledger text-lg font-semibold tabular-nums text-foreground" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Target className="h-4 w-4" /> No target
              </span>
              <CurrencyDisplay amount={totalUnbudgetedSpent} className="type-ledger text-lg font-semibold tabular-nums text-foreground" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Budgeted remaining</span>
              <span className={cn("text-lg font-semibold tabular-nums", totalRemaining < 0 ? "text-rose" : "text-foreground")}>
                <CurrencyDisplay amount={totalRemaining} signed className="figure-inline" />
              </span>
            </div>
          </div>

          {/* Two-up on a phone, one-up from `lg`.
                Same meaning in both, so R2 pairs them: two cards with no budget
                configured, identical shape, nothing to tell them apart but the
                row they sit on.

                The 1-up at `lg` is the pre-existing decision and it stands - at
                `lg` this sits in the narrow right column, where the footer row
                below had no room for a Set Limit button beside a figure.

                The footer stacks below `sm` as a CONSEQUENCE of the pairing, not
                as a design call: a 170px card cannot hold the Spent figure and
                a 94px Set Limit button on one line, so the button takes its own
                line. At `sm` and up the cards are full width again and the row
                is inline, exactly as it was. */}
          {unbudgetedViews.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-5">
              {unbudgetedViews.map((view) => (
                <FintechCard key={view.categoryId} className="space-y-4 border-dashed">
                  <FintechCardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: `${resolveCategoryColor(view.color)}18`,
                            color: resolveCategoryColor(view.color),
                          }}
                        >
                          <CategoryIcon icon={view.icon} size="md" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-foreground">{view.name}</h4>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            No budget configured
                          </span>
                        </div>
                      </div>
                      {/* The badge is gone below `sm`, and that is the pairing's
                          doing, not a preference. At two-up this header is ~170px
                          and the badge was measured clipping mid-word - "UNBU" -
                          against the card edge. Nothing is lost by dropping it at
                          that width: the dashed border and the "No budget
                          configured" line under the name both say it, so the badge
                          is a third statement of a fact already on screen. It
                          returns from `sm`, where the cards are full width. */}
                      <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider">Unbudgeted</Badge>
                    </div>

                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:items-center text-xs pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">
                        Spent: <CurrencyDisplay amount={view.spent} className="figure-inline font-bold text-foreground" />
                      </span>
                      <Button
                        onClick={() => setFormOpen(true)}
                        variant="outline"
                        className="rounded-xl h-9 text-xs"
                      >
                        <Target className="mr-1.5 h-4 w-4" /> Set Limit
                      </Button>
                    </div>
                  </FintechCardContent>
                </FintechCard>
              ))}
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* Off the phone, because it is a desk tool.
          The page's question on a phone is "am I on track", and the allowance
          card and the category tracks above already answer it. This is a
          planning affordance: a button that navigates to /simulator, where the
          real work happens. 208px of a 667px screen spent on a doorway to
          another page is a worse use of the fold than any block that was cut.

          It is not hidden on mobile in the sense of removed - `hidden lg:block`
          keeps it in the DOM and reachable by resize, and /simulator remains a
          normal destination. It is simply not what a phone is holding. */}
      <FintechCard className="hidden lg:block">
        <FintechCardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sulpot-tint text-sulpot-deep dark:bg-sulpot-tint dark:text-sulpot-bright">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <FintechCardTitle>Can I Afford This?</FintechCardTitle>
              <p className="text-xs text-muted-foreground">Check a planned purchase against your budget before committing</p>
            </div>
          </div>
        </FintechCardHeader>
        <FintechCardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground max-w-md">
            Open the purchase simulator to see how a big spend shifts your emergency reserve, savings-goal timelines, and average net savings.
          </p>
          <Link
            href="/simulator"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "rounded-xl h-9 text-xs font-medium gap-1.5 cursor-pointer")}
          >
            <Calculator className="h-4 w-4" /> Open Purchase Simulator
          </Link>
        </FintechCardContent>
      </FintechCard>

      <BudgetForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        month={month}
        year={year}
      />

      <BudgetExpenseForm
        open={!!expenseForm}
        onOpenChange={(open) => !open && setExpenseForm(null)}
        category={expenseForm ? { id: expenseForm.categoryId, name: expenseForm.categoryName, icon: expenseForm.categoryIcon } : null}
        viewedMonthLabel={viewedMonthLabel}
        defaultDate={defaultExpenseDate}
        onAdd={handleAddExpense}
      />
    </div>
  );
}
