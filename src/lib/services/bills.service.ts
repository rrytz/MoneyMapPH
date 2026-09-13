import { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonth, endOfMonth } from "date-fns";
import { Bill, BillPayment, BillView, BillsDueBy } from "@/lib/types";
import { listBillOccurrences } from "@/lib/utils/bills";

export type BillInput = {
  name: string;
  expected_amount?: string | null;
  category_id?: string | null;
  day_of_month?: number | null;
  notes?: string | null;
  active?: boolean;
};

export async function getBills(supabase: SupabaseClient, userId: string): Promise<Bill[]> {
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("user_id", userId)
    .order("day_of_month", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []) as Bill[];
}

export async function createBill(
  supabase: SupabaseClient,
  userId: string,
  input: BillInput
): Promise<Bill> {
  const { data, error } = await supabase
    .from("bills")
    .insert({
      user_id: userId,
      name: input.name,
      expected_amount: input.expected_amount ?? null,
      category_id: input.category_id ?? null,
      day_of_month: input.day_of_month ?? null,
      notes: input.notes ?? null,
      active: input.active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Bill;
}

export async function updateBill(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: Partial<BillInput>
): Promise<Bill> {
  const { data, error } = await supabase
    .from("bills")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data as Bill;
}

export async function deleteBill(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase.from("bills").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function getBillView(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number
): Promise<BillView> {
  const from = startOfMonth(new Date(year, month - 1, 1));
  const to = endOfMonth(new Date(year, month - 1, 1));
  const bills = await getBills(supabase, userId);

  const { data: payments, error } = await supabase
    .from("bill_payments")
    .select("*")
    .in(
      "bill_id",
      bills.length > 0 ? bills.map((b) => b.id) : ["00000000-0000-0000-0000-000000000000"]
    );
  if (error) throw error;

  return {
    bills,
    occurrences: listBillOccurrences(bills, from, to),
    payments: (payments || []) as BillPayment[],
  };
}

function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function getBillsDueBy(
  supabase: SupabaseClient,
  userId: string,
  fromDate: string,
  toDate: string
): Promise<BillsDueBy> {
  const bills = await getBills(supabase, userId);
  const from = isoToLocalDate(fromDate);
  const to = isoToLocalDate(toDate);

  let payments: BillPayment[] = [];
  if (bills.length > 0) {
    const { data, error } = await supabase
      .from("bill_payments")
      .select("*")
      .in(
        "bill_id",
        bills.map((b) => b.id)
      );
    if (error) throw error;
    payments = (data || []) as BillPayment[];
  }

  const paid = new Set(payments.map((p) => `${p.bill_id}|${p.due_date}`));
  const occurrences = listBillOccurrences(bills, from, to).filter(
    (o) => !paid.has(`${o.bill_id}|${o.dueDate}`)
  );

  const paidTotal = payments
    .filter((p) => p.due_date >= fromDate && p.due_date <= toDate)
    .reduce((s, p) => s + Number(p.amount), 0);
  const upcomingTotal = occurrences.reduce((s, o) => s + o.expectedAmount, 0);
  return { occurrences, paidTotal, upcomingTotal, totalDue: paidTotal + upcomingTotal, horizonDate: toDate };
}