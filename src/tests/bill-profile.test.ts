import { describe, it, expect } from "vitest";
import { billProfile } from "@/lib/utils/bill-profile";
import type { Bill } from "@/lib/types";

const base = (over: Partial<Bill> = {}): Bill => ({
  id: "b1", user_id: "u1", name: "Rent", expected_amount: "12000", category_id: null,
  day_of_month: 1, active: true, notes: null, created_at: "x", updated_at: "x", ...over,
});

describe("billProfile", () => {
  it("reports the missing field for incomplete bills", () => {
    expect(billProfile(base({ expected_amount: null }))).toMatchObject({ ready: false, missing: ["amount"] });
    expect(billProfile(base({ day_of_month: null }))).toMatchObject({ ready: false, missing: ["day"] });
    expect(billProfile(base())).toMatchObject({ ready: true, missing: [] });
  });
  it("flags paused distinctly from incomplete", () => {
    expect(billProfile(base({ active: false }))).toMatchObject({ paused: true, ready: true });
    expect(billProfile(base({ active: false, expected_amount: null }))).toMatchObject({ paused: true, ready: false, missing: ["amount"] });
  });
});