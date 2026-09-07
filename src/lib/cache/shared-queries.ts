import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMonthlySummary, getBudgetStatuses } from "@/lib/services/financial.service";
import { getSnapshots } from "@/lib/services/snapshot.service";
import { getExpenseCategories, getIncomeSources } from "@/lib/services/category.service";
import { getSavingsGoals } from "@/lib/services/goal.service";
import { getPaychecks } from "@/lib/services/paycheck.service";
import type {
  MonthlySummary,
  BudgetStatus,
  SavingsGoal,
  Paycheck,
  MonthlySnapshot,
  ExpenseCategory,
  IncomeSource,
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
    { revalidate: REVALIDATE_SECONDS, tags: [`q:summary:${userId}`, "q:financial"] }
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
    { revalidate: REVALIDATE_SECONDS, tags: [`q:budgets:${userId}`, "q:financial"] }
  )(month, year);

export const cachedGetSnapshots = (
  supabase: SupabaseClient,
  userId: string,
  months: number
): Promise<MonthlySnapshot[]> =>
  unstable_cache(
    async (cnt: number) => getSnapshots(supabase, userId, cnt),
    ["snapshots", userId],
    { revalidate: REVALIDATE_SECONDS, tags: [`q:snapshots:${userId}`, "q:financial"] }
  )(months);

export const cachedGetExpenseCategories = (
  supabase: SupabaseClient,
  userId: string
): Promise<ExpenseCategory[]> =>
  unstable_cache(
    async () => getExpenseCategories(supabase, userId),
    ["expense-categories", userId],
    { revalidate: REVALIDATE_SECONDS, tags: [`q:categories:${userId}`] }
  )();

export const cachedGetIncomeSources = (
  supabase: SupabaseClient,
  userId: string
): Promise<IncomeSource[]> =>
  unstable_cache(
    async () => getIncomeSources(supabase, userId),
    ["income-sources", userId],
    { revalidate: REVALIDATE_SECONDS, tags: [`q:sources:${userId}`] }
  )();

export const cachedGetSavingsGoals = (
  supabase: SupabaseClient,
  userId: string
): Promise<SavingsGoal[]> =>
  unstable_cache(
    async () => getSavingsGoals(supabase, userId),
    ["savings-goals", userId],
    { revalidate: REVALIDATE_SECONDS, tags: [`q:goals:${userId}`, "q:financial"] }
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
    { revalidate: REVALIDATE_SECONDS, tags: [`q:paychecks:${userId}`, "q:financial"] }
  )(month, year);