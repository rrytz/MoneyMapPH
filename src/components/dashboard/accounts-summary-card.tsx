import type { AccountWithBalance, UnassignedTotals } from "@/lib/types";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Wallet, Landmark, CreditCard, Smartphone, DollarSign, ArrowRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AccountsSummaryCardProps {
  accounts: AccountWithBalance[];
  unassigned: UnassignedTotals;
  totalLiquidity: number;
}

function AccountTypeIcon({ type }: { type: AccountWithBalance["type"] }) {
  if (type === "bank") return <Landmark className="h-3.5 w-3.5" />;
  if (type === "credit") return <CreditCard className="h-3.5 w-3.5" />;
  if (type === "ewallet") return <Smartphone className="h-3.5 w-3.5" />;
  if (type === "digital_bank") return <Wallet className="h-3.5 w-3.5" />;
  return <DollarSign className="h-3.5 w-3.5" />;
}

export function AccountsSummaryCard({ accounts, unassigned, totalLiquidity }: AccountsSummaryCardProps) {
  const visible = accounts.slice(0, 4);
  const extraCount = accounts.length - visible.length;

  return (
    <FintechCard className="flex flex-col">
      <FintechCardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <FintechCardTitle>Accounts &amp; Wallets</FintechCardTitle>
          <p className="text-xs text-muted-foreground">
            {accounts.length} active {accounts.length === 1 ? "wallet" : "wallets"} · total liquid funds
          </p>
        </div>
        <Link
          href="/accounts"
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
        >
          Manage <ArrowRight className="h-3 w-3" />
        </Link>
      </FintechCardHeader>

      <FintechCardContent className="flex-1 flex flex-col gap-4">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-border/70 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="caption">Total Tracked Liquidity</p>
            <div className="ledger-figure tabular-nums text-foreground mt-0.5">
              <CurrencyDisplay amount={totalLiquidity} />
            </div>
          </div>
          <div className="p-2.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border/70">
            <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-foreground">No active wallets</h4>
              <p className="text-[11px] text-muted-foreground">
                Create accounts to allocate your funds across banks, e-wallets, and cash.
              </p>
            </div>
            <Link
              href="/accounts"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
            >
              Add Account
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border/70 hover:border-emerald-200 transition-colors"
              >
                <div
                  className={cn(
                    "p-2 rounded-md shrink-0",
                    account.is_negative
                      ? "bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  <AccountTypeIcon type={account.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{account.name}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {account.type.replace("_", " ")}
                    {account.type === "credit" ? " · ledger" : ""}
                  </p>
                </div>
                <div
                  className={cn(
                    "text-xs font-bold tabular-nums",
                    account.is_negative
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-foreground"
                  )}
                >
                  <CurrencyDisplay amount={account.current_balance} />
                </div>
              </div>
            ))}
            {extraCount > 0 && (
              <p className="text-[11px] text-muted-foreground text-center pt-0.5">
                +{extraCount} more wallet{extraCount === 1 ? "" : "s"} · <Link href="/accounts" className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold">view all</Link>
              </p>
            )}
          </div>
        )}

        {(unassigned.unassignedIncome > 0 || unassigned.unassignedExpenses > 0) && (
          <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground space-y-1">
            <p className="flex items-center justify-between">
              <span>Unassigned income</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                <CurrencyDisplay amount={unassigned.unassignedIncome} />
              </span>
            </p>
            <p className="flex items-center justify-between">
              <span>Unassigned expenses</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                <CurrencyDisplay amount={unassigned.unassignedExpenses} />
              </span>
            </p>
          </div>
        )}
      </FintechCardContent>
    </FintechCard>
  );
}