import type { FinancialHealthReport } from "@/lib/types";

export function getHealthHeroMessage(score: number, grade: FinancialHealthReport["grade"]): string {
  switch (grade) {
    case "Excellent":
      return "Strong habits — keep tracking your income and building your buffers.";
    case "Good":
      return "Solid progress — closing the small gaps will take you further.";
    case "Fair":
      return "Good pace — tightening one area at a time will lift your score.";
    case "Critical":
      return "This is a starting point — small, consistent steps this pay period will build momentum.";
  }
}