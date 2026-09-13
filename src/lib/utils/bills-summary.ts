import type { SummaryVerdict } from "@/lib/types";

// Mirrors the V2 color-language band: comfortable while a bill load uses
// <=75% of remaining money (the app's BUDGET_THRESHOLDS.UNDER), tight up to
// 100%, short beyond. Uses only safeToSpend and the upcoming bill total.
export function classifySummaryVerdict(upcomingTotal: number, safeToSpend: number): SummaryVerdict {
  if (safeToSpend <= 0) return "short";
  if (upcomingTotal === 0) return "covered";
  const ratio = upcomingTotal / safeToSpend;
  if (ratio <= 0.75) return "covered";
  if (ratio <= 1) return "tight";
  return "short";
}