"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAccount, updateAccount, archiveAccount } from "@/lib/services/account.service";
import { createTransfer, updateTransfer, deleteTransfer } from "@/lib/services/transfer.service";
import { accountSchema, accountTransferSchema } from "@/lib/utils/validators";

export async function addAccount(formData: {
  name: string;
  type: "bank" | "ewallet" | "cash" | "digital_bank" | "credit";
  initial_balance: number;
  color?: string;
  icon?: string;
}) {
  const parsed = accountSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createAccount(supabase, user.id, parsed.data);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to add account:", err);
    return { success: false, error: err?.message || "Unable to save account. Please try again." };
  }
}

export async function editAccount(
  accountId: string,
  formData: {
    name: string;
    type: "bank" | "ewallet" | "cash" | "digital_bank" | "credit";
    initial_balance: number;
    color?: string;
    icon?: string;
  }
) {
  const parsed = accountSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateAccount(supabase, user.id, accountId, parsed.data);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to edit account:", err);
    return { success: false, error: err?.message || "Unable to update account. Please try again." };
  }
}

export async function toggleArchiveAccount(accountId: string, isArchived: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await archiveAccount(supabase, user.id, accountId, isArchived);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to toggle archive status:", err);
    return { success: false, error: err?.message || "Unable to update archive status." };
  }
}

export async function addTransfer(formData: {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_fee?: number;
  date: string;
  notes?: string;
}) {
  const parsed = accountTransferSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createTransfer(supabase, user.id, parsed.data);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to create transfer:", err);
    return { success: false, error: err?.message || "Unable to complete transfer. Please try again." };
  }
}

export async function editTransfer(
  transferId: string,
  formData: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    transfer_fee?: number;
    date: string;
    notes?: string;
  }
) {
  const parsed = accountTransferSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateTransfer(supabase, user.id, transferId, parsed.data);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to update transfer:", err);
    return { success: false, error: err?.message || "Unable to update transfer. Please try again." };
  }
}

export async function removeTransfer(transferId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deleteTransfer(supabase, user.id, transferId);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to delete transfer:", err);
    return { success: false, error: err?.message || "Unable to delete transfer. Please try again." };
  }
}
