"use client";

import type { AccountWithBalance } from "@/lib/types";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { cn } from "@/lib/utils";
import { Wallet, Landmark, CreditCard, DollarSign, Smartphone, AlertTriangle, MoreVertical, Edit2, Archive, RotateCcw } from "lucide-react";
import { accountTone, GROUND_ALPHA, ICON_ALPHA } from "@/lib/utils/account-tone";
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
      // 20%, not the 7% this started at. The ground is a WASH, so what renders
      // is the tone composited over the card surface - and at 7% the rendered
      // grounds sat 7 apart from EACH OTHER while sitting 12-23 from an
      // untoned card. The eye compares two cards to each other, so the type was
      // genuinely unreadable and reading Gcash as a bank was correct. The alpha
      // is now a measured constant, and the separation it achieves is asserted
      // on the composite rather than on the specified hex.
      //
      // `p-5` became `p-4` because the ledger figure is 138.3px against 125px
      // of content at two-up - it fit the geometry but ate the padding.
      style={
        showTone
          ? {
              backgroundColor: `${tone.ground}${Math.round(GROUND_ALPHA * 255)
                .toString(16)
                .padStart(2, "0")}`,
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-md ${
              account.is_negative ? "bg-rose-500/10 text-rose-400" : ""
            }`}
            // Above the ground's alpha so the type mark reads on it rather than
            // dissolving into it.
            style={
              showTone
                ? {
                    backgroundColor: `${tone.ground}${Math.round(ICON_ALPHA * 255)
                      .toString(16)
                      .padStart(2, "0")}`,
                    color: tone.ground,
                  }
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
          {/* "BALANCE", not "Current Derived Balance".

              Two defects, one cause. At two-up the label wrapped to two lines
              and the figure's ascenders collided with it, on every card. And
              the label was carrying two words it did not need: "current" is
              implied by a balance being the present figure, and "derived" is an
              implementation detail - the tooltip below already explains it, in
              full, for anyone who asks.

              So the words go and the explanation stays where it belongs. This is
              the same shape as dropping "17% used" on the budget card: the
              label was restating a fact the figure beside it already carried. */}
          <span className="type-section-label text-muted-foreground">Balance</span>
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

      {/* Stacked, not a two-item row. At 165px the label and the figure could
          not share a line - the row ran past the card's right edge and clipped
          the figure, which is the worst possible failure for a balance: the
          number is present in the DOM and absent to the eye.

          `justify-between` is what created it. Two items on one line at half
          width have no slack, so either the label wraps or the figure is
          clipped, and there is no width at which both survive. The starting
          balance is also a secondary figure, so it does not need the primary
          line - the same reason it is already `figure-inline` while the
          balance above is `type-ledger`. */}
      <div className="mt-4 pt-3 border-t border-border flex flex-col gap-0.5 text-xs text-muted-foreground">
        <span>Starting Balance</span>
        <CurrencyDisplay amount={account.initial_balance} className="figure-inline font-medium text-muted-foreground" />
      </div>
    </div>
  );
}
