"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  Plus,
  MoreVertical,
  Edit2,
  QrCode,
  Archive,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecordList, RecordRow, recordPrimaryLabel } from "@/components/shared/record-list";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { CategoryDonutChart } from "@/components/dashboard/category-donut-chart";
import { AccountModal } from "@/components/accounts/account-modal";
import { TransferModal } from "@/components/accounts/transfer-modal";
import { QrDisplayModal } from "@/components/accounts/qr-display-modal";
import { IncomeForm } from "@/components/forms/income-form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleArchiveAccount } from "@/app/(dashboard)/accounts/actions";
import { formatDate } from "@/lib/utils/date";
import type {
  AccountWithBalance,
  ExpenseCategory,
  IncomeSource,
} from "@/lib/types";
import type { UnifiedTransaction } from "@/lib/services/transaction.service";

interface AccountDetailClientProps {
  account: AccountWithBalance;
  initialTransactions: UnifiedTransaction[];
  categorySpending: Record<string, number>;
  expenseCategories: ExpenseCategory[];
  incomeSources: IncomeSource[];
  accounts: AccountWithBalance[];
}

export function AccountDetailClient({
  account,
  initialTransactions,
  categorySpending,
  expenseCategories,
  incomeSources,
  accounts,
}: AccountDetailClientProps) {
  const router = useRouter();
  const [transferOpen, setTransferOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  async function handleArchiveToggle() {
    const res = await toggleArchiveAccount(account.id, !account.is_archived);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(account.is_archived ? "Account unarchived" : "Account archived");
    if (!account.is_archived) {
      // Archiving removes the account from the active list it was tapped
      // from - landing back on the list instead of a stale detail.
      router.push("/accounts");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back to accounts">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <PageHeader title={account.name} description={account.type.replace("_", " ")} />
        </div>
      </div>

      {/* Hero: the same derived balance the list card shows. */}
      <FintechCard>
        <FintechCardContent className="space-y-1">
          <span className="type-section-label block">Current balance</span>
          <CurrencyDisplay
            amount={account.current_balance}
            className="type-ledger text-4xl sm:text-5xl font-semibold tracking-tight text-foreground"
          />
          {account.is_archived && (
            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
              Archived
            </Badge>
          )}
        </FintechCardContent>
      </FintechCard>

      {/* Actions: Transfer + Deposit prefill to this account; More holds the
          same Edit / QR / Archive menu the card's 3-dot carries. */}
      <div className="flex items-center gap-3">
        <Button onClick={() => setTransferOpen(true)} variant="outline" className="flex-1">
          <ArrowLeftRight className="mr-2 h-4 w-4" /> Transfer
        </Button>
        <Button onClick={() => setDepositOpen(true)} variant="outline" className="flex-1">
          <Plus className="mr-2 h-4 w-4" /> Deposit
        </Button>
        {/* Fast path to the receive-QR fullscreen display. Same conditional
            as the card menu (qr_image_path set) and the same modal the menu
            item opens - the row is the fast path, the menu stays the
            discoverable path. */}
        {account.qr_image_path && (
          <Button onClick={() => setQrOpen(true)} variant="outline" className="flex-1">
            <QrCode className="mr-2 h-4 w-4" /> Show QR
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-ink transition-colors hover:bg-inset"
            aria-label="More actions"
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Edit2 className="mr-2 h-4 w-4" /> Edit Account
            </DropdownMenuItem>
            {account.qr_image_path && (
              <DropdownMenuItem onClick={() => setQrOpen(true)}>
                <QrCode className="mr-2 h-4 w-4" /> Show QR
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleArchiveToggle}>
              {account.is_archived ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" /> Unarchive Account
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4 text-rose-400" /> Archive Account
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Recents, scoped to this account. Untagged rows carry no account_id
          and can never appear here - the empty state says exactly that
          instead of reading as a broken list. */}
      <FintechCard className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-base text-foreground">Recent Transactions</h3>
        </div>
        {initialTransactions.length === 0 ? (
          <p className="text-xs text-muted-foreground p-6 text-center">
            No transactions tagged to this account.{" "}
            <Link href="/expenses?unassigned=1" className="font-semibold text-sulpot-deep hover:underline">
              View untagged transactions
            </Link>
          </p>
        ) : (
          <>
            <RecordList>
              {initialTransactions.map((tx) => {
                const isIncome = tx.type === "income";
                return (
                  <RecordRow
                    key={tx.id}
                    icon={tx.categoryIcon}
                    primary={recordPrimaryLabel(tx)}
                    badge={
                      <Badge
                        variant={isIncome ? "income" : "expense"}
                        className="shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      >
                        {tx.type}
                      </Badge>
                    }
                    secondary={
                      <>
                        {formatDate(tx.date, "MMM dd")} ·{" "}
                        {tx.categoryName || (isIncome ? "Income" : "Expense")}
                        {tx.notes ? ` · ${tx.notes}` : ""}
                      </>
                    }
                    amountTone={isIncome ? "income" : "expense"}
                    amount={
                      <>
                        {isIncome ? "+" : "-"}
                        <CurrencyDisplay amount={tx.amount} className="figure-inline inline font-bold" />
                      </>
                    }
                  />
                );
              })}
            </RecordList>
            {/* Desktop keeps the table: RecordList hides at lg, and without
                this a desktop detail would read as an empty recents card. */}
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      <th className="py-2.5 px-5">Date</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Category/Source</th>
                      <th className="py-2.5 px-5">Description</th>
                      <th className="py-2.5 px-5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {initialTransactions.map((tx) => {
                      const isIncome = tx.type === "income";
                      return (
                        <tr key={tx.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-5 text-muted-foreground whitespace-nowrap">{formatDate(tx.date, "MMM d, yyyy")}</td>
                          <td className="py-3 px-4">
                            <Badge variant={isIncome ? "income" : "expense"} className="text-[10px] uppercase px-2 py-0.5 tracking-wider font-bold">
                              {tx.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-semibold text-foreground">{tx.categoryName || (isIncome ? "Income" : "Expense")}</td>
                          <td className="py-3 px-5">
                            <span className="font-medium text-foreground">{recordPrimaryLabel(tx)}</span>
                            {tx.notes && <span className="block text-[11px] text-muted-foreground truncate">{tx.notes}</span>}
                          </td>
                          <td className={isIncome
                            ? "py-3 px-5 text-right font-bold tabular-nums text-xs text-sulpot-deep dark:text-sulpot-bright"
                            : "py-3 px-5 text-right font-bold tabular-nums text-xs text-rose-600 dark:text-rose-400"}>
                            {isIncome ? "+" : "-"}
                            <CurrencyDisplay amount={tx.amount} className="figure-inline" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </FintechCard>

      <CategoryDonutChart categorySpending={categorySpending} categories={expenseCategories} />

      <TransferModal
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) router.refresh();
        }}
        accounts={accounts}
        defaultSourceAccountId={account.id}
      />
      <IncomeForm
        open={depositOpen}
        onOpenChange={(open) => {
          setDepositOpen(open);
          if (!open) router.refresh();
        }}
        sources={incomeSources}
        accounts={accounts}
        initialAccountId={account.id}
      />
      <AccountModal
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) router.refresh();
        }}
        editAccountData={account}
      />
      <QrDisplayModal
        account={qrOpen ? { id: account.id, name: account.name } : null}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />
    </div>
  );
}
