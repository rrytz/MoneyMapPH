import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFinancialTags } from "@/lib/cache/tags";
import { getMonthlySummary, getBudgetStatuses } from "@/lib/services/financial.service";
import { getSnapshots } from "@/lib/services/snapshot.service";
import { getExpenseCategories, getIncomeSources } from "@/lib/services/category.service";
import { getSavingsGoals } from "@/lib/services/goal.service";
import { getPaychecks } from "@/lib/services/paycheck.service";
import { getLeanStatus } from "@/lib/services/pay-period.service";
import { getSafeToSpend } from "@/lib/services/safe-to-spend.service";
import { getBillView, getBillsDueBy } from "@/lib/services/bills.service";
import { getDebts } from "@/lib/services/debt.service";
import { getMonthlyExpenseAggregation } from "@/lib/services/expense-aggregation.service";
import { getCutoffPeriodForDate } from "@/lib/utils/pay-period";
import { getManilaNow, toISODateString } from "@/lib/utils/date";
import type {
  MonthlySummary,
  BudgetStatus,
  SavingsGoal,
  Paycheck,
  MonthlySnapshot,
  ExpenseCategory,
  IncomeSource,
  LeanStatus,
  SafeToSpendStatus,
  BillView,
  BillsDueBy,
  DebtView,
  MonthlyExpenseAggregation,
} from "@/lib/types";

const REVALIDATE_SECONDS = 60;

export const cachedGetMonthlySummary = (
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<MonthlySummary> =>
  unstable_cache(
    async (m: number, y: number) => getMonthlySummary(supabase, userId, m, y),
    ["monthly-summary", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "summary") }
  )(month, year);

export const cachedGetBudgetStatuses = (
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<BudgetStatus[]> =>
  unstable_cache(
    async (m: number, y: number) => getBudgetStatuses(supabase, userId, m, y),
    ["budget-statuses", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "budgets") }
  )(month, year);

export const cachedGetMonthlyExpenseAggregation = (
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<MonthlyExpenseAggregation> =>
  unstable_cache(
    async (m: number, y: number) => getMonthlyExpenseAggregation(supabase, userId, m, y),
    ["expense-aggregation", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "summary") }
  )(month, year);

export const cachedGetSnapshots = (
  supabase: SupabaseClient,
  userId: string,
  months: number
): Promise<MonthlySnapshot[]> =>
  unstable_cache(
    async (cnt: number) => getSnapshots(supabase, userId, cnt),
    ["snapshots", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "snapshots") }
  )(months);

export const cachedGetExpenseCategories = (
  supabase: SupabaseClient,
  userId: string
): Promise<ExpenseCategory[]> =>
  unstable_cache(
    async () => getExpenseCategories(supabase, userId),
    ["expense-categories", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "categories") }
  )();

export const cachedGetIncomeSources = (
  supabase: SupabaseClient,
  userId: string
): Promise<IncomeSource[]> =>
  unstable_cache(
    async () => getIncomeSources(supabase, userId),
    ["income-sources", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "sources") }
  )();

export const cachedGetSavingsGoals = (
  supabase: SupabaseClient,
  userId: string
): Promise<SavingsGoal[]> =>
  unstable_cache(
    async () => getSavingsGoals(supabase, userId),
    ["savings-goals", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "goals") }
  )();

export const cachedGetDebts = (
  supabase: SupabaseClient,
  userId: string
): Promise<DebtView> =>
  unstable_cache(
    async () => getDebts(supabase, userId),
    ["debts", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "debts") }
  )();

export const cachedGetPaychecks = (
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<Paycheck[]> =>
  unstable_cache(
    async (m: number, y: number) => getPaychecks(supabase, userId, m, y),
    ["paychecks", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "paychecks") }
  )(month, year);

export const cachedGetLeanStatus = (
  supabase: SupabaseClient,
  userId: string
): Promise<LeanStatus> =>
  unstable_cache(
    async () => getLeanStatus(supabase, userId),
    ["lean-status", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "lean") }
  )();

export const cachedGetSafeToSpend = (
  supabase: SupabaseClient,
  userId: string,
  now: Date = getManilaNow()
): Promise<SafeToSpendStatus> => {
  const periodEnd = toISODateString(getCutoffPeriodForDate(now).periodEnd);
  return unstable_cache(
    async () => getSafeToSpend(supabase, userId, now),
    ["safe-to-spend", userId, periodEnd],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "safe-to-spend") }
  )();
};

export const cachedGetBillView = (
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number
): Promise<BillView> =>
  unstable_cache(
    async (y: number, m: number) => getBillView(supabase, userId, y, m),
    ["bill-view", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "bills") }
  )(year, month);

export const cachedGetBillsDueBy = (
  supabase: SupabaseClient,
  userId: string,
  fromDate: string,
  toDate: string
): Promise<BillsDueBy> =>
  unstable_cache(
    async (f: string, t: string) => getBillsDueBy(supabase, userId, f, t),
    ["bills-due-by", userId, fromDate, toDate],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "bills") }
  )(fromDate, toDate);