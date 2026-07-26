"use client";

import { useState } from "react";
import { Plus, Copy, PieChart, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  const overallPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

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
    <>
      <PageHeader title="Budgets" description="Manage your monthly spending limits per category">
        <MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        {statuses.length === 0 ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopy} disabled={copying}>
              <Copy className="mr-2 h-4 w-4" /> Copy Previous
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Budget
            </Button>
          </div>
        ) : (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Edit Limits
          </Button>
        )}
      </PageHeader>

      {statuses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Budgeted</CardTitle>
            </CardHeader>
            <CardContent>
              <CurrencyDisplay amount={totalBudgeted} className="text-2xl font-bold" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <CurrencyDisplay amount={totalSpent} className="text-2xl font-bold text-danger" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <CurrencyDisplay
                amount={totalRemaining}
                className={cn(
                  "text-2xl font-bold",
                  totalRemaining >= 0 ? "text-success" : "text-danger"
                )}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {statuses.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No budget for this month"
          description="Create a monthly budget to set spending targets for your categories."
          actionLabel="Create Budget"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statuses.map((status) => {
            const isOver = status.status === "over";
            const isNear = status.status === "near";

            return (
              <Card key={status.categoryId} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {status.categoryIcon && <span>{status.categoryIcon}</span>}
                      <CardTitle className="text-base font-semibold">{status.categoryName}</CardTitle>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        isOver
                          ? "bg-danger/10 text-danger"
                          : isNear
                            ? "bg-warning/10 text-warning"
                            : "bg-success/10 text-success"
                      )}
                    >
                      {status.percentage.toFixed(0)}%
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress
                    value={Math.min(status.percentage, 100)}
                    className={cn(
                      "h-2",
                      isOver
                        ? "[&>div]:bg-danger"
                        : isNear
                          ? "[&>div]:bg-warning"
                          : "[&>div]:bg-success"
                    )}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      Spent: <CurrencyDisplay amount={status.spent} className="font-semibold text-foreground" />
                    </span>
                    <span>
                      Limit: <CurrencyDisplay amount={status.budgeted} className="font-semibold text-foreground" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BudgetForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        month={month}
        year={year}
      />
    </>
  );
}
