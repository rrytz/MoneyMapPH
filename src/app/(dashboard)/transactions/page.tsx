import { createClient, getUser } from "@/lib/supabase/server";
import { getUnifiedTransactions } from "@/lib/services/transaction.service";
import { cachedGetExpenseCategories, cachedGetIncomeSources } from "@/lib/cache/shared-queries";
import { cachedGetMonthlySummary, cachedGetBudgetStatuses } from "@/lib/cache/shared-queries";
import { cachedGetSnapshots } from "@/lib/cache/shared-queries";
import { getCurrentMonthYear, getMonthDateRange } from "@/lib/utils/date";
import { resolveViewMonth } from "@/lib/utils/view-month";
import { TransactionsClient } from "./transactions-client";
import { redirect } from "next/navigation";

interface TransactionsPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

// This screen was showing three periods at once and did not know it:
//
//   getUnifiedTransactions   no date range  -> all history
//   cachedGetMonthlySummary  current month
//   cachedGetSnapshots       rolling 12 months
//   cachedGetBudgetStatuses  current month
//
// So the All Transactions tab listed every transaction ever while the Summary
// tab beside it reported one month, and the chart reported a year. It never
// surfaced because the QA account's data is entirely inside one month, which
// makes it the same class as the limit:50 ceiling - a period inconsistency the
// data cannot expose.
//
// The ledger is now scoped to the viewed month like the two queries already
// were. The snapshot chart deliberately stays at 12: a trend chart that
// followed the navigator would be one point, not a trend. Its job is context;
// the summary's job is the period. SummaryView labels its span so the
// difference is stated rather than left for the user to infer from the chart
// not moving when they navigate.
export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const { month, year } = resolveViewMonth(params.month, params.year, getCurrentMonthYear());
  const { start, end } = getMonthDateRange(month, year);

  const [{ data: transactions }, categories, sources, summary, snapshots, budgetStatuses] = await Promise.all([
    getUnifiedTransactions(supabase, user.id, { startDate: start, endDate: end, limit: 10_000 }),
    cachedGetExpenseCategories(supabase, user.id),
    cachedGetIncomeSources(supabase, user.id),
    cachedGetMonthlySummary(supabase, user.id, month, year),
    cachedGetSnapshots(supabase, user.id, 12),
    cachedGetBudgetStatuses(supabase, user.id, month, year),
  ]);

  return (
    <TransactionsClient
      key={`${month}-${year}`}
      initialTransactions={transactions}
      categories={categories}
      sources={sources}
      summary={summary}
      snapshots={snapshots}
      budgetStatuses={budgetStatuses}
      month={month}
      year={year}
    />
  );
}