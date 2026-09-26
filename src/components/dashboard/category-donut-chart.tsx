"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { EmptyState } from "@/components/shared/empty-state";
import { CategoryIcon } from "@/components/shared/category-icon";
import { CATEGORY_COLOR_PALETTE, resolveCategoryColor } from "@/lib/categories/color-map";
import { PieChart as PieChartIcon } from "lucide-react";
import type { ExpenseCategory } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";

interface CategoryDonutChartProps {
  categorySpending: Record<string, number>;
  categories: ExpenseCategory[];
}

// Governed 6-tint palette. Replaces the old rainbow fallback, which carried
// banned cyan (#3b82f6, #06b6d4) and an off-palette orange.
const FALLBACK_COLORS: string[] = [
  CATEGORY_COLOR_PALETTE.sulpot,
  CATEGORY_COLOR_PALETTE.water,
  CATEGORY_COLOR_PALETTE.amber,
  CATEGORY_COLOR_PALETTE.rose,
  CATEGORY_COLOR_PALETTE.channel,
  CATEGORY_COLOR_PALETTE.indigo,
];

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
      <p className="type-ledger text-muted-foreground tabular-nums">{formatCurrency(item.amount)}</p>
      <p className="type-measurement text-muted-foreground">{item.percentage.toFixed(1)}%</p>
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
        icon: category?.icon ?? null,
        amount: Number(amount) || 0,
        percentage: totalSpending > 0 ? ((Number(amount) || 0) / totalSpending) * 100 : 0,
        color: resolveCategoryColor(category?.color) || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
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
            title="No expenses logged this calendar month"
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
        {/* figure-inline: this is a sentence with a peso amount in it, not a
            standalone figure. Same treatment as the dashboard's scale-bar
            line, which is the precedent for a figure inside running text. */}
        <p className="figure-inline text-xs text-muted-foreground tabular-nums">
          {formatCurrency(totalSpending)} calendar month total · top {top5.length} {top5.length === 1 ? "category" : "categories"}
        </p>
      </FintechCardHeader>
      {/* Donut and legend side by side rather than stacked. Stacked, this card
          was 45 pad + 51 header + 180 donut + 16 gap + 162 legend = 454, and
          it was that 454 — not the neighbouring line chart, which needs only
          373 and was being stretched to match — that set the height of the
          whole chart row. Beside, the body is max(180, 162) = 180. */}
      <FintechCardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
        {/* Recharts Donut */}
        {isMounted ? (
          <div className="relative w-[180px] shrink-0" style={{ height: 180 }}>
            {top5.length === 1 ? (
              <div className="flex h-full items-center justify-center">
                <svg viewBox="0 0 100 100" className="h-[144px] w-[144px]" role="img" aria-label={`${top5[0].name} 100% of calendar-month spending`}>
                  <circle cx="50" cy="50" r="40" className="stroke-border" strokeWidth="9" fill="transparent" />
                  <circle cx="50" cy="50" r="40" stroke={top5[0].color} strokeWidth="9" fill="transparent" />
                </svg>
              </div>
            ) : (
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
                    isAnimationActive={false}
                  >
                    {top5.map((entry) => (
                      <Cell key={`cell-${entry.id}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {top5.length === 1 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="type-measurement text-xl font-black text-foreground tabular-nums">
                  {top5[0].percentage.toFixed(0)}%
                </span>
                <span className="type-ledger text-[10px] text-muted-foreground tabular-nums">
                  {formatCurrency(top5[0].amount)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-[180px] shrink-0 rounded-2xl bg-muted animate-pulse" style={{ height: 180 }} />
        )}

        {/* Legend. The 10px colour dot is gone: the icon chip beside the name
            is already tinted with the category colour, and the donut arc shows
            it too. Two indicators for one fact is double-signalling. The chip
            is the tallest thing in the row, so dropping the dot saved no
            height — it is here for the coherence, not the density. */}
        <div className="flex-1 min-w-0 space-y-2 self-center">
          {top5.map((item) => (
            <div key={item.id || item.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-xs shrink-0"
                  style={{ backgroundColor: `${item.color}18`, color: item.color }}
                >
                  <CategoryIcon icon={item.icon} className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="type-measurement text-[10px] text-muted-foreground tabular-nums">{item.percentage.toFixed(0)}%</span>
                <span className="type-ledger text-xs font-bold text-foreground tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
        </div>
      </FintechCardContent>
    </FintechCard>
  );
}
