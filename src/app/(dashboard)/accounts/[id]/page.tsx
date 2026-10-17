import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getAccountsWithBalances } from "@/lib/services/account.service";
import { getUnifiedTransactions } from "@/lib/services/transaction.service";
import { getAccountCategorySpending } from "@/lib/services/expense-aggregation.service";
import { getExpenseCategories, getIncomeSources } from "@/lib/services/category.service";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { AccountDetailClient } from "./account-detail-client";

export const metadata = {
  title: "Account Detail | Agos",
};

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Balances come from the same aggregate the list uses, so the hero figure
  // here can never disagree with the card it was tapped from.
  const { month, year } = getCurrentMonthYear();
  const [
    { accounts },
    txns,
    categorySpending,
    expenseCategories,
    incomeSources,
  ] = await Promise.all([
    getAccountsWithBalances(supabase, user.id, true),
    getUnifiedTransactions(supabase, user.id, { accountId: id, limit: 10 }),
    getAccountCategorySpending(supabase, user.id, id, month, year),
    getExpenseCategories(supabase, user.id),
    getIncomeSources(supabase, user.id),
  ]);

  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  return (
    <AccountDetailClient
      account={account}
      initialTransactions={txns.data}
      categorySpending={categorySpending}
      expenseCategories={expenseCategories}
      incomeSources={incomeSources}
      accounts={accounts.filter((a) => !a.is_archived)}
    />
  );
}
