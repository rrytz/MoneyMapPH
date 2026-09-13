import { describe, it, expect, vi, beforeEach } from "vitest";

// Validate schema behavior that actions depend on (no server env in unit tests).
import { billInputSchema, payBillSchema } from "@/lib/utils/validators";

describe("bill action schemas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("billInputSchema accepts partial template and full ready bill", () => {
    const partial = billInputSchema.parse({ name: "SSS Contribution" });
    expect(partial.day_of_month).toBeUndefined();
    const ready = billInputSchema.parse({ name: "Rent", expected_amount: "12000", day_of_month: 1 });
    expect(ready.expected_amount).toBe(12000);
  });

  it("payBillSchema rejects zero amount and accepts empty optional category", () => {
    expect(() =>
      payBillSchema.parse({ billId: "11111111-1111-4111-8111-111111111111", dueDate: "2026-09-15", paidAt: "2026-09-15", amount: 0 })
    ).toThrow();
    const ok = payBillSchema.parse({
      billId: "11111111-1111-4111-8111-111111111111",
      dueDate: "2026-09-15",
      paidAt: "2026-09-15",
      amount: "3400",
      categoryId: "",
    });
    expect(ok.amount).toBe(3400);
  });
});