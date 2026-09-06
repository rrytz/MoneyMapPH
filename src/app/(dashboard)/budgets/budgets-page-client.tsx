"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Copy, PieChart, Wallet, Target, AlertTriangle, Calculator } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthYearPicker } from "@/components/shared/month-year-picker";
import { BudgetForm } from "@/components/forms/budget-form";
import { copyPreviousMonthBudget } from "./actions";
import { toast } from "sonner";
import type { BudgetStatus, ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BudgetsPageClientProps {
  statuses: BudgetStatus[];
  categories: ExpenseCategory[];
  currentMonth: number;
  currentYear: number;
}

export function BudgetsPageClient({
  statuses,
  categories,
  currentMonth: initialMonth,
  currentYear: initialYear,
}: BudgetsPageClientProps) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [formOpen, setFormOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  const totalBudgeted = statuses.reduce((sum, s) => sum + s.budgeted, 0);
  const totalSpent = statuses.reduce((sum, s) => sum + s.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;

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
          <MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
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

      {/* Top Summary Cards */}
      {statuses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <FintechCard>
            <FintechCardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Wallet className="h-5 w-5" />
                </div>
                <Badge variant="income">Total Target</Badge>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">Total Budgeted</span>
                <CurrencyDisplay amount={totalBudgeted} className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground" />
              </div>
            </FintechCardContent>
          </FintechCard>

          <FintechCard>
            <FintechCardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <Badge variant="expense">Total Outflow</Badge>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">Total Spent</span>
                <CurrencyDisplay amount={totalSpent} className="text-3xl sm:text-4xl font-bold tracking-tight text-rose-600 dark:text-rose-400" />
              </div>
            </FintechCardContent>
          </FintechCard>

          <FintechCard>
            <FintechCardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                  <Target className="h-5 w-5" />
                </div>
                <Badge variant="info">Available</Badge>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">Remaining Allowance</span>
                <CurrencyDisplay
                  amount={totalRemaining}
                  className={cn(
                    "text-3xl sm:text-4xl font-bold tracking-tight",
                    totalRemaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}
                />
              </div>
            </FintechCardContent>
          </FintechCard>
        </div>
      )}

      {/* Main Budget Grid */}
      {statuses.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No budget configured for this month"
          description="Create spending targets for categories to keep your expenses on track."
          actionLabel="Create Monthly Budget"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {statuses.map((status) => {
            const isOver = status.status === "over";
            const isNear = status.status === "near";
            const statusLabel = isOver ? "Over Budget" : isNear ? "Watch" : "On Track";
            const statusVariant = isOver ? "expense" : isNear ? "warning" : "income";

            return (
              <FintechCard key={status.categoryId} className="space-y-4">
                <FintechCardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base">
                        {status.categoryIcon || "📦"}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">{status.categoryName}</h4>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
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
                        ? "[&>div]:bg-rose-500"
                        : isNear
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-emerald-500"
                    )}
                  />

                  <div className="flex justify-between items-center text-xs pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">
                      Spent: <CurrencyDisplay amount={status.spent} className="font-bold text-foreground" />
                    </span>
                    <span className="text-muted-foreground">
                      Target: <CurrencyDisplay amount={status.budgeted} className="font-bold text-foreground" />
                    </span>
                  </div>
                </FintechCardContent>
              </FintechCard>
            );
          })}
        </div>
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
            Open the purchase simulator to see how a big spend shifts your emergency reserve, savings-goal timelines, and monthly net savings.
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
    </div>
  );
}
