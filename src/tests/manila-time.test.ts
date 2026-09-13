/**
 * Unit tests for Asia/Manila timezone normalization (dual-clock bugfix).
 *
 * Regression: server components computed cutoff logic from the server's raw
 * UTC clock (`new Date()` on Vercel = UTC), while the client notification
 * drawer used the browser's arbitrary local clock. On cutoff boundary days
 * (the 14th and 29th, Manila time) the two surfaces rendered contradictory
 * periods for up to 8 hours after local midnight.
 *
 * The app is exclusively for Philippine users, so every "today" input into
 * cutoff/period logic is pinned to Asia/Manila (UTC+8) — on the server and
 * in the client — via getManilaNow().
 */

import { describe, it, expect } from "vitest";
import { getManilaNow, getCurrentMonthYear } from "@/lib/utils/date";
import { getCutoffPeriodForDate, getPeriodProgress } from "@/lib/utils/pay-period";
import { getBillsDueWindow } from "@/lib/utils/bills";

/** The exact failure window: server evaluates "now" as 2026-09-13 18:16 UTC, which is 2026-09-14 02:16 in Manila. */
const BOUNDARY_UTC = new Date("2026-09-13T18:16:00Z");

function wallClock(d: Date) {
  return {
    y: d.getFullYear(),
    m: d.getMonth() + 1,
    d: d.getDate(),
    hh: d.getHours(),
    mm: d.getMinutes(),
    ss: d.getSeconds(),
  };
}

describe("getManilaNow", () => {
  it("maps a UTC instant to the Asia/Manila wall clock (2026-09-13T18:16:42Z -> 2026-09-14 02:16:42)", () => {
    const now = getManilaNow(new Date("2026-09-13T18:16:42Z"));
    expect(wallClock(now)).toEqual({ y: 2026, m: 9, d: 14, hh: 2, mm: 16, ss: 42 });
  });
  it("keeps the previous calendar day before Manila midnight (2026-09-13T15:59:00Z -> 2026-09-13 23:59)", () => {
    const now = getManilaNow(new Date("2026-09-13T15:59:00Z"));
    expect(wallClock(now)).toEqual({ y: 2026, m: 9, d: 13, hh: 23, mm: 59, ss: 0 });
  });
  it("is independent of the host runtime's own timezone", () => {
    // A UTC 00:30 on the 14th is already 08:30 in Manila (not just 00:30 in UTC runtimes).
    const now = getManilaNow(new Date("2026-09-14T00:30:00Z"));
    expect(wallClock(now)).toEqual({ y: 2026, m: 9, d: 14, hh: 8, mm: 30, ss: 0 });
  });
});

describe("cutoff math with Manila normalization", () => {
  it("the boundary instant (13th 18:16 UTC == 14th 02:16 Manila) resolves to the period starting Sep 14 — NOT the just-ended Sep 13 cutoff", () => {
    const manilaNow = getManilaNow(BOUNDARY_UTC);
    const current = getCutoffPeriodForDate(manilaNow);
    expect(current.periodStart).toEqual(new Date(2026, 8, 14));
    expect(current.periodEnd).toEqual(new Date(2026, 8, 28));
    expect(current.payoutDate).toEqual(new Date(2026, 8, 28));
  });
  it("period progress counts the new period as day 1 at the boundary (1 of 15 elapsed)", () => {
    const manilaNow = getManilaNow(BOUNDARY_UTC);
    const current = getCutoffPeriodForDate(manilaNow);
    const p = getPeriodProgress(current.periodEnd, manilaNow);
    expect(p.daysElapsed).toBe(1);
    expect(p.daysRemaining).toBe(14);
    expect(p.fractionElapsed).toBeCloseTo(1 / 15);
  });
  it("getBillsDueWindow uses the Manila-dated window, not the UTC-dated one", () => {
    const manilaNow = getManilaNow(BOUNDARY_UTC);
    expect(getBillsDueWindow(manilaNow)).toEqual({ fromISO: "2026-09-14", toISO: "2026-09-28" });
  });
  it("a Manila 00:01 on the 29th rolls to the next month's 13th cutoff (cross-month)", () => {
    const manilaNow = getManilaNow(new Date("2026-09-28T16:01:00Z"));
    const current = getCutoffPeriodForDate(manilaNow);
    expect(current.periodStart).toEqual(new Date(2026, 8, 29));
    expect(current.periodEnd).toEqual(new Date(2026, 9, 13));
  });
});

describe("getCurrentMonthYear uses the Manila clock", () => {
  it("at 2026-09-13T18:16Z (Sep 14 in Manila) still reports September 2026", () => {
    expect(getCurrentMonthYear(new Date("2026-09-13T18:16:00Z"))).toEqual({ month: 9, year: 2026 });
  });
  it("at Oct 1 00:30 Manila (Sep 30 16:30 UTC) reports October — not the UTC month", () => {
    expect(getCurrentMonthYear(new Date("2026-09-30T16:30:00Z"))).toEqual({ month: 10, year: 2026 });
  });
});