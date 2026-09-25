"use client";

import { useState } from "react";
import type { AccountWithBalance, AccountTransfer, UnassignedTotals } from "@/lib/types";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountModal } from "@/components/accounts/account-modal";
import { TransferModal } from "@/components/accounts/transfer-modal";
import { TransferList } from "@/components/accounts/transfer-list";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeftRight, Wallet, Info } from "lucide-react";
import { toggleArchiveAccount, removeTransfer } from "@/app/(dashboard)/accounts/actions";
import { toast } from "sonner";

interface AccountsClientProps {
  initialAccounts: AccountWithBalance[];
  allAccountsWithArchived: AccountWithBalance[];
  transfers: AccountTransfer[];
  unassigned: UnassignedTotals;
  totalLiquidity: number;
}

export function AccountsClient({
  initialAccounts,
  allAccountsWithArchived,
  transfers,
  unassigned,
  totalLiquidity,
}: AccountsClientProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<AccountTransfer | null>(null);
  const [defaultSourceAccId, setDefaultSourceAccId] = useState<string | undefined>(undefined);

  const displayedAccounts = showArchived ? allAccountsWithArchived : initialAccounts;

  function handleCreateAccount() {
    setEditingAccount(null);
    setAccountModalOpen(true);
  }

  function handleEditAccount(acc: AccountWithBalance) {
    setEditingAccount(acc);
    setAccountModalOpen(true);
  }

  async function handleArchiveToggle(acc: AccountWithBalance) {
    const res = await toggleArchiveAccount(acc.id, !acc.is_archived);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(acc.is_archived ? "Account unarchived" : "Account archived");
    }
  }

  function handleOpenTransfer(acc?: AccountWithBalance) {
    setEditingTransfer(null);
    setDefaultSourceAccId(acc?.id);
    setTransferModalOpen(true);
  }

  function handleEditTransfer(tr: AccountTransfer) {
    setEditingTransfer(tr);
    setTransferModalOpen(true);
  }

  async function handleDeleteTransfer(transferId: string) {
    if (confirm("Are you sure you want to delete this transfer? Account balances will be recalculated.")) {
      const res = await removeTransfer(transferId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Transfer deleted");
      }
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Accounts & Wallets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track money across your bank accounts, e-wallets, and cash reserves.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => handleOpenTransfer()} variant="outline">
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Transfer Money
          </Button>
          <Button onClick={handleCreateAccount}>
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Tracked Liquidity */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="caption text-muted-foreground">Total Tracked Liquidity</span>
            <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="ledger-figure tabular-nums text-foreground">
            <CurrencyDisplay amount={totalLiquidity} />
          </div>
          <p className="text-xs text-muted-foreground">
            Sum of funds across {initialAccounts.length} active wallets.
          </p>
        </div>

        {/* Card 2: Unassigned Context Notice */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="caption text-muted-foreground">Unassigned Transactions</span>
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Info className="h-4 w-4" />
            </div>
          </div>
          <div className="text-sm font-semibold text-foreground">
            Untagged: ₱{(unassigned.unassignedIncome - unassigned.unassignedExpenses).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            Untagged transactions continue to be included in your monthly totals, budgets, and financial metrics.
          </p>
        </div>

        {/* Card 3: Account Controls */}
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="caption text-muted-foreground">Active Accounts</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              {initialAccounts.length} Active
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-4">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-input bg-card text-emerald-600 focus:ring-emerald-500"
            />
            Show Archived Accounts ({allAccountsWithArchived.length - initialAccounts.length})
          </label>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Your Wallets & Accounts</h2>
        {displayedAccounts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/60 p-12 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">No accounts created yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Create your first account (GCash, Maya, UnionBank, or Cash) to start tracking where your money lands and comes from.
              </p>
            </div>
            <Button onClick={handleCreateAccount}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Account
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedAccounts.map((acc) => (
              <AccountCard
                key={acc.id}
                account={acc}
                onEdit={handleEditAccount}
                onArchive={handleArchiveToggle}
                onTransfer={handleOpenTransfer}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Internal Transfers */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Internal Transfers</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenTransfer()}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
          >
            + Log New Transfer
          </Button>
        </div>

        <TransferList
          transfers={transfers}
          onEdit={handleEditTransfer}
          onDelete={handleDeleteTransfer}
        />
      </div>

      {/* Modals */}
      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
        editAccountData={editingAccount}
      />

      <TransferModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        accounts={initialAccounts}
        editTransferData={editingTransfer}
        defaultSourceAccountId={defaultSourceAccId}
      />
    </div>
  );
}
