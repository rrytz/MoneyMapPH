"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
} from "lucide-react";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import { getMonthName } from "@/lib/utils/date";
import type { MonthlySummary, BudgetStatus, ExpenseCategory, MonthlySnapshot } from "@/lib/types";

interface SummaryViewProps {
  summary: MonthlySummary;
  snapshots: MonthlySnapshot[];
  categories: ExpenseCategory[];
  budgetStatuses: BudgetStatus[];
}

export function SummaryView({
  summary,
  snapshots,
  categories,
  budgetStatuses,
}: SummaryViewProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const cashFlowData = [...snapshots]
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    })
    .map((s) => ({
      name: `${getMonthName(s.month).slice(0, 3)} ${s.year}`,
      Income: Number(s.total_income),
      Expenses: Number(s.total_expenses),
    }));

  const categorySummaryList = Object.entries(summary.categorySpending)
    .map(([catId, amount]) => {
      const category = categories.find((c) => c.id === catId);
      return {
        id: catId,
        name: category?.name || "Other",
        icon: category?.icon || "📦",
        color: category?.color || "#64748b",
        amount,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const totalSpending = categorySummaryList.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      {/* Row 1: KPI Summary widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <FintechCard>
          <FintechCardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <Badge variant="income">Net Surplus</Badge>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground block">Monthly Savings Net</span>
              <CurrencyDisplay amount={summary.savingsAmount} className="text-3xl sm:text-4xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400" />
            </div>
          </FintechCardContent>
        </FintechCard>

        <FintechCard>
          <FintechCardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                <TrendingDown className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold text-slate-500">Utilization Rate</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground block">Budget Used</span>
              <div className="flex items-center gap-3">
                <p className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums">{summary.budgetUtilization}%</p>
                <Progress value={summary.budgetUtilization} className="h-2 flex-1 [&>div]:bg-amber-500" />
              </div>
            </div>
          </FintechCardContent>
        </FintechCard>

        <FintechCard>
          <FintechCardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <PieChart className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold text-slate-500">Combined Limit</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground block">Active Budget Ceilings</span>
              <CurrencyDisplay amount={summary.totalBudget} className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground" />
            </div>
          </FintechCardContent>
        </FintechCard>
      </div>

      {/* Cash Flow Chart */}
      <FintechCard className="flex flex-col">
        <FintechCardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <BarChart3 className="h-4 w-4" />
            </div>
            <FintechCardTitle>Cash Flow History</FintechCardTitle>
          </div>
          <p className="text-xs text-muted-foreground">Income vs Expense comparisons across historical monthly snapshots</p>
        </FintechCardHeader>
        <FintechCardContent className="p-5 pt-0">
          {cashFlowData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10 italic">
              No historical data available. Run more snapshots to display trends.
            </p>
          ) : (
            <div className="h-[300px] w-full mt-2">
              {!isMounted ? (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="h-[260px] w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/40" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#1e293b",
                        borderRadius: "0.75rem",
                        color: "#ffffff",
                        fontSize: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                      }}
                      formatter={(value: unknown) => formatCurrency(Number(value) || 0)}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} name="Total Income" />
                    <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Total Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </FintechCardContent>
      </FintechCard>

      {/* Distribution & Variance Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FintechCard className="lg:col-span-1 flex flex-col">
          <FintechCardHeader className="pb-4">
            <FintechCardTitle>Category Distribution</FintechCardTitle>
            <p className="text-xs text-muted-foreground">Expense allocation breakdown</p>
          </FintechCardHeader>
          <FintechCardContent className="p-0 flex-1">
            {categorySummaryList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center italic">
                No expense entries recorded for this period.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {categorySummaryList.map((item) => {
                  const pct = totalSpending > 0 ? (item.amount / totalSpending) * 100 : 0;
                  return (
                    <div key={item.id} className="p-3.5 px-5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className="text-base shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-foreground block truncate">{item.name}</span>
                          <span className="text-[10px] text-muted-foreground">{pct.toFixed(1)}% of total</span>
                        </div>
                      </div>
                      <CurrencyDisplay amount={item.amount} className="text-xs font-bold shrink-0 text-foreground" />
                    </div>
                  );
                })}
              </div>
            )}
          </FintechCardContent>
        </FintechCard>

        <FintechCard className="lg:col-span-2 flex flex-col">
          <FintechCardHeader className="pb-4">
            <FintechCardTitle>Budget Variance Analysis</FintechCardTitle>
            <p className="text-xs text-muted-foreground">Target ceilings vs real spent amounts</p>
          </FintechCardHeader>
          <FintechCardContent className="p-0 overflow-x-auto flex-1">
            {budgetStatuses.length === 0 ? (
              <p className="text-xs text-muted-foreground py-10 text-center italic">
                No active budget configured for this month. Set up target limits on the Budgets page.
              </p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/50 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    <th className="py-3 px-5">Category</th>
                    <th className="py-3 px-4 text-right">Budgeted</th>
                    <th className="py-3 px-4 text-right">Spent</th>
                    <th className="py-3 px-4 text-right">Variance</th>
                    <th className="py-3 px-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {budgetStatuses.map((b) => (
                    <tr key={b.categoryId} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          {b.categoryIcon && <span className="text-sm shrink-0">{b.categoryIcon}</span>}
                          <span>{b.categoryName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-foreground">
                        <CurrencyDisplay amount={b.budgeted} />
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                        <CurrencyDisplay amount={b.spent} />
                      </td>
                      <td className={`py-3.5 px-4 text-right tabular-nums font-bold ${b.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {b.remaining >= 0 ? "+" : ""}
                        <CurrencyDisplay amount={b.remaining} />
                      </td>
                      <td className="py-3.5 px-5 text-right font-semibold">
                        {b.status === "under" ? (
                          <Badge variant="income" className="text-[10px]">On Track</Badge>
                        ) : b.status === "near" ? (
                          <Badge variant="warning" className="text-[10px]">Watch</Badge>
                        ) : (
                          <Badge variant="expense" className="text-[10px]">Over Budget</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </FintechCardContent>
        </FintechCard>
      </div>
    </div>
  );
}