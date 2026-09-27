"use client";

import type { AccountWithBalance } from "@/lib/types";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { cn } from "@/lib/utils";
import { Wallet, Landmark, CreditCard, DollarSign, Smartphone, AlertTriangle, MoreVertical, Edit2, Archive, RotateCcw } from "lucide-react";
import { accountTone } from "@/lib/utils/account-tone";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AccountCardProps {
  account: AccountWithBalance;
  onEdit: (account: AccountWithBalance) => void;
  onArchive: (account: AccountWithBalance) => void;
  onTransfer: (account: AccountWithBalance) => void;
}

export function AccountCard({ account, onEdit, onArchive, onTransfer }: AccountCardProps) {
  const getIcon = () => {
    switch (account.type) {
      case "bank":
        return Landmark;
      case "ewallet":
        return Smartphone;
      case "digital_bank":
        return Wallet;
      case "credit":
        return CreditCard;
      case "cash":
      default:
        return DollarSign;
    }
  };

  const Icon = getIcon();

  // The GROUND is the type. State does not yield - it takes the figure and the
  // accent instead, so the two never compete for one surface. A negative
  // account still shows rose, and the type is carried by the icon and the name,
  // which makes the ground redundancy rather than the only channel.
  //
  // Suppressed on negative and archived cards on purpose: both are states the
  // reader must not miss, and a coloured ground behind a rose border is two
  // things asking to be looked at at once.
  const tone = accountTone(account.type);
  const showTone = !account.is_negative && !account.is_archived;

  return (
    <div
      className={`relative rounded-2xl border p-4 transition-all ${
        account.is_negative
          ? "border-rose-500/50 bg-rose-500/10 dark:bg-rose-950/20"
          : account.is_archived
            ? "border-border bg-card/60 opacity-60"
            : "border-border hover:border-border"
      }`}
      // 7% over the card surface: a ground, never loud enough to compete with
      // the balance, which is the figure and this card's whole job. `p-5` also
      // became `p-4` because the ledger figure is 138.3px against 125px of
      // content at two-up - it fit the geometry but ate the padding.
      style={showTone ? { backgroundColor: `${tone.ground}12` } : undefined}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-md ${
              account.is_negative ? "bg-rose-500/10 text-rose-400" : ""
            }`}
            // 14% fill behind the icon, so the type reads as a mark on the
            // card rather than as a second background competing with the ground.
            style={
              showTone
                ? { backgroundColor: `${tone.ground}24`, color: tone.ground }
                : undefined
            }
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-card-foreground text-base">{account.name}</h3>
              {account.is_archived && (
                <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Archived
                </span>
              )}
            </div>
            <span className="text-xs font-medium text-muted-foreground capitalize">
              {account.type.replace("_", " ")}
              {account.type === "credit" && " (Ledger)"}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!account.is_archived && (
              <>
                <DropdownMenuItem onClick={() => onEdit(account)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTransfer(account)}>
                  <Wallet className="h-4 w-4 mr-2" />
                  Transfer From/To
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => onArchive(account)}>
              {account.is_archived ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Unarchive Account
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2 text-rose-400" />
                  Archive Account
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="type-section-label text-muted-foreground">Current Derived Balance</span>
          {account.is_negative && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 cursor-help">
                    <AlertTriangle className="h-3 w-3" />
                    Negative Balance
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs p-3">
                  This is a derived balance based on the starting balance and transactions assigned to this account. It can become negative when recorded outflows exceed the recorded starting balance and inflows. Because account tagging is optional, the derived balance may not represent the actual external account balance.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="tabular-nums text-card-foreground">
          <CurrencyDisplay
            amount={account.current_balance}
            className={cn(
              "type-ledger",
              account.is_negative ? "font-semibold text-rose-400" : "font-semibold text-card-foreground"
            )}
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Starting Balance</span>
        <CurrencyDisplay amount={account.initial_balance} className="figure-inline font-medium text-muted-foreground" />
      </div>
    </div>
  );
}
