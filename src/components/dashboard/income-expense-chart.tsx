"use client";

import { useState, useEffect } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LineChart as LineChartIcon } from "lucide-react";
import { getTrendChartState, TREND_SPARSE_TITLE, TREND_SPARSE_DESC } from "@/lib/utils/dashboard-charts";
import type { MonthlySnapshot } from "@/lib/types";
import { getMonthName } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";

interface IncomeExpenseChartProps {
  snapshots: MonthlySnapshot[];
}

export function IncomeExpenseChart({ snapshots }: IncomeExpenseChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const trendState = getTrendChartState(snapshots?.length ?? 0);

  if (trendState !== "chart") {
    return (
      <FintechCard>
        <FintechCardHeader>
          <FintechCardTitle>Income vs Expenses</FintechCardTitle>
          <p className="text-xs text-muted-foreground">Trailing 6 months performance</p>
        </FintechCardHeader>
        <FintechCardContent>
          <EmptyState
            icon={<LineChartIcon className="h-6 w-6" />}
            title={trendState === "empty" ? "No snapshot data yet" : TREND_SPARSE_TITLE}
            description={
              trendState === "empty"
                ? "Log your income and expenses to view historical trend performance."
                : TREND_SPARSE_DESC
            }
            actionLabel="Add Transaction"
            actionHref="/transactions"
          />
        </FintechCardContent>
      </FintechCard>
    );
  }

  const data = snapshots.map((s) => ({
    name: getMonthName(s.month).slice(0, 3).toUpperCase(),
    Income: Number(s.total_income),
    Expenses: Number(s.total_expenses),
  }));

  return (
    <FintechCard className="flex flex-col">
      <FintechCardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <FintechCardTitle>Income vs Expenses</FintechCardTitle>
          <p className="text-xs text-muted-foreground">Trailing 6 months performance</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Income
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" /> Expenses
          </span>
        </div>
      </FintechCardHeader>

      <FintechCardContent className="h-[270px] w-full pt-2">
        {!isMounted ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="h-[240px] w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/40" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
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
              formatter={(val: unknown) => formatCurrency(Number(val) || 0)}
            />
            <Area
              type="monotone"
              dataKey="Income"
              stroke="#10b981"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#incomeAreaGradient)"
            />
            <Area
              type="monotone"
              dataKey="Expenses"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="none"
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </FintechCardContent>
    </FintechCard>
  );
}
