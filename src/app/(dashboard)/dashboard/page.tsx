import { createClient } from "@/lib/supabase/server";
import { getMonthlySummary } from "@/lib/services/financial.service";
import { getSnapshots } from "@/lib/services/snapshot.service";
import { getExpenseCategories, getIncomeSources } from "@/lib/services/category.service";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { CategoryDonutChart } from "@/components/dashboard/category-donut-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { DollarSign, TrendingDown, PiggyBank, Target } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { month, year } = getCurrentMonthYear();

  const [summary, snapshots, categories] = await Promise.all([
    getMonthlySummary(supabase, user.id, month, year),
    getSnapshots(supabase, user.id, 6),
    getExpenseCategories(supabase, user.id),
  ]);

  const lastMonthSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const incomeChange = lastMonthSnapshot && Number(lastMonthSnapshot.total_income) > 0
    ? ((summary.totalIncome - Number(lastMonthSnapshot.total_income)) / Number(lastMonthSnapshot.total_income)) * 100
    : null;
  const expenseChange = lastMonthSnapshot && Number(lastMonthSnapshot.total_expenses) > 0
    ? ((summary.totalExpenses - Number(lastMonthSnapshot.total_expenses)) / Number(lastMonthSnapshot.total_expenses)) * 100
    : null;

  const [{ data: recentIncome }, { data: recentExpenses }] = await Promise.all([
    supabase
      .from("income_entries")
      .select("id, amount, date, source:income_sources(name)")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("expenses")
      .select("id, title, amount, date, category:expense_categories(name)")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(5),
  ]);

  const transactions = [
    ...(recentIncome || []).map((e: any) => ({
      id: e.id,
      type: "income" as const,
      title: e.source?.name || "Income",
      amount: Number(e.amount),
      date: e.date,
    })),
    ...(recentExpenses || []).map((e: any) => ({
      id: e.id,
      type: "expense" as const,
      title: e.title,
      amount: Number(e.amount),
      date: e.date,
      category: e.category?.name,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Monthly Income"
          value={summary.totalIncome}
          icon={DollarSign}
          changePercent={incomeChange}
          colorClass="text-income"
        />
        <KpiCard
          title="Total Expenses"
          value={summary.totalExpenses}
          icon={TrendingDown}
          changePercent={expenseChange}
          colorClass="text-danger"
        />
        <KpiCard
          title="Remaining Budget"
          value={summary.remainingBudget}
          icon={Target}
          colorClass={summary.remainingBudget >= 0 ? "text-success" : "text-danger"}
        />
        <KpiCard
          title="Savings Rate"
          value={summary.savingsRate}
          icon={PiggyBank}
          isCurrency={false}
          isPercentage={true}
          colorClass={summary.savingsRate >= 20 ? "text-success" : summary.savingsRate >= 0 ? "text-warning" : "text-danger"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeExpenseChart snapshots={snapshots} />
        <CategoryDonutChart categorySpending={summary.categorySpending} categories={categories} />
      </div>

      <RecentTransactions transactions={transactions} />
    </div>
  );
}
