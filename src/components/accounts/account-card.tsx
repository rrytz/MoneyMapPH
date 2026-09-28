"use client";

import type { AccountWithBalance } from "@/lib/types";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { cn } from "@/lib/utils";
import { Wallet, Landmark, CreditCard, DollarSign, Smartphone, AlertTriangle, MoreVertical, Edit2, Archive, RotateCcw } from "lucide-react";
import { accountBrand, getAccountBrandPalette, ICON_FILL_ALPHA, brandHairline, withAlpha } from "@/lib/utils/account-brand";
import { LOGO_HEIGHT_PX, resolveBrandLogo } from "@/lib/utils/brand-logos";
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
  // Suppressed on NEGATIVE cards on purpose: that is a state the reader must
  // not miss, and a coloured ground behind a rose border is two things asking
  // to be looked at at once.
  //
  // NOT suppressed on archived cards. Archived used to be grouped with negative
  // here, which meant no CSS variables were defined at all: every label fell
  // back to a theme token and the card measured 1.28:1 in light mode - dark
  // text on a near-black `bg-card/60` surface. An archived card is still that
  // bank's card, and de-emphasis is the Archived pill's job, not the
  // legibility of the whole card.
  const brand = getAccountBrandPalette(account);
  // The BRAND key, resolved the same way the palette resolves it, so the logo and
  // the colours can never come from two different matchers. `null` for cash and
  // for an unknown account, which is what routes it to the monogram.
  const brandKey = accountBrand(account);
  // Resolved ONCE and branched on. The stacked identity and the removed type icon
  // apply only when there is a real mark; a null mark keeps the monogram + icon.
  const brandLogo = resolveBrandLogo(brandKey ?? "neutral");
