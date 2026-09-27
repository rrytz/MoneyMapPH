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
  // "Missing a day" has to mean "missing a SCHEDULE", not "day_of_month is
  // null". A one-time bill has no day by design - it has a date - so testing
  // day_of_month alone reported every one-time bill as Incomplete and told the
  // user to set a day it will never have, while the same bill sat on the money
  // surfaces and was perfectly payable. The profile and the eligibility check
  // disagreed about the same bill on the same screen.
  if (bill.due_date == null && bill.day_of_month == null) missing.push("day");
  const ready = missing.length === 0;
  const paused = !bill.active;
  return {
    ready,
    missing,
    paused,
    label: !ready ? "Incomplete" : paused ? "Paused" : null,
  };
}