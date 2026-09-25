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
    <div className="space-y-6">
      <PageHeader title="Budget Planner" description="Set and monitor category targets for variable and fixed expenses">
        <div className="flex flex-wrap items-center gap-3">
          <MonthYearPicker
            month={month}
            year={year}
            onChange={(m, y) => {
              setMonth(m);
              setYear(y);
              router.replace(`/budgets?month=${m}&year=${y}`, { scroll: false });
            }}
          />
          {statuses.length === 0 ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy} disabled={copying} className="rounded-xl border-border h-9 text-xs">
                <Copy className="mr-1.5 h-4 w-4" /> Copy Previous
              </Button>
              <Button onClick={() => setFormOpen(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs">
                <Plus className="mr-1.5 h-4 w-4" /> Create Budget
              </Button>
            </div>
          ) : (
            <Button onClick={() => setFormOpen(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs">
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
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
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
            <div className="grid gap-4 border-t border-border bg-muted/30 px-6 py-4 sm:grid-cols-3 sm:px-8">
              <div className="flex items-center justify-between gap-3 sm:block">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <PieChart className="h-4 w-4" /> Targeted spending
                </span>
                <CurrencyDisplay amount={totalBudgetedSpent} className="type-ledger mt-1 block text-lg font-semibold tabular-nums text-foreground" />
              </div>
              <div className="flex items-center justify-between gap-3 sm:block">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Target className="h-4 w-4" /> No target
                </span>
                <CurrencyDisplay amount={totalUnbudgetedSpent} className="type-ledger mt-1 block text-lg font-semibold tabular-nums text-foreground" />
              </div>
              <div className="flex items-center justify-between gap-3 sm:block">
                <span className="text-xs text-muted-foreground">Budgeted remaining</span>
                <span className={cn("type-ledger mt-1 block text-lg font-semibold tabular-nums", totalRemaining < 0 ? "text-rose" : "text-foreground")}>
                  <CurrencyDisplay amount={totalRemaining} signed />
                </span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {optimisticStatuses.map((status) => {
            const isOver = status.status === "over";
            const isNear = status.status === "near";
            const statusLabel = isOver ? "Over Budget" : isNear ? "Watch" : "On Track";
            const statusVariant = isOver ? "expense" : isNear ? "warning" : "income";

            return (
              <FintechCard key={status.categoryId} className="space-y-4">
                <FintechCardContent className="p-6 space-y-4">
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
                        <span className="type-measurement text-[11px] text-muted-foreground tabular-nums">
                          {status.percentage.toFixed(0)}% used
                        </span>
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
                          : "[&>div>div]:bg-emerald-500"
                    )}
                  />

                  <div className="flex justify-between items-center text-xs pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">
                      Spent: <CurrencyDisplay amount={status.spent} className="type-ledger font-bold text-foreground" />
                    </span>
                    <span className="text-muted-foreground">
                      Target: <CurrencyDisplay amount={status.budgeted} className="type-ledger font-bold text-foreground" />
                    </span>
                  </div>

                  <Button
                    onClick={() => setExpenseForm(status)}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs w-full cursor-pointer"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add Expense
                  </Button>
                </FintechCardContent>
              </FintechCard>
            );
          })}
        </div>

        {unbudgetedViews.length > 0 && (
          <div className="space-y-4 mt-8">
            <div>
              <h3 className="font-semibold text-base text-foreground">Unbudgeted Categories</h3>
              <p className="text-xs text-muted-foreground">Spending in categories without a budget target in this calendar month.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                      <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">Unbudgeted</Badge>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">
                        Spent: <CurrencyDisplay amount={view.spent} className="font-bold text-foreground" />
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
          </div>
        )}
        </>
      )}

      <FintechCard>
        <FintechCardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
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
