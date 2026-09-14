export interface ViewMonth {
  month: number;
  year: number;
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export function isValidMonthYear(month: number, year: number): boolean {
  return (
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(year) &&
    year >= MIN_YEAR &&
    year <= MAX_YEAR
  );
}

/**
 * Resolve the month/year of a URL query (e.g. /budgets?month=8&year=2026) that
 * drives a server-side data query. Invalid, out-of-range, or missing params
 * fall back to the current month so the URL can never render a bogus view.
 */
export function resolveViewMonth(
  monthParam: string | string[] | undefined,
  yearParam: string | string[] | undefined,
  fallback: ViewMonth
): ViewMonth {
  const rawMonth = Array.isArray(monthParam) ? monthParam[0] : monthParam;
  const rawYear = Array.isArray(yearParam) ? yearParam[0] : yearParam;
  if (rawMonth === undefined || rawYear === undefined) {
    return { month: fallback.month, year: fallback.year };
  }
  const month = Number(rawMonth);
  const year = Number(rawYear);
  if (isValidMonthYear(month, year)) {
    return { month, year };
  }
  return { month: fallback.month, year: fallback.year };
}