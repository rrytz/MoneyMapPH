"use client";

import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ExpenseForm } from "@/components/forms/expense-form";
import { IncomeForm } from "@/components/forms/income-form";
import { cn } from "@/lib/utils";
import type { AccountWithBalance, ExpenseCategory, IncomeSource } from "@/lib/types";

/**
 * Quick add — the floating "+".
 *
 * A controller, not a wrapper. ExpenseForm and IncomeForm are each already a
 * Sheet that calls its own server action, so this renders exactly ONE surface
 * at a time and swaps between them. Nesting a choice sheet inside them (or
 * them inside a choice sheet) would mean two dialogs fighting over focus and
 * an escape key; swapping means there is only ever one.
 *
 * Why two choices and not one action: "+" is a primary control, so it has to
 * work on its own today. A "+" that logged an expense would make income - which
 * this app tracks as salary, night differential, overtime and incentives - the
 * harder action, and would bake that bias into the primary control invisibly.
 *
 * Why this is additive to the bottom nav rather than replacing its last slot:
 * the nav's fifth item is "More", and it is the only mobile home for six
 * destinations. A "+" means create, not navigate, so putting navigation behind
 * it would make those destinations unreachable by meaning.
 */
type Mode = "choose" | "expense" | "income" | null;

/**
 * The button. Sits ABOVE the bottom nav rather than overlapping it. The bottom
 * offset repeats the nav's own expression - 4rem for its min-h-16, plus the
 * same env(safe-area-inset-bottom) the nav already uses - so it tracks the home
 * indicator instead of assuming a device that has one. Overlapping would need
 * the nav to reserve horizontal space so its last destination is not trapped
 * underneath.
 */
function QuickAddFab({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Add a transaction"
      className={cn(
        "fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full lg:hidden",
        "bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)]",
        "bg-sulpot text-white shadow-lg transition-transform active:scale-95"
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}

/**
 * One component owns the mode, so the button and the sheet cannot drift apart:
 * the FAB is the only thing that opens "choose", and it is hidden at lg with
 * the rest of the mobile chrome.
 */
export function QuickAdd({
  accounts,
  categories,
  sources,
}: {
  accounts: AccountWithBalance[];
  categories: ExpenseCategory[];
  sources: IncomeSource[];
}) {
  const [mode, setMode] = useState<Mode>(null);
  const close = () => setMode(null);

  if (mode === "expense") {
    return (
      <ExpenseForm
        open
        onOpenChange={(open) => !open && close()}
        categories={categories}
        accounts={accounts}
      />
    );
  }

  if (mode === "income") {
    return (
      <IncomeForm
        open
        onOpenChange={(open) => !open && close()}
        sources={sources}
        accounts={accounts}
      />
    );
  }

  return (
    <>
      <QuickAddFab onOpen={() => setMode("choose")} />
      <Sheet open={mode === "choose"} onOpenChange={(open) => !open && close()}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t border-border bg-card p-6 pt-4"
        >
          <SheetHeader className="pb-4">
            <SheetTitle className="text-base font-bold text-foreground">
              Add a transaction
            </SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setMode("expense")}
              className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-muted/30 p-4 text-left transition-colors hover:bg-muted/70"
            >
              <TrendingDown className="h-5 w-5 text-rose" />
              <span className="text-sm font-semibold text-foreground">An expense</span>
              <span className="text-[11px] text-muted-foreground">Something you spent</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("income")}
              className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-muted/30 p-4 text-left transition-colors hover:bg-muted/70"
            >
              <TrendingUp className="h-5 w-5 text-sulpot-deep dark:text-sulpot-bright" />
              <span className="text-sm font-semibold text-foreground">Income</span>
              <span className="text-[11px] text-muted-foreground">
                Payday, overtime, incentives
              </span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
