"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PieChart as PieChartIcon } from "lucide-react";
import type { ExpenseCategory } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";

interface CategoryDonutChartProps {
  categorySpending: Record<string, number>;
  categories: ExpenseCategory[];
}

const FALLBACK_COLORS = ["#f97316", "#3b82f6", "#a855f7", "#ec4899", "#10b981", "#f43f5e", "#06b6d4", "#64748b"];

interface TooltipPayload {
  name: string;
  value: number;
  payload: { name: string; amount: number; percentage: number; color: string };
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{item.name}</p>
      <p className="text-muted-foreground tabular-nums">{formatCurrency(item.amount)}</p>
      <p className="text-muted-foreground">{item.percentage.toFixed(1)}%</p>
    </div>
  );
}

export function CategoryDonutChart({ categorySpending, categories }: CategoryDonutChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const totalSpending = Object.values(categorySpending).reduce((sum, val) => sum + (Number(val) || 0), 0);

  const data = Object.entries(categorySpending)
    .filter(([, amount]) => (Number(amount) || 0) > 0)
    .map(([categoryId, amount]) => {
      const category = categories.find((c) => c.id === categoryId);
      const index = category ? Math.max(0, categories.indexOf(category)) : 0;
      return {
        id: categoryId,
        name: category?.name || "Other",
        icon: category?.icon || "📦",
        amount: Number(amount) || 0,
        percentage: totalSpending > 0 ? ((Number(amount) || 0) / totalSpending) * 100 : 0,
        color: category?.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length] || "#f97316",
      };
    })
    .sort((a, b) => b.amount - a.amount);

  if (data.length === 0 || totalSpending <= 0) {
    return (
      <FintechCard>
        <FintechCardHeader>
          <FintechCardTitle>Spending by Category</FintechCardTitle>
          <p className="text-xs text-muted-foreground">Monthly expense allocation breakdown</p>
        </FintechCardHeader>
        <FintechCardContent>
          <EmptyState
            icon={<PieChartIcon className="h-6 w-6" />}
            title="No expenses logged this month"
            description="Track your spending categories by adding expenses."
            actionLabel="Add Expense"
            actionHref="/expenses"
          />
        </FintechCardContent>
      </FintechCard>
    );
  }

  const top5 = data.slice(0, 5);

  return (
    <FintechCard className="flex flex-col">
      <FintechCardHeader className="pb-2">
        <FintechCardTitle>Spending by Category</FintechCardTitle>
        <p className="text-xs text-muted-foreground">Monthly expense allocation breakdown</p>
      </FintechCardHeader>
      <FintechCardContent className="flex flex-col gap-4">
        {/* Recharts Donut */}
        {isMounted ? (
          <div className="w-full" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={top5}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={3}
                  dataKey="amount"
                  nameKey="name"
                  strokeWidth={0}
                >
                  {top5.map((entry) => (
                    <Cell key={`cell-${entry.id}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ height: 180 }} />
        )}

        {/* Legend */}
        <div className="space-y-2">
          {top5.map((item) => (
            <div key={item.id || item.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-xs shrink-0"
                  style={{ backgroundColor: `${item.color}18`, color: item.color }}
                >
                  {item.icon}
                </div>
                <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground tabular-nums">{item.percentage.toFixed(0)}%</span>
                <span className="text-xs font-bold text-foreground tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </FintechCardContent>
    </FintechCard>
  );
}
