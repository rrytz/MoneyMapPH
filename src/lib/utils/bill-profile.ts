import type { Bill } from "@/lib/types";

export type BillProfile = {
  ready: boolean;
  missing: Array<"amount" | "day">;
  paused: boolean;
  label: "Incomplete" | "Paused" | null;
};

export function billProfile(bill: Bill): BillProfile {
  const missing: BillProfile["missing"] = [];
  if (bill.expected_amount == null) missing.push("amount");
  if (bill.day_of_month == null) missing.push("day");
  const ready = missing.length === 0;
  const paused = !bill.active;
  return {
    ready,
    missing,
    paused,
    label: !ready ? "Incomplete" : paused ? "Paused" : null,
  };
}