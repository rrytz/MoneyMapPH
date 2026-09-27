import { describe, it, expect } from "vitest";
import { billProfile } from "@/lib/utils/bill-profile";
import type { Bill } from "@/lib/types";

const base = (over: Partial<Bill> = {}): Bill => ({
  id: "b1", user_id: "u1", name: "Rent", expected_amount: "12000", category_id: null,
  day_of_month: 1, due_date: null, active: true, notes: null, created_at: "x", updated_at: "x", ...over,
});

describe("billProfile", () => {
  it("reports the missing field for incomplete bills", () => {
    expect(billProfile(base({ expected_amount: null }))).toMatchObject({ ready: false, missing: ["amount"] });
    // No day AND no date is an unfilled template: genuinely missing a schedule.
    expect(billProfile(base({ day_of_month: null }))).toMatchObject({ ready: false, missing: ["day"] });
    expect(billProfile(base())).toMatchObject({ ready: true, missing: [] });
  });
  it("treats a one-time bill as scheduled, not as missing a day", () => {
    // The regression this slice exists to prevent: a fully-configured one-time
    // bill was reported Incomplete - "Set day to activate" - while being on the
    // money surfaces and payable. It has no day, and never will.
    const oneTime = base({ day_of_month: null, due_date: "2026-10-05" });
    expect(billProfile(oneTime)).toMatchObject({ ready: true, missing: [], label: null });
    // Still needs an amount, whichever kind it is.
    expect(billProfile(base({ day_of_month: null, due_date: "2026-10-05", expected_amount: null })))
      .toMatchObject({ ready: false, missing: ["amount"] });
    // ...and pause is still distinct from incomplete for a one-time bill.
    expect(billProfile(base({ day_of_month: null, due_date: "2026-10-05", active: false })))
      .toMatchObject({ paused: true, ready: true, label: "Paused" });
  });
  it("flags paused distinctly from incomplete", () => {
    expect(billProfile(base({ active: false }))).toMatchObject({ paused: true, ready: true });
    expect(billProfile(base({ active: false, expected_amount: null }))).toMatchObject({ paused: true, ready: false, missing: ["amount"] });
  });
});