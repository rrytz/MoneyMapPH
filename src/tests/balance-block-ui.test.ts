import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BalanceBlock } from "@/components/dashboard/balance-block";
import { BalanceReadout } from "@/components/layout/topbar";
import type { SafeToSpendStatus } from "@/lib/types";

const breachedCutoff: SafeToSpendStatus = {
  periodStart: "2026-09-01",
  periodEnd: "2026-09-28",
  payoutDate: "2026-09-01",
  coreIncome: 0,
  incentiveIncomeLogged: 0,
  spentThisPeriod: 1784,
  safeToSpend: -1784,
  hasPaychecks: true,
  daysTotal: 28,
  daysElapsed: 22,
  daysRemaining: 6,
  fractionElapsed: 0.8,
};

describe("BalanceBlock currency signs", () => {
  it("shows a breached safe-to-spend value as negative", () => {
    const html = renderToStaticMarkup(
      createElement(BalanceBlock, {
        totalBalance: 3300,
        safeToSpend: breachedCutoff,
        hasAnyAccount: true,
      })
    );

    expect(html).toContain("Safe to spend");
    expect(html).toContain("text-rose");
    expect(html).toContain("-₱1,784.00");
    expect(html).not.toContain("Safe to spend</p><p class=\"mt-1 text-lg font-semibold tabular-nums text-ink\"><span class=\"tabular-nums font-medium\">₱1,784.00");
  });

  it("shows a negative monthly net as negative in the balance block", () => {
    const html = renderToStaticMarkup(
      createElement(BalanceBlock, {
        totalBalance: 3300,
        safeToSpend: breachedCutoff,
        hasAnyAccount: true,
        monthIncome: 1000,
        monthExpenses: 1500,
      })
    );

    expect(html).toContain("Calendar month net");
    expect(html).toContain("-₱500.00");
  });

  it("shows a negative total account balance as negative in the balance block", () => {
    const html = renderToStaticMarkup(
      createElement(BalanceBlock, {
        totalBalance: -500,
        safeToSpend: null,
        hasAnyAccount: true,
      })
    );

    expect(html).toContain("text-rose");
    expect(html).toContain("-₱500.00");
  });

  it("shows a negative total account balance as negative in the shell anchor", () => {
    const html = renderToStaticMarkup(
      createElement(BalanceReadout, {
        totalBalance: -500,
        safeToSpend: null,
        accountCount: 1,
        loaded: true,
      })
    );

    expect(html).toContain("text-rose");
    expect(html).toContain("-₱500.00");
  });
});