const isBrandSurface = !account.is_negative;

  return (
    <div
      // Structural marker, so the gate can identify a card WITHOUT inferring it
      // from an inline background. The previous collector selected on
      // `el.style.backgroundColor`, which meant any card that did not paint a
      // brand base was silently invisible to it - including the archived state,
      // whose "coverage" was seven active cards being re-measured.
      data-account-card={account.name}
      // The state itself, as a structural handle. The gate used to detect an
      // archived card by scanning for a leaf whose text was exactly "Archived"
      // - i.e. identifying the STATE by its visible label. Rename the pill and
      // the check silently stops finding archived cards, which is the
      // archived-false-pass defect a third time over. The label is copy; this
      // is the fact.
      data-account-archived={account.is_archived || undefined}
      className={`relative rounded-2xl border p-4 transition-all [border-color:var(--brand-line)] ${
        account.is_negative
          ? "border-rose-500/50 bg-rose-500/10 dark:bg-rose-950/20"
          : account.is_archived
            ? // Still the brand surface. `bg-card/60` + `opacity-60` was a theme
              // surface at 60% over whatever the page happened to be, and the
              // text on it was never re-measured against that composite.
              "hover:border-[color:var(--brand-line)]"
            : "hover:border-[color:var(--brand-line)]"
      }`}
      // Painted SOLID, as `brand.base` and not as a wash over `bg-card`.
      //
      // The palette's text-contrast ratios are computed against these exact
      // values, so blending them at an alpha would render a colour nobody
      // measured. That is the mistake this file was born out of: the previous
      // type palette specified pure hexes, tested THOSE, then painted a 7%-alpha
      // wash - and the rendered grounds came out 7 units apart from each other
      // while sitting 12-23 from no ground at all, which is why a bank and an
      // e-wallet were indistinguishable. A wash would put that straight back.
      style={
        isBrandSurface
          ? ({
              backgroundColor: brand.base,
              // CSS variables rather than inline colours on each child, because
              // CurrencyDisplay sets its OWN colour class - a parent inline
              // colour is inherited only by children that do not set one, and
              // that is exactly why the balance stayed dark in light mode while
              // every other label was fixed.
              "--brand-on": brand.onBase,
              "--brand-muted": brand.mutedOnBase,
              "--brand-line": brandHairline(brand.onBase),
              // INTERACTIVE STATES, derived from the brand and never from the
              // theme. The trigger previously used `text-muted-foreground` /
              // `hover:text-foreground` / `hover:bg-muted` - three theme
              // tokens. The resting one already failed at 2.86:1 on GCash's
              // base, and the hover pair went to `text-foreground`, which is
              // near-black in light mode on a dark base. A brand card is not a
              // themed surface, so it carries its own states.
              "--brand-on-hover": withAlpha(brand.onBase, 1),
              "--brand-hover-bg": withAlpha(brand.onBase, 0.12),
              "--brand-focus-ring": withAlpha(brand.onBase, 0.55),
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          {brandLogo ? (
            /* RECOGNISED BRAND — stacked identity.
               [ logo ]
               [ name ]
               [ type ]

               This is a measured change, not a preference. The mobile grid is
               2-up, so a card is 165px wide and its inner content ~133px. A
               side-by-side lockup put a 56-84px wordmark next to the account
               name and overflowed the card: Unionbank's name ended 62px past the
               card edge, and four of eight cards reported clipped text. The
               gate failed on it, which is the only reason it was caught.

               Stacking gives the mark the full inner width, so nothing is
               truncated, nothing is width-capped, and the aspect ratio and the
               fixed 18px height both survive untouched. The alternative fixes
               all buy that by distorting the mark, shrinking it to ~12px, or
               changing the grid.

               The generic type icon is gone here on purpose: a bank glyph beside
               a bank wordmark says the same thing twice, and the mark is the
               specific answer. */
            <div className="flex flex-col gap-1.5 min-w-0" data-account-identity="stacked">
              <span
                data-account-logo
                data-brand={brandKey ?? "neutral"}
                className="inline-flex items-center [color:var(--brand-on)] min-w-0 max-w-full"
                style={{ height: LOGO_HEIGHT_PX, width: "auto" }}
              >
                {brandLogo}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <h3 className="font-semibold text-base [color:var(--brand-on)] min-w-0 break-words">
                    {account.name}
                  </h3>
                  {account.is_archived && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 [color:var(--brand-on)] [background-color:var(--brand-hover-bg)]">
                      Archived
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium capitalize [color:var(--brand-muted)]">
                  {account.type.replace("_", " ")}
                  {account.type === "credit" && " (Ledger)"}
                </span>
              </div>
            </div>
          ) : (
            /* NO RECOGNISED MARK — the existing monogram + type icon, unchanged.
               This is the fallback path the gate asserts is exercised, so it is
               deliberately NOT restyled to match the stacked branch. */
            <>
              <div
                className={`p-2.5 rounded-md shrink-0 ${
                  account.is_negative ? "bg-rose-500/10 text-rose-400" : ""
                }`}
                style={
                  isBrandSurface
                    ? {
                        backgroundColor: `${brand.base}${Math.round(ICON_FILL_ALPHA * 255)
                          .toString(16)
                          .padStart(2, "0")}`,
                        color: brand.accent,
                      }
                    : undefined
                }
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                data-account-logo
                data-brand={brandKey ?? "neutral"}
                className="inline-flex items-center justify-center shrink-0 [color:var(--brand-on)]"
                style={{ height: LOGO_HEIGHT_PX, width: "auto" }}
              >
                <span
                  data-account-logo-mono
                  className="inline-flex items-center justify-center font-semibold uppercase leading-none rounded-sm w-full h-full [background-color:var(--brand-hover-bg)]"
                >
                  {(account.name || "?").charAt(0)}
                </span>
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <h3 className="font-semibold text-base [color:var(--brand-on)] min-w-0 break-words">
                    {account.name}
                  </h3>
                  {account.is_archived && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 [color:var(--brand-on)] [background-color:var(--brand-hover-bg)]">
                      Archived
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium capitalize [color:var(--brand-muted)]">
                  {account.type.replace("_", " ")}
                  {account.type === "credit" && " (Ledger)"}
                </span>
              </div>
            </>
          )}
        </div>

        <DropdownMenu>
          {/* Theme tokens here were the live leak: `text-muted-foreground`
              resolved to rgb(102,112,99) in light mode - 2.86:1 on GCash's
              base - and `hover:text-foreground` went to near-black on a dark
              base. Both removed, not out-ranked: a competing utility of equal
              specificity cannot be beaten by a variable, only by absence. */}
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center rounded-md p-2 cursor-pointer [color:var(--brand-muted)] hover:[color:var(--brand-on-hover)] hover:[background-color:var(--brand-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!account.is_archived && (
              <>
                <DropdownMenuItem data-account-action="edit" onClick={() => onEdit(account)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Account
                </DropdownMenuItem>
                <DropdownMenuItem data-account-action="transfer" onClick={() => onTransfer(account)}>
                  <Wallet className="h-4 w-4 mr-2" />
                  Transfer From/To
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem data-account-action={account.is_archived ? "unarchive" : "archive"} onClick={() => onArchive(account)}>
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
          <span className="type-section-label [color:var(--brand-muted)]">Balance</span>
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

        <div className="tabular-nums [color:var(--brand-on)]">
          <CurrencyDisplay
            amount={account.current_balance}
            className={cn(
              "type-ledger",
              account.is_negative ? "font-semibold text-rose-400" : "font-semibold [color:var(--brand-on)]"
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
      <div data-account-divider className="mt-4 pt-3 border-t flex flex-col gap-0.5 text-xs [color:var(--brand-muted)] border-[color:var(--brand-line)]">
        <span>Starting Balance</span>
        <CurrencyDisplay amount={account.initial_balance} className="figure-inline font-medium [color:var(--brand-muted)]" />
      </div>
    </div>
  );
}
