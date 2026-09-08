export const SPARSE_TREND_LIMIT = 2;

export const TREND_SPARSE_TITLE = "Not enough history yet";

export const TREND_SPARSE_DESC =
  "Log a few more months of income and expenses to reveal your spending trend.";

export function getTrendChartState(snapshotCount: number): "empty" | "sparse" | "chart" {
  if (snapshotCount === 0) return "empty";
  if (snapshotCount < SPARSE_TREND_LIMIT) return "sparse";
  return "chart";
}