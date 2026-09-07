/**
 * Unit tests for budget-status.ts
 *
 * Mirrors the threshold logic originally inlined in financial.service.ts
 * (BUDGET_THRESHOLDS: UNDER 75 → "near", NEAR 100 → "over").
 */

import { describe, it, expect } from "vitest";
import { computeBudgetStatus } from "@/lib/utils/budget-status";

describe("computeBudgetStatus", () => {
  it("returns 0% used and under when nothing is spent", () => {
    expect(computeBudgetStatus(100, 0)).toEqual({ percentage: 0, status: "under" });
  });

  it("stays under below the UNDER threshold", () => {
    expect(computeBudgetStatus(100, 20)).toEqual({ percentage: 20, status: "under" });
  });

  it("moves to near exactly at the UNDER threshold (75%)", () => {
    expect(computeBudgetStatus(100, 75)).toEqual({ percentage: 75, status: "near" });
  });

  it("is near at exactly the NEAR threshold (100%)", () => {
    expect(computeBudgetStatus(100, 100)).toEqual({ percentage: 100, status: "near" });
  });

  it("moves to over only past the NEAR threshold", () => {
    expect(computeBudgetStatus(100, 100.01)).toEqual({ percentage: 100.01, status: "over" });
  });

  it("is over above 100%", () => {
    expect(computeBudgetStatus(100, 110)).toEqual({ percentage: 110, status: "over" });
  });

  it("rounds the percentage to two decimal places", () => {
    expect(computeBudgetStatus(3, 1)).toEqual({ percentage: 33.33, status: "under" });
  });

  it("guards against a zero budget", () => {
    expect(computeBudgetStatus(0, 50)).toEqual({ percentage: 0, status: "under" });
  });
});