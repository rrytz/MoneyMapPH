"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Sparkles, Info, Calendar, Goal, Zap, Wallet } from "lucide-react";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import type { ForecastDataPoint, SavingsGoal } from "@/lib/types";

interface ForecastingClientProps {
  forecastData: ForecastDataPoint[];
  goals: SavingsGoal[];
}

export function ForecastingClient({ forecastData, goals }: ForecastingClientProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const futurePoints = forecastData.filter((p) => p.historical === undefined);
  const startBalance = futurePoints.length > 0 ? futurePoints[0].forecasted : 0;
  const endBalance = futurePoints.length > 0 ? futurePoints[futurePoints.length - 1].forecasted : 0;
  
  const projectedMonthlyGrowth = futurePoints.length > 1
    ? (futurePoints[1].forecasted - futurePoints[0].forecasted)
    : 0;

  const goalForecasts = goals.map((goal) => {
    const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
    let monthsToReach: number | "infinite" = "infinite";
    
    if (remaining === 0) {
      monthsToReach = 0;
    } else if (projectedMonthlyGrowth > 0) {
      monthsToReach = Math.ceil(remaining / projectedMonthlyGrowth);
    }
    
    return {
      ...goal,
      remaining,
      monthsToReach,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Future"
        description="Predict net savings trajectory and goal completion rates based on historical data"
      />

      {/* The page's answer is the one-year position. Pace and growth rate are
          supporting measures of how that answer is reached. */}
      <FintechCard>
        <FintechCardContent className="p-0">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Wallet className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-semibold text-slate-500">12-month target</span>
              </div>
              <span className="mt-6 block text-xs font-medium text-muted-foreground">1-year projected balance</span>
              <CurrencyDisplay
                amount={endBalance}
                className="type-ledger text-4xl sm:text-5xl font-semibold tracking-tight text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 border-t border-border lg:border-t-0 lg:border-l">
              <div className="p-6">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="mt-4 block text-xs text-muted-foreground">Projected monthly savings pace</span>
                <CurrencyDisplay amount={projectedMonthlyGrowth} className="type-ledger mt-1 block text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="border-l border-border p-6">
                <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="mt-4 block text-xs text-muted-foreground">Projected monthly growth rate</span>
                <p className="type-measurement mt-1 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{projectedMonthlyGrowth > 0 && startBalance > 0 ? Math.round((projectedMonthlyGrowth / startBalance) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </FintechCardContent>
      </FintechCard>

      {/* Forecast Line Area Chart */}
      <FintechCard className="flex flex-col">
        <FintechCardHeader className="pb-4">
          <FintechCardTitle>Savings Trajectory Projections</FintechCardTitle>
          <p className="text-xs text-muted-foreground">Continuous curve combining past savings balances with future monthly predictions</p>
        </FintechCardHeader>
        <FintechCardContent className="type-measurement p-5 pt-0">
          <div className="h-[340px] w-full mt-2">
            {!isMounted ? (
              <div className="h-full w-full flex items-center justify-center">
                <div className="h-[300px] w-full animate-pulse rounded-xl bg-muted/40" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-sulpot-deep)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-sulpot-deep)" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorHistorical" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-sulpot)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-sulpot)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)", fontFamily: "Instrument Sans, ui-sans-serif, sans-serif" }}
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      borderColor: "var(--color-border)",
                      borderRadius: "0.75rem",
                      color: "var(--color-popover-foreground)",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                    }}
                    formatter={(value: unknown) => formatCurrency(Number(value) || 0)}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area
                    type="monotone"
                    dataKey="forecasted"
                    name="Forecasted Net Savings"
                    stroke="var(--color-sulpot-deep)"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorForecast)"
                  />
                  <Area
                    type="monotone"
                    dataKey="historical"
                    name="Historical Balance"
                    stroke="var(--color-sulpot)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorHistorical)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border">
            <Info className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>How it works:</strong> The engine aggregates income, expenses, and budgets to establish a monthly net savings speed. Future projections assume a constant savings speed.
            </span>
          </div>
        </FintechCardContent>
      </FintechCard>

      {/* Goal Completion Timelines */}
      <FintechCard className="flex flex-col">
        <FintechCardHeader className="pb-4">
          <FintechCardTitle>Goal Completion Estimates</FintechCardTitle>
          <p className="text-xs text-muted-foreground">Estimated timeline to reach targets based on current monthly contribution speed</p>
        </FintechCardHeader>
        <FintechCardContent className="p-0">
          {goalForecasts.length === 0 ? (
            <p className="text-xs text-muted-foreground p-6 text-center">
              No active goals found. Set up target goals on the Savings tab to project timelines.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {goalForecasts.map((goal) => (
                <div key={goal.id} className="p-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{goal.name}</span>
                      {goal.is_emergency_fund && (
                        <Badge variant="income" className="text-[10px]">Emergency Fund</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Target: ₱{Number(goal.target_amount).toLocaleString()}</span>
                      <span>•</span>
                      <span>Remaining: ₱{goal.remaining.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <Goal className="h-4 w-4 text-emerald-600" />
                    <span className="type-measurement text-sm font-bold text-foreground">
                      {goal.monthsToReach === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><Sparkles className="h-3.5 w-3.5" /> Achieved</span>
                      ) : goal.monthsToReach === "infinite" ? (
                        <span className="text-rose-500">Needs Savings Stream</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                          <Calendar className="h-3.5 w-3.5" /> ~{goal.monthsToReach} months
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FintechCardContent>
      </FintechCard>
    </div>
  );
}
