import { SupabaseClient } from "@supabase/supabase-js";
import type { SimulatedPurchase, SimulatedPurchaseFormData, SavingsGoal } from "@/lib/types";
import type { EmergencyFundStatus } from "./forecast.service";

export async function getSimulatedPurchases(
  supabase: SupabaseClient,
  userId: string
): Promise<SimulatedPurchase[]> {
  const { data, error } = await supabase
    .from("simulated_purchases")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as SimulatedPurchase[];
}

export async function createSimulatedPurchase(
  supabase: SupabaseClient,
  userId: string,
  data: SimulatedPurchaseFormData
): Promise<SimulatedPurchase> {
  const { data: inserted, error } = await supabase
    .from("simulated_purchases")
    .insert({
      user_id: userId,
      name: data.name,
      amount: data.amount,
      target_date: data.target_date || null,
      notes: data.notes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return inserted as SimulatedPurchase;
}

export async function deleteSimulatedPurchase(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("simulated_purchases")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

export interface PurchaseImpact {
  purchaseAmount: number;
  emergencyFundImpact: {
    beforeBalance: number;
    afterBalance: number;
    beforeMonthsCovered: number;
    afterMonthsCovered: number;
    beforeStatus: string;
    afterStatus: string;
    isSeverelyImpacted: boolean;
  };
  goalsImpact: Array<{
    id: string;
    name: string;
    beforeMonthsToReach: number | "infinite";
    afterMonthsToReach: number | "infinite";
    delayMonths: number | "infinite";
  }>;
}

export function calculatePurchaseImpact(
  purchaseAmount: number,
  emergencyStatus: EmergencyFundStatus,
  savingsGoals: SavingsGoal[],
  monthlyNetSavings: number
): PurchaseImpact {
  // 1. Calculate Emergency Fund Impact
  const beforeBalance = emergencyStatus.currentBalance;
  const afterBalance = Math.max(0, beforeBalance - purchaseAmount);
  const averageExpenses = emergencyStatus.averageExpenses;
  
  const beforeMonthsCovered = emergencyStatus.monthsCovered;
  const afterMonthsCovered = averageExpenses > 0 ? afterBalance / averageExpenses : 0;
  
  let afterStatus = emergencyStatus.status;
  if (emergencyStatus.hasFund) {
    if (afterMonthsCovered >= 6) {
      afterStatus = "adequate";
    } else if (afterMonthsCovered >= 3) {
      afterStatus = "warning";
    } else {
      afterStatus = "critical";
    }
  }

  const isSeverelyImpacted = emergencyStatus.hasFund && 
    (emergencyStatus.status === "adequate" || emergencyStatus.status === "warning") &&
    afterStatus === "critical";

  // 2. Calculate Goals Timeline Impact
  // Redirection of savings capacity: if the purchase is funded out of savings, it delays savings targets
  const delayMonths: number | "infinite" = monthlyNetSavings > 0 ? Math.ceil(purchaseAmount / monthlyNetSavings) : "infinite";

  const goalsImpact = savingsGoals.map((goal) => {
    const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
    
    let beforeMonthsToReach: number | "infinite" = "infinite";
    if (remaining === 0) {
      beforeMonthsToReach = 0;
    } else if (monthlyNetSavings > 0) {
      beforeMonthsToReach = Math.ceil(remaining / monthlyNetSavings);
    }

    let afterMonthsToReach: number | "infinite" = "infinite";
    if (remaining === 0) {
      afterMonthsToReach = 0;
    } else if (beforeMonthsToReach !== "infinite" && delayMonths !== "infinite") {
      afterMonthsToReach = beforeMonthsToReach + delayMonths;
    }

    return {
      id: goal.id,
      name: goal.name,
      beforeMonthsToReach,
      afterMonthsToReach,
      delayMonths,
    };
  });

  return {
    purchaseAmount,
    emergencyFundImpact: {
      beforeBalance,
      afterBalance: Math.round(afterBalance * 100) / 100,
      beforeMonthsCovered,
      afterMonthsCovered: Math.round(afterMonthsCovered * 100) / 100,
      beforeStatus: emergencyStatus.status,
      afterStatus,
      isSeverelyImpacted,
    },
    goalsImpact,
  };
}
