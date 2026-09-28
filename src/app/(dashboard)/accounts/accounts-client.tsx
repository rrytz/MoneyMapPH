"use client";

import { useState } from "react";
import type { AccountWithBalance, AccountTransfer, UnassignedTotals } from "@/lib/types";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountModal } from "@/components/accounts/account-modal";
import { TransferModal } from "@/components/accounts/transfer-modal";
import { TransferList } from "@/components/accounts/transfer-list";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { FilterPills } from "@/components/shared/filter-pills";
import { gridTracksFor, gridTracksClass } from "@/lib/utils/grid-tracks";
import { cn } from "@/lib/utils";
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
  // The type order is the closed set's own, so sections are stable.
  const ACCOUNT_TYPE_ORDER = ["bank", "digital_bank", "ewallet", "credit", "cash"] as const;
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<AccountTransfer | null>(null);
  const [defaultSourceAccId, setDefaultSourceAccId] = useState<string | undefined>(undefined);

  const displayedAccounts = showArchived ? allAccountsWithArchived : initialAccounts;
  const accountTracks = gridTracksFor(displayedAccounts.length, 3);

  // Grouped by the account type, and only over types that are PRESENT.
  //
  // Order is the closed type set's order, not alphabetical and not by size, so
  // the sections do not reshuffle when an account is added or archived. An
  // absent type contributes no section at all - a section with nothing in it is
  // a header describing zero accounts, and a pill for a type with no accounts is
  // a filter to nothing. Both are dead controls, so both derive from what is
  // actually on the page.
  const accountGroups = ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    accounts: displayedAccounts.filter((a) => a.type === type),
  })).filter((g) => g.accounts.length > 0);

  // Pills over present types, using the app's OWN type strings - lowercase and
  // unhyphenated, because that is what the DB stores and what the card renders.
  // Measured: All + the three present types is 224.5px against 345px usable, one
  // row. The six-pill version measured 394.5px, over by 49.5px, which would mean
  // a partially-visible last pill - the same interaction removed from the
  // tables. Deriving from present types makes that case unreachable.
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const visibleGroups =
    typeFilter === null
      ? accountGroups
      : accountGroups.filter((g) => g.type === typeFilter);

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
          <h1 className="type-page-title text-foreground">
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

      {/* S5b: no liquidity card here. The shell anchor already carries the
          total on every page — repeating it would put two competing large
          figures on one surface, which is the hierarchy this slice removes. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Unassigned context — genuine supporting information. */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="type-section-label text-muted-foreground">Unassigned Transactions</span>
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

        {/* Account controls */}
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="type-section-label text-muted-foreground">Accounts</span>
            <span className="text-xs font-bold text-sulpot-deep bg-sulpot-tint px-2.5 py-1 rounded-full">
              {initialAccounts.length} active
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-4">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-input bg-card text-sulpot focus:ring-sulpot"
            />
            Show Archived Accounts ({allAccountsWithArchived.length - initialAccounts.length})
          </label>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="space-y-4">
        {/* The pill row, and it is derived rather than declared. Filtered to a
            type that has no accounts, the filter is not a control. */}
        {accountGroups.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <FilterPills
              label="Account type"
              options={[
                { value: "all", label: "All" },
                ...accountGroups.map((g) => ({ value: g.type, label: g.type })),
              ]}
              value={typeFilter ?? "all"}
              onChange={(v) => setTypeFilter(v === "all" ? null : v)}
            />
          </div>
        )}
        <h2 className="text-lg font-semibold text-foreground">Your Wallets & Accounts</h2>
        {displayedAccounts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/60 p-12 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-sulpot/10 text-sulpot-deep dark:text-sulpot-bright flex items-center justify-center">
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
          /* Grouped by type, and grouped for a reason that was measured rather
             than assumed: a flat grid has ONE track count for the whole page, so
             a group of one account lands beside a 165px void at two-up. Grouping
             makes that visible - two of four accounts in three types - and the
             fix is that the track count is now derived PER GROUP.

             A single-account group rendering full width is therefore correct
             behaviour, not a layout failure. At two-up it would be a defect; at
             one track it is a card that fills its row.

             The header is the type and a COUNT, never a currency subtotal. The
             page already carries four figures at 30px, and a subtotal is a
             `type-ledger` by nature, so three of them would make seven and put
             the group total ahead of the accounts it summarises. The Allowance
             card was refused at two overlapping figures of 33.75px; this page
             is already at four. A count reads as metadata and leaves the ledger
             count where it is. */
          <div className="space-y-6">
            {visibleGroups.map((group) => {
              const groupMobile = gridTracksClass(
                gridTracksFor(group.accounts.length, 2),
                ""
              );
              return (
                <section key={group.type}>
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="type-section-label text-muted-foreground">
                      {group.type.replace("_", " ")}
                    </span>
                    <span className="type-section-label text-muted-foreground tabular-nums">
                      {group.accounts.length}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "grid gap-4",
                      groupMobile,
                      // Per-group at BOTH breakpoints. Leaving `md:grid-cols-2`
                      // in the base hard-coded is what put a 610px void beside
                      // every single-account group on desktop: the `lg` class was
                      // per-group and correctly declined to 1, but the base
                      // `md` class then put two tracks back at md and above.
                      // A group of one has no width-appropriate pair at any
                      // breakpoint, so the count is derived once and used twice.
                      gridTracksClass(group.accounts.length === 1 ? 1 : 2, "md"),
                      gridTracksClass(group.accounts.length === 1 ? 1 : gridTracksFor(group.accounts.length, 3), "lg")
                    )}
                  >
                    {group.accounts.map((acc) => (
                      <AccountCard
                        key={acc.id}
                        account={acc}
                        onEdit={handleEditAccount}
                        onArchive={handleArchiveToggle}
                        onTransfer={handleOpenTransfer}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
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
            className="text-xs text-sulpot-deep dark:text-sulpot-bright hover:text-sulpot"
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
