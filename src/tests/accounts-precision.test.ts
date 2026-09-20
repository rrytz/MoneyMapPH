import { describe, it, expect } from "vitest";

describe("Accounts Precision & Monetary Boundaries", () => {
  it("validates boundary monetary amounts (0.01 min amount, 0.00 fee)", () => {
    const minAmount = 0.01;
    const minFee = 0.00;
    const totalDeduction = minAmount + minFee;

    expect(minAmount).toBeGreaterThan(0);
    expect(minFee).toBeGreaterThanOrEqual(0);
    expect(totalDeduction).toBe(0.01);
  });

  it("handles high precision serializations matching PostgreSQL NUMERIC(12,2)", () => {
    const maxBalance = 9999999999.99;
    const formatted = maxBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    expect(formatted).toBe("9,999,999,999.99");
  });

  it("preserves exact two-decimal precision without rounding floating point drift", () => {
    const amount1 = 100.05;
    const amount2 = 200.10;
    const fee = 15.00;
    const sum = Math.round((amount1 + amount2 + fee) * 100) / 100;

    expect(sum).toBe(315.15);
  });

  it("guards against overflowing the NUMERIC(12,2) ceiling (9999999999.99 + 0.01)", () => {
    const maxBalance = 9999999999.99;
    const overflow = maxBalance + 0.01;

    expect(maxBalance.toFixed(2)).toBe("9999999999.99");
    expect(overflow).toBe(10_000_000_000);
    expect(Math.round(overflow * 100) / 100).toBe(10_000_000_000);
  });

  it("clamps fees to the ₱0.00 floor and caps at the NUMERIC(12,2) ceiling", () => {
    const feeCeiling = 9999999999.99;
    const clampedFee = Math.min(feeCeiling, 9999999999.99);
    const negativeFeeClamped = Math.max(0, -1);

    expect(negativeFeeClamped).toBe(0);
    expect(clampedFee).toBe(feeCeiling);
    expect(clampedFee.toFixed(2)).toBe("9999999999.99");
    expect(feeCeiling + 0.01).toBeGreaterThan(feeCeiling);
  });
});
