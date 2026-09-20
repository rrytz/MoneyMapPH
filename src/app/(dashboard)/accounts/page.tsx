import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAccountsWithBalances } from "@/lib/services/account.service";
import { getTransfers } from "@/lib/services/transfer.service";
import { AccountsClient } from "./accounts-client";

export const metadata = {
  title: "Accounts & Wallets | MoneyMapPH",
  description: "Track money allocation across your bank accounts, e-wallets, and cash reserves.",
};

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [activeRes, allRes, transfers] = await Promise.all([
    getAccountsWithBalances(supabase, user.id, false),
    getAccountsWithBalances(supabase, user.id, true),
    getTransfers(supabase, user.id, { limit: 20 }),
  ]);

  return (
    <AccountsClient
      initialAccounts={activeRes.accounts}
      allAccountsWithArchived={allRes.accounts}
      transfers={transfers}
      unassigned={activeRes.unassigned}
      totalLiquidity={activeRes.totalLiquidity}
    />
  );
}
