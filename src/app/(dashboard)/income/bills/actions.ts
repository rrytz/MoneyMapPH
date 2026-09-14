"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { billInputSchema, payBillSchema, unpayBillSchema } from "@/lib/utils/validators";
import { createBill, updateBill, deleteBill } from "@/lib/services/bills.service";
import { revalidateUserFinancialCache } from "@/lib/cache/tags";

type ActionResult = { error?: string };

export async function payBill(input: z.infer<typeof payBillSchema>): Promise<ActionResult> {
  const parsed = payBillSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid payment details" };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.rpc("pay_bill", {
    p_bill_id: parsed.data.billId,
    p_due_date: parsed.data.dueDate,
    p_paid_at: parsed.data.paidAt,
    p_category_id: parsed.data.categoryId || null,
    p_amount: parsed.data.amount,
    p_notes: parsed.data.notes || null,
  });
  if (error) {
    if (error.message.includes("bill_not_ready")) return { error: "This bill is paused or incomplete." };
    if (error.message.includes("duplicate") || error.code === "23505") return { error: "This occurrence is already paid." };
    return { error: "Could not log payment. Please try again." };
  }

  revalidateUserFinancialCache(user.id);
  revalidatePath("/income");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return {};
}

export async function unpayBill(input: z.infer<typeof unpayBillSchema>): Promise<ActionResult> {
  const parsed = unpayBillSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid payment" };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.rpc("unpay_bill", { p_payment_id: parsed.data.paymentId });
  if (error) return { error: "Could not undo payment. Please try again." };

  revalidateUserFinancialCache(user.id);
  revalidatePath("/income");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return {};
}

export async function createBillAction(input: z.infer<typeof billInputSchema>): Promise<ActionResult> {
  const parsed = billInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid bill" };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  const dayOfMonth = parsed.data.day_of_month === "" ? null : parsed.data.day_of_month;

  try {
    await createBill(supabase, user.id, {
      name: parsed.data.name,
      expected_amount: parsed.data.expected_amount ? String(parsed.data.expected_amount) : null,
      category_id: parsed.data.category_id || null,
      day_of_month: dayOfMonth,
      notes: parsed.data.notes || null,
    });
  } catch {
    return { error: "Could not create bill" };
  }

  revalidateUserFinancialCache(user.id);
  revalidatePath("/income");
  revalidatePath("/dashboard");
  return {};
}

export async function updateBillAction(
  input: z.infer<typeof billInputSchema> & { id: string; active?: boolean }
): Promise<ActionResult> {
  const parsed = billInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid bill" };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  try {
    const patch = {
      name: parsed.data.name,
      expected_amount: parsed.data.expected_amount ? String(parsed.data.expected_amount) : null,
      category_id: parsed.data.category_id || null,
      day_of_month: parsed.data.day_of_month === "" ? null : parsed.data.day_of_month,
      notes: parsed.data.notes || null,
      ...(input.active !== undefined ? { active: input.active } : {}),
    };
    await updateBill(supabase, user.id, input.id, patch);
  } catch {
    return { error: "Could not save bill" };
  }

  revalidateUserFinancialCache(user.id);
  revalidatePath("/income");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteBillAction(input: { id: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  try {
    await deleteBill(supabase, user.id, input.id);
  } catch {
    return { error: "Could not delete bill" };
  }

  revalidateUserFinancialCache(user.id);
  revalidatePath("/income");
  revalidatePath("/dashboard");
  return {};
}