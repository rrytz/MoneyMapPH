"use client";

import type { AccountWithBalance } from "@/lib/types";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Wallet, Landmark, CreditCard, DollarSign, Smartphone, AlertTriangle, MoreVertical, Edit2, Archive, RotateCcw } from "lucide-react";
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

  return (
    <div className={`relative rounded-2xl border p-5 transition-all shadow-sm ${
      account.is_negative
        ? "border-rose-500/50 bg-rose-950/10 dark:bg-rose-950/20"
        : account.is_archived
        ? "border-slate-800 bg-slate-900/40 opacity-60"
        : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-md ${
            account.is_negative
              ? "bg-rose-500/10 text-rose-400"
              : "bg-cyan-500/10 text-cyan-400"
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100 text-base">{account.name}</h3>
              {account.is_archived && (
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  Archived
                </span>
              )}
            </div>
            <span className="text-xs font-medium text-slate-400 capitalize">
              {account.type.replace("_", " ")}
              {account.type === "credit" && " (Ledger)"}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer">
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
          <span className="caption text-slate-400">Current Derived Balance</span>
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

        <div className="ledger-figure tabular-nums text-slate-100">
          <CurrencyDisplay
            amount={account.current_balance}
            className={account.is_negative ? "font-semibold text-rose-400" : "font-semibold text-slate-100"}
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>Starting Balance</span>
        <CurrencyDisplay amount={account.initial_balance} className="font-medium text-slate-300" />
      </div>
    </div>
  );
}
