"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  addGoalContribution,
} from "@/lib/services/goal.service";
import {
  createDebt,
  updateDebt,
  deleteDebt,
  getDebtPayment,
} from "@/lib/services/debt.service";
import { generateSnapshot } from "@/lib/services/snapshot.service";
import { revalidateUserFinancialCache } from "@/lib/cache/tags";
import {
  savingsGoalSchema,
  contributionSchema,
  debtInputSchema,
  payDebtSchema,
  unpayDebtSchema,
  type DebtInputSchemaType,
  type PayDebtSchemaType,
  type UnpayDebtSchemaType,
} from "@/lib/utils/validators";

export async function addGoal(formData: {
  name: string;
  target_amount: number;
  target_date?: string;
  notes?: string;
  is_emergency_fund?: boolean;
}) {
  const parsed = savingsGoalSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createSavingsGoal(supabase, user.id, parsed.data);
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to create savings goal:", err);
    return { success: false, error: "Unable to create savings goal. Please verify your inputs." };
  }
}

export async function editGoal(
  goalId: string,
  formData: {
    name: string;
    target_amount: number;
    target_date?: string;
    notes?: string;
    is_emergency_fund?: boolean;
  }
) {
  const parsed = savingsGoalSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateSavingsGoal(supabase, user.id, goalId, parsed.data);
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to update savings goal:", err);
    return { success: false, error: "Unable to update savings goal. Please try again." };
  }
}

export async function removeGoal(goalId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deleteSavingsGoal(supabase, user.id, goalId);
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete savings goal:", err);
    return { success: false, error: "Unable to delete savings goal. Please try again." };
  }
}

export async function recordContribution(
  goalId: string,
  formData: {
    amount: number;
    date: string;
    notes?: string;
    category_id: string;
  },
  goalName: string
) {
  const parsed = contributionSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await addGoalContribution(supabase, user.id, goalId, {
      amount: parsed.data.amount,
      date: parsed.data.date,
      notes: parsed.data.notes,
      categoryId: parsed.data.category_id,
      title: `Contribution to ${goalName}`,
    });
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/expenses");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to record contribution:", err);
    return { success: false, error: "Unable to record contribution. Please verify the target goal and category." };
  }
}

export async function addDebt(formData: DebtInputSchemaType) {
  const parsed = debtInputSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createDebt(supabase, user.id, {
      name: parsed.data.name,
      total_amount: parsed.data.total_amount,
      due_date: parsed.data.due_date,
      category_id: parsed.data.category_id || null,
      notes: parsed.data.notes || null,
    });
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to create debt:", err);
    return { error: "Unable to create debt. Please verify your inputs." };
  }
}

export async function editDebt(debtId: string, formData: DebtInputSchemaType) {
  const parsed = debtInputSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateDebt(supabase, user.id, debtId, {
      name: parsed.data.name,
      total_amount: parsed.data.total_amount,
      due_date: parsed.data.due_date,
      category_id: parsed.data.category_id || null,
      notes: parsed.data.notes || null,
    });
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to update debt:", err);
    const message =
      err instanceof Error && err.message === "TOTAL_BELOW_PAID"
        ? "Total amount can't be less than what's already paid off."
        : "Unable to update debt. Please try again.";
    return { error: message };
  }
}

export async function removeDebt(debtId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deleteDebt(supabase, user.id, debtId);
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete debt:", err);
    return { error: "Unable to delete debt. Please try again." };
  }
}

export async function payDebt(formData: PayDebtSchemaType) {
  const parsed = payDebtSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const { error } = await supabase.rpc("pay_debt", {
      p_debt_id: parsed.data.debtId,
      p_paid_at: parsed.data.paidAt,
      p_category_id: parsed.data.categoryId || null,
      p_amount: parsed.data.amount,
      p_notes: parsed.data.notes || null,
    });
    if (error) {
      if (error.message.includes("amount_exceeds_remaining")) return { error: "Payment exceeds the remaining balance." };
      if (error.message.includes("debt_not_found")) return { error: "Debt not found." };
      if (error.message.includes("amount_invalid")) return { error: "Payment amount must be greater than 0." };
      if (error.message.includes("category_required")) return { error: "Pick an expense category." };
      return { error: "Could not log payment. Please try again." };
    }

    const [yr, mo] = parsed.data.paidAt.split("-").map(Number);
    await generateSnapshot(supabase, user.id, mo, yr);
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/budgets");
    revalidatePath("/transactions");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to log debt payment:", err);
    return { error: "Unable to log payment. Please try again." };
  }
}

export async function unpayDebt(input: UnpayDebtSchemaType) {
  const parsed = unpayDebtSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid payment" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const payment = await getDebtPayment(supabase, user.id, parsed.data.paymentId);
    if (!payment) return { error: "Payment not found." };

    const [yr, mo] = payment.paid_at.split("-").map(Number);
    const { error } = await supabase.rpc("unpay_debt", { p_payment_id: parsed.data.paymentId });
    if (error) {
      if (error.message.includes("payment_not_found")) return { error: "Payment not found." };
      return { error: "Could not undo payment. Please try again." };
    }

    await generateSnapshot(supabase, user.id, mo, yr);
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/budgets");
    revalidatePath("/transactions");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to undo debt payment:", err);
    return { error: "Unable to undo payment. Please try again." };
  }
}
