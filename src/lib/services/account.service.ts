import { SupabaseClient } from "@supabase/supabase-js";
import type { Account, AccountWithBalance, AccountFormData, UnassignedTotals } from "@/lib/types";
import { getManilaNow, toISODateString } from "@/lib/utils/date";

export async function getAccountsWithBalances(
  supabase: SupabaseClient,
  userId: string,
  includeArchived = false
): Promise<{ accounts: AccountWithBalance[]; unassigned: UnassignedTotals; totalLiquidity: number }> {
  const todayStr = toISODateString(getManilaNow());

  let accountsQuery = supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeArchived) {
    accountsQuery = accountsQuery.eq("is_archived", false);
  }

  const [{ data: accounts, error: accErr }, { data: aggregates, error: rpcErr }, { data: unassignedInc }, { data: unassignedExp }] =
    await Promise.all([
      accountsQuery,
      supabase.rpc("get_account_aggregates", { p_user_id: userId, p_today: todayStr }),
      supabase
        .from("income_entries")
        .select("amount")
        .eq("user_id", userId)
        .is("account_id", null)
        .lte("date", todayStr),
      supabase
        .from("expenses")
        .select("amount")
        .eq("user_id", userId)
        .is("account_id", null)
        .lte("date", todayStr),
    ]);

  if (accErr) throw accErr;
  if (rpcErr) throw rpcErr;

  const aggMap = new Map<string, { total_income: number; total_expenses: number; transfers_in: number; transfers_out: number; transfer_fees: number }>();
  (aggregates || []).forEach((row: any) => {
    aggMap.set(row.account_id, {
      total_income: Number(row.total_income) || 0,
      total_expenses: Number(row.total_expenses) || 0,
      transfers_in: Number(row.transfers_in) || 0,
      transfers_out: Number(row.transfers_out) || 0,
      transfer_fees: Number(row.transfer_fees) || 0,
    });
  });

  const accountsWithBalances: AccountWithBalance[] = (accounts || []).map((acc: Account) => {
    const agg = aggMap.get(acc.id) || {
      total_income: 0,
      total_expenses: 0,
      transfers_in: 0,
      transfers_out: 0,
      transfer_fees: 0,
    };
    const initBal = Number(acc.initial_balance) || 0;
    const current_balance = initBal + agg.total_income - agg.total_expenses + agg.transfers_in - agg.transfers_out - agg.transfer_fees;

    return {
      ...acc,
      current_balance,
      total_income: agg.total_income,
      total_expenses: agg.total_expenses,
      total_transfers_in: agg.transfers_in,
      total_transfers_out: agg.transfers_out,
      total_transfer_fees: agg.transfer_fees,
      is_negative: current_balance < 0,
    };
  });

  const totalLiquidity = accountsWithBalances
    .filter((a) => !a.is_archived)
    .reduce((sum, a) => sum + a.current_balance, 0);

  const unassignedIncome = (unassignedInc || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  const unassignedExpenses = (unassignedExp || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

  return {
    accounts: accountsWithBalances,
    unassigned: { unassignedIncome, unassignedExpenses },
    totalLiquidity,
  };
}

export async function createAccount(
  supabase: SupabaseClient,
  userId: string,
  data: AccountFormData
): Promise<Account> {
  if (data.initial_balance < 0) {
    throw new Error("Initial starting balance must be non-negative.");
  }

  const { data: created, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name: data.name,
      type: data.type,
      initial_balance: data.initial_balance,
      color: data.color || null,
      icon: data.icon || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return created as Account;
}

export async function updateAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  data: Partial<AccountFormData>
): Promise<Account> {
  if (data.initial_balance !== undefined && data.initial_balance < 0) {
    throw new Error("Initial starting balance must be non-negative.");
  }

  const { data: updated, error } = await supabase
    .from("accounts")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return updated as Account;
}

export async function archiveAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  isArchived: boolean
): Promise<Account> {
  const { data: updated, error } = await supabase
    .from("accounts")
    .update({
      is_archived: isArchived,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return updated as Account;
}
