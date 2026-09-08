import { SupabaseClient } from "@supabase/supabase-js";
import { parseISO } from "date-fns";
import { toISODateString } from "@/lib/utils/date";
import {
  getCutoffPeriodForDate,
  getPayoutDateForPeriodEnd,
  listCutoffPeriodsBetween,
} from "@/lib/utils/pay-period";
import { LEAN_CUTOFF_THRESHOLD, LEAN_WINDOW_PERIODS, MIN_LEAN_PERIODS } from "@/lib/constants";
import type { LeanStatus } from "@/lib/types";

export interface CutoffIncome {
  periodEnd: string;
  income: number;
}

export async function getTrailingCutoffIncomes(
  supabase: SupabaseClient,
  userId: string,
  windowPeriods: number = LEAN_WINDOW_PERIODS,
  now: Date = new Date()
): Promise<CutoffIncome[]> {
  const current = getCutoffPeriodForDate(now);
  const cutoffs = listCutoffPeriodsBetween(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - windowPeriods * 33),
    current.periodEnd
  ).slice(-windowPeriods);

  const windowStart = cutoffs[0]?.periodStart ?? now;

  const { data, error } = await supabase
    .from("paychecks")
    .select("period_end, amount")
    .eq("user_id", userId)
    .not("period_end", "is", null)
    .gte("date", toISODateString(windowStart))
    .lte("date", toISODateString(current.periodEnd))
    .order("date", { ascending: false });

  if (error) throw error;

  const byPeriod = new Map<string, number>();
  (data || []).forEach((row) => {
    const pe = row.period_end as string;
    byPeriod.set(pe, (byPeriod.get(pe) || 0) + Number(row.amount));
  });

  return Array.from(byPeriod.entries())
    .map(([periodEnd, income]) => ({ periodEnd, income }))
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
}

export async function getPeriodCoreIncome(
  supabase: SupabaseClient,
  userId: string,
  periodEnd: string
): Promise<number> {
  const incomes = await getTrailingCutoffIncomes(supabase, userId);
  return incomes.find((p) => p.periodEnd === periodEnd)?.income ?? 0;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function getLeanStatus(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<LeanStatus> {
  const periods = await getTrailingCutoffIncomes(supabase, userId, LEAN_WINDOW_PERIODS, now);

  const nowMs = now.getTime();
  const target = periods.find((p) => getPayoutDateForPeriodEnd(parseISO(p.periodEnd)).getTime() <= nowMs) ?? null;

  if (!target) {
    return {
      phase: "insufficient",
      targetPeriodEnd: null,
      targetIncome: 0,
      median: 0,
      ratio: null,
      threshold: LEAN_CUTOFF_THRESHOLD,
      periodsUsed: periods.length,
      windowPeriods: LEAN_WINDOW_PERIODS,
    };
  }

  if (periods.length < MIN_LEAN_PERIODS) {
    return {
      phase: "insufficient",
      targetPeriodEnd: target.periodEnd,
      targetIncome: target.income,
      median: 0,
      ratio: null,
      threshold: LEAN_CUTOFF_THRESHOLD,
      periodsUsed: periods.length,
      windowPeriods: LEAN_WINDOW_PERIODS,
    };
  }

  const window = periods.slice(0, LEAN_WINDOW_PERIODS);
  const median = medianOf(window.map((p) => p.income));
  const ratio = median > 0 ? target.income / median : 0;
  const phase = ratio < LEAN_CUTOFF_THRESHOLD ? "lean" : "normal";

  return {
    phase,
    targetPeriodEnd: target.periodEnd,
    targetIncome: target.income,
    median,
    ratio,
    threshold: LEAN_CUTOFF_THRESHOLD,
    periodsUsed: window.length,
    windowPeriods: LEAN_WINDOW_PERIODS,
  };
}