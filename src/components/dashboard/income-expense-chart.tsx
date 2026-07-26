"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { MonthlySnapshot } from "@/lib/types";
import { getMonthName } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";

interface IncomeExpenseChartProps {
  snapshots: MonthlySnapshot[];
}

export function IncomeExpenseChart({ snapshots }: IncomeExpenseChartProps) {
  const data = snapshots.map((s) => ({
    name: getMonthName(s.month).slice(0, 3),
    income: Number(s.total_income),
    expenses: Number(s.total_expenses),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Income vs Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
            <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend />
            <Bar dataKey="income" name="Income" fill="oklch(0.627 0.194 163.223)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="oklch(0.577 0.245 27.325)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
