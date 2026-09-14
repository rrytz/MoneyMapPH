import type { IncomeEntry } from "@/lib/types";

export type IncomeView = "month" | "all";

/**
 * Picks the entry list backing the income page's "Log Income" tab.
 * The default view is the active month; "all" shows full history so
 * out-of-month entries can be seen, edited, and deleted from this page.
 */
export function resolveIncomeViewEntries(
  monthEntries: IncomeEntry[],
  allEntries: IncomeEntry[],
  view?: IncomeView
): IncomeEntry[] {
  return view === "all" ? allEntries : monthEntries;
}

/**
 * True when an ISO date string ("yyyy-MM-dd") falls inside the given
 * month/year. String-prefix comparison keeps this timezone-safe and
 * avoids date-parse edge cases for malformed input.
 */
export function isInShownMonth(dateISO: string, month: number, year: number): boolean {
  const norm = (n: number) => String(n).padStart(2, "0");
  return dateISO.slice(0, 7) === `${year}-${norm(month)}`;
}