import type { SupabaseClient } from "@supabase/supabase-js";
import type { Debt, DebtPayment, DebtView } from "@/lib/types";

export type DebtInput = {
  name: string;
  total_amount: number;
  due_date: string;
  category_id?: string | null;
  notes?: string | null;
};

export async function getDebts(supabase: SupabaseClient, userId: string): Promise<DebtView> {
  const { data: debts, error: e1 } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });
  if (e1) throw e1;

  const list = (debts || []) as Debt[];
  let payments: DebtPayment[] = [];
  if (list.length > 0) {
    const { data: all, error: e2 } = await supabase
      .from("debt_payments")
      .select("*")
      .in(
        "debt_id",
        list.map((d) => d.id)
      )
      .order("paid_at", { ascending: true });
    if (e2) throw e2;
    payments = (all || []) as DebtPayment[];
  }

  return { debts: list, payments };
}

export async function createDebt(
  supabase: SupabaseClient,
  userId: string,
  input: DebtInput
): Promise<Debt> {
  const { data, error } = await supabase
    .from("debts")
    .insert({
      user_id: userId,
      name: input.name,
      total_amount: input.total_amount,
      due_date: input.due_date,
      category_id: input.category_id ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Debt;
}

export async function updateDebt(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<DebtInput>
): Promise<Debt> {
  if (patch.total_amount !== undefined) {
    const { data: payments, error } = await supabase
      .from("debt_payments")
      .select("amount")
      .eq("debt_id", id);
    if (error) throw error;
    const paid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    if (patch.total_amount < paid) throw new Error("TOTAL_BELOW_PAID");
  }

  const { data, error } = await supabase
    .from("debts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data as Debt;
}

export async function deleteDebt(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase.from("debts").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function getDebtPayment(
  supabase: SupabaseClient,
  userId: string,
  paymentId: string
): Promise<DebtPayment | null> {
  const { data: payment, error } = await supabase
    .from("debt_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  if (!payment) return null;

  const { data: debt } = await supabase
    .from("debts")
    .select("id")
    .eq("id", (payment as DebtPayment).debt_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!debt) return null;

  return payment as DebtPayment;
}