import { createClient, getUser } from "@/lib/supabase/server";
import { getUnifiedTransactions } from "@/lib/services/transaction.service";
import { cachedGetExpenseCategories, cachedGetIncomeSources } from "@/lib/cache/shared-queries";
import { cachedGetMonthlySummary, cachedGetBudgetStatuses } from "@/lib/cache/shared-queries";
import { cachedGetSnapshots } from "@/lib/cache/shared-queries";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { TransactionsClient } from "./transactions-client";
import { redirect } from "next/navigation";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const { month, year } = getCurrentMonthYear();

  const [{ data: transactions }, categories, sources, summary, snapshots, budgetStatuses] = await Promise.all([
    getUnifiedTransactions(supabase, user.id, { limit: 10_000 }),
    cachedGetExpenseCategories(supabase, user.id),
    cachedGetIncomeSources(supabase, user.id),
    cachedGetMonthlySummary(supabase, user.id, month, year),
    cachedGetSnapshots(supabase, user.id, 12),
    cachedGetBudgetStatuses(supabase, user.id, month, year),
  ]);

  return (
    <TransactionsClient
      initialTransactions={transactions}
      categories={categories}
      sources={sources}
      summary={summary}
      snapshots={snapshots}
      budgetStatuses={budgetStatuses}
    />
  );
}