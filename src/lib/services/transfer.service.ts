import { SupabaseClient } from "@supabase/supabase-js";
import type { AccountTransfer, AccountTransferFormData } from "@/lib/types";

export async function createTransfer(
  supabase: SupabaseClient,
  userId: string,
  data: AccountTransferFormData
): Promise<AccountTransfer> {
  if (data.from_account_id === data.to_account_id) {
    throw new Error("Source and destination accounts must be different.");
  }
  if (data.amount <= 0) {
    throw new Error("Transfer amount must be greater than zero.");
  }
  const fee = data.transfer_fee || 0;
  if (fee < 0) {
    throw new Error("Transfer fee cannot be negative.");
  }

  // Verify accounts belong to user and are not archived
  const { data: accounts, error: accErr } = await supabase
    .from("accounts")
    .select("id, is_archived")
    .eq("user_id", userId)
    .in("id", [data.from_account_id, data.to_account_id]);

  if (accErr) throw accErr;
  if (!accounts || accounts.length < 2) {
    throw new Error("One or both accounts do not exist or belong to another user.");
  }
  if (accounts.some((a) => a.is_archived)) {
    throw new Error("Transfers cannot be performed on archived accounts.");
  }

  const { data: created, error } = await supabase
    .from("account_transfers")
    .insert({
      user_id: userId,
      from_account_id: data.from_account_id,
      to_account_id: data.to_account_id,
      amount: data.amount,
      transfer_fee: fee,
      date: data.date,
      notes: data.notes || null,
    })
    .select("*, from_account:accounts!from_account_id(*), to_account:accounts!to_account_id(*)")
    .single();

  if (error) throw error;
  return created as AccountTransfer;
}

export async function updateTransfer(
  supabase: SupabaseClient,
  userId: string,
  transferId: string,
  data: Partial<AccountTransferFormData>
): Promise<AccountTransfer> {
  if (data.from_account_id && data.to_account_id && data.from_account_id === data.to_account_id) {
    throw new Error("Source and destination accounts must be different.");
  }
  if (data.amount !== undefined && data.amount <= 0) {
    throw new Error("Transfer amount must be greater than zero.");
  }
  if (data.transfer_fee !== undefined && data.transfer_fee < 0) {
    throw new Error("Transfer fee cannot be negative.");
  }

  const { data: updated, error } = await supabase
    .from("account_transfers")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transferId)
    .eq("user_id", userId)
    .select("*, from_account:accounts!from_account_id(*), to_account:accounts!to_account_id(*)")
    .single();

  if (error) throw error;
  return updated as AccountTransfer;
}

export async function deleteTransfer(
  supabase: SupabaseClient,
  userId: string,
  transferId: string
): Promise<void> {
  const { error } = await supabase
    .from("account_transfers")
    .delete()
    .eq("id", transferId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getTransfers(
  supabase: SupabaseClient,
  userId: string,
  options?: { accountId?: string; limit?: number }
): Promise<AccountTransfer[]> {
  let query = supabase
    .from("account_transfers")
    .select("*, from_account:accounts!from_account_id(*), to_account:accounts!to_account_id(*)")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.accountId) {
    query = query.or(`from_account_id.eq.${options.accountId},to_account_id.eq.${options.accountId}`);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AccountTransfer[];
}
