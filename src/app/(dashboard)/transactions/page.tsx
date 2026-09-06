import { createClient, getUser } from "@/lib/supabase/server";
import { getUnifiedTransactions } from "@/lib/services/transaction.service";
import { getExpenseCategories, getIncomeSources } from "@/lib/services/category.service";
import { getMonthlySummary, getBudgetStatuses } from "@/lib/services/financial.service";
import { getSnapshots } from "@/lib/services/snapshot.service";
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
    getExpenseCategories(supabase, user.id),
    getIncomeSources(supabase, user.id),
    getMonthlySummary(supabase, user.id, month, year),
    getSnapshots(supabase, user.id, 12),
    getBudgetStatuses(supabase, user.id, month, year),
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