import { describe, it, expect } from "vitest";
import { getTrendChartState, SPARSE_TREND_LIMIT, TREND_SPARSE_DESC } from "@/lib/utils/dashboard-charts";

describe("dashboard sparse-data decisioning", () => {
  it("treats zero snapshots as empty", () => {
    expect(getTrendChartState(0)).toBe("empty");
  });

  it("treats a single snapshot as sparse (not renderable)", () => {
    expect(getTrendChartState(1)).toBe("sparse");
  });

  it("renders the trend chart once two or more snapshots exist", () => {
    expect(getTrendChartState(2)).toBe("chart");
    expect(getTrendChartState(SPARSE_TREND_LIMIT)).toBe("chart");
  });

  it("sparse copy is friendly and invites more logging", () => {
    expect(TREND_SPARSE_DESC.toLowerCase()).toMatch(/log/i);
  });
});