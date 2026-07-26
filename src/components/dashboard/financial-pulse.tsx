"use client";

import { cn } from "@/lib/utils";

interface FinancialPulseProps {
  budgetUtilization: number;
}

export function FinancialPulse({ budgetUtilization }: FinancialPulseProps) {
  const pulseClass =
    budgetUtilization >= 100
      ? "financial-pulse-danger"
      : budgetUtilization >= 75
        ? "financial-pulse-caution"
        : "financial-pulse-healthy";

  return <div className={cn("financial-pulse w-full", pulseClass)} />;
}
