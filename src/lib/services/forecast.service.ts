import { SupabaseClient } from "@supabase/supabase-js";
import { getSnapshots } from "./snapshot.service";
import { getSavingsGoals } from "./goal.service";
import { getMonthlySummary } from "./financial.service";
import { getCurrentMonthYear, getMonthName } from "@/lib/utils/date";
import type { ForecastDataPoint } from "@/lib/types";

export interface EmergencyFundStatus {
  hasFund: boolean;
  currentBalance: number;
  targetAmount: number;
  averageExpenses: number;
  monthsCovered: number;
  status: "adequate" | "warning" | "critical" | "not_configured" | "insufficient_data";
}

export async function calculateEmergencyFundStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<EmergencyFundStatus> {
  const goals = await getSavingsGoals(supabase, userId);
  const emergencyGoal = goals.find((g) => g.is_emergency_fund);

  if (!emergencyGoal) {
    return {
      hasFund: false,
      currentBalance: 0,
      targetAmount: 0,
      averageExpenses: 0,
      monthsCovered: 0,
      status: "not_configured",
    };
  }

  // Calculate average expenses from snapshots (up to 6 months)
  const snapshots = await getSnapshots(supabase, userId, 6);
  let averageExpenses = 0;

  if (snapshots.length > 0) {
    const totalExp = snapshots.reduce((sum, s) => sum + Number(s.total_expenses), 0);
    averageExpenses = totalExp / snapshots.length;
  } else {
    // Fallback: check current monthly budget
    const { month, year } = getCurrentMonthYear();
    try {
      const summary = await getMonthlySummary(supabase, userId, month, year);
      averageExpenses = summary.totalBudget; // Treat entire budget as expected expenses
    } catch {
      averageExpenses = 0;
    }
  }

  const currentBalance = Math.max(0, Number(emergencyGoal.current_amount) || 0);

  if (averageExpenses <= 0) {
    return {
      hasFund: true,
      currentBalance,
      targetAmount: Math.max(0, Number(emergencyGoal.target_amount) || 0),
      averageExpenses: 0,
      monthsCovered: 0,
      status: "insufficient_data",
    };
  }

  const rawMonths = averageExpenses > 0 ? currentBalance / averageExpenses : 0;
  const monthsCovered = Number.isFinite(rawMonths) ? rawMonths : 0;
  
  let status: EmergencyFundStatus["status"] = "critical";
  if (monthsCovered >= 6) {
    status = "adequate";
  } else if (monthsCovered >= 3) {
    status = "warning";
  }

  return {
    hasFund: true,
    currentBalance,
    targetAmount: Math.max(0, Number(emergencyGoal.target_amount) || 0),
    averageExpenses: Math.round(averageExpenses * 100) / 100,
    monthsCovered: Math.round(monthsCovered * 100) / 100,
    status,
  };
}

export async function calculateMonthlyNetSavings(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const snapshots = await getSnapshots(supabase, userId, 6);
  let monthlyNetSavings = 0;

  if (snapshots.length > 0) {
    const totalSavings = snapshots.reduce(
      (sum, s) => sum + ((Number(s.total_income) || 0) - (Number(s.total_expenses) || 0)),
      0
    );
    const avgSavings = totalSavings / snapshots.length;
    // Cap net savings below zero for forward projections, guaranteed finite
    monthlyNetSavings = Number.isFinite(avgSavings) ? Math.max(0, avgSavings) : 0;
  } else {
    // Try current month's budget summary
    const { month, year } = getCurrentMonthYear();
    try {
      const summary = await getMonthlySummary(supabase, userId, month, year);
      const budgetNet = summary.totalIncome - summary.totalExpenses;
      if (budgetNet > 0 && Number.isFinite(budgetNet)) {
        monthlyNetSavings = budgetNet;
      }
    } catch {
      monthlyNetSavings = 0;
    }
  }
  return Math.round(monthlyNetSavings * 100) / 100;
}

export async function generateSavingsForecast(
  supabase: SupabaseClient,
  userId: string
): Promise<ForecastDataPoint[]> {
  const snapshots = await getSnapshots(supabase, userId, 6);
  const goals = await getSavingsGoals(supabase, userId);

  // Initial balance is the sum of current savings goal amounts
  const startBalance = goals.reduce((sum, g) => sum + Math.max(0, Number(g.current_amount) || 0), 0);

  // Compute average monthly net savings
  const monthlyNetSavings = await calculateMonthlyNetSavings(supabase, userId);

  const dataPoints: ForecastDataPoint[] = [];
  const now = new Date();

  // 1. Generate historical points (past 6 months)
  const historicalPoints: ForecastDataPoint[] = [];
  let runningHistoricalBalance = startBalance;
  
  // Sort snapshots backwards to compute running balance from past values
  // Since we only have monthly totals, we can approximate historical balances
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const s = snapshots[i];
    const sDate = `${getMonthName(s.month).slice(0, 3)} ${s.year}`;
    const net = (Number(s.total_income) || 0) - (Number(s.total_expenses) || 0);
    
    historicalPoints.unshift({
      date: sDate,
      historical: Math.round(runningHistoricalBalance * 100) / 100,
      forecasted: Math.round(runningHistoricalBalance * 100) / 100,
    });
    // Deduct to traverse backward in time safely
    runningHistoricalBalance = Math.max(0, runningHistoricalBalance - net);
  }

  dataPoints.push(...historicalPoints);

  // 2. Generate future points (next 12 months)
  let runningForecastBalance = startBalance;
  for (let i = 1; i <= 12; i++) {
    const forecastMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const dateLabel = `${getMonthName(forecastMonth.getMonth() + 1).slice(0, 3)} ${forecastMonth.getFullYear()}`;
    
    runningForecastBalance = Math.max(0, runningForecastBalance + monthlyNetSavings);
    
    dataPoints.push({
      date: dateLabel,
      forecasted: Math.round(runningForecastBalance * 100) / 100,
    });
  }

  return dataPoints;
}
