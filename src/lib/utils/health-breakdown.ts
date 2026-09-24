import type { FinancialHealthReport } from "@/lib/types";

/** Raw savings-rate label kept on the KPI card (percent of income saved). */
export const SAVINGS_RATE_LABEL = "Savings Rate";

type Breakdown = FinancialHealthReport["breakdown"];

export interface HealthScoreComponent {
  key: keyof Breakdown;
  label: string;
  pct: number;
}

const SCORE_LABELS: Record<keyof Breakdown, string> = {
  emergencyFundScore: "Emergency Score",
  savingsRateScore: "Savings Score",
  budgetAdherenceScore: "Budget Score",
  paycheckAllocationScore: "Paycheck Score",
};

const SCORE_MAX: Record<keyof Breakdown, number> = {
  emergencyFundScore: 30,
  savingsRateScore: 30,
  budgetAdherenceScore: 20,
  paycheckAllocationScore: 20,
};

/**
 * Shared derivation for the Financial Health score components.
 * Returns one labeled component per breakdown key with the same
 * pct math the hero used inline (`round(score / max * 100)`).
 * Labels end in "Score" so they can never collide with the raw
 * "Savings Rate" figure shown on the KPI card.
 */
export function getHealthScoreBreakdown(breakdown: Breakdown): HealthScoreComponent[] {
  return (Object.keys(SCORE_LABELS) as Array<keyof Breakdown>).map((key) => ({
    key,
    label: SCORE_LABELS[key],
    pct: Math.round((breakdown[key] / SCORE_MAX[key]) * 100),
  }));
}