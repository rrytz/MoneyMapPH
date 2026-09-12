import { SupabaseClient } from "@supabase/supabase-js";
import { getCutoffPeriodForDate, getPeriodProgress } from "@/lib/utils/pay-period";
import { toISODateString } from "@/lib/utils/date";
import type { SafeToSpendStatus } from "@/lib/types";

export async function getSafeToSpend(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<SafeToSpendStatus> {
  const current = getCutoffPeriodForDate(now);
  const periodStartISO = toISODateString(current.periodStart);
  const periodEndISO = toISODateString(current.periodEnd);

  const [pcRes, srcRes, enRes, exRes] = await Promise.all([
    supabase
      .from("paychecks")
      .select("id, period_end, date, amount")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(50),
    supabase.from("income_sources").select("id, type").eq("user_id", userId),
    supabase
      .from("income_entries")
      .select("id, source_id, amount, date")
      .eq("user_id", userId)
      .gte("date", periodStartISO)
      .lte("date", periodEndISO),
    supabase
      .from("expenses")
      .select("id, amount, date")
      .eq("user_id", userId)
      .gte("date", periodStartISO)
      .lte("date", periodEndISO),
  ]);

  if (pcRes.error) throw pcRes.error;
  if (srcRes.error) throw srcRes.error;
  if (enRes.error) throw enRes.error;
  if (exRes.error) throw exRes.error;

  const incentiveIds = new Set(
    (srcRes.data || []).filter((s) => s.type === "incentive").map((s) => s.id)
  );

  const coreIncome = (pcRes.data || []).reduce((sum, r) => {
    const inPeriod =
      r.period_end != null
        ? r.period_end === periodEndISO
        : r.date >= periodStartISO && r.date <= periodEndISO;
    return inPeriod ? sum + Number(r.amount) : sum;
  }, 0);

  const incentiveIncomeLogged = (enRes.data || []).reduce(
    (sum, r) => (incentiveIds.has(r.source_id as string) ? sum + Number(r.amount) : sum),
    0
  );

  const spentThisPeriod = (exRes.data || []).reduce((sum, r) => sum + Number(r.amount), 0);

  const progress = getPeriodProgress(current.periodEnd, now);

  return {
    periodStart: periodStartISO,
    periodEnd: periodEndISO,
    payoutDate: toISODateString(current.payoutDate),
    coreIncome,
    incentiveIncomeLogged,
    spentThisPeriod,
    safeToSpend: coreIncome + incentiveIncomeLogged - spentThisPeriod,
    hasPaychecks: (pcRes.data || []).length > 0,
    daysTotal: progress.daysTotal,
    daysElapsed: progress.daysElapsed,
    daysRemaining: progress.daysRemaining,
    fractionElapsed: progress.fractionElapsed,
  };
}