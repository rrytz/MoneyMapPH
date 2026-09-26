import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { cn } from "@/lib/utils";
import type { SafeToSpendStatus } from "@/lib/types";

/**
 * S5b — the attention strip.
 *
 * The balance block already carries safe-to-spend and the cutoff, so a second
 * card repeating those numbers at ledger-figure weight put TWO loud figures on
 * the home surface — the exact uniformity this slice removes. What the balance
 * block cannot say is *urgency*, so that is all this strip carries: whether the
 * cutoff is at risk, and how long is left.
 *
 * It renders ONLY when something is actually due. When the cutoff is
 * comfortable it stays absent rather than padding the surface with a
 * reassurance no one asked for.
 *
 * Rose here is a data fact (the cutoff is breached), never a phase — the
 * agosto/lean vocabulary is disjoint from it.
 */
export function AttentionStrip({
  safeToSpend,
  className,
}: {
  safeToSpend: SafeToSpendStatus | null;
  className?: string;
}) {
  if (!safeToSpend || !safeToSpend.hasPaychecks) return null;

  const remaining = Number(safeToSpend.safeToSpend) || 0;
  const breached = remaining < 0;
  const daysLeft = Number(safeToSpend.daysRemaining) || 0;
  const pctElapsed = Math.round((Number(safeToSpend.fractionElapsed) || 0) * 100);
  const nearCutoff = !breached && remaining > 0 && daysLeft <= 3;

  // Nothing to flag: comfortable, or no urgency inside the last three days.
  if (!breached && !nearCutoff) return null;

  return (
    <aside
      aria-label="Needs attention"
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card px-6 py-4",
        breached ? "border-rose-500/40" : "border-amber-500/40",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            breached ? "bg-rose-500/10 text-rose" : "bg-amber-500/10 text-amber"
          )}
        >
          {breached ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            {breached ? "Over this cutoff" : "Cutoff is close"}
          </p>
          <p className="text-xs text-muted-foreground">
            {breached ? (
              <>
                Spending is{" "}
                <span className="font-semibold tabular-nums text-rose">
                  <CurrencyDisplay amount={Math.abs(remaining)} className="figure-inline" />
                </span>{" "}
                past the line. It is information, not a verdict — lean months happen.
              </>
            ) : (
              <>
                {daysLeft} {daysLeft === 1 ? "day" : "days"} left in this cutoff ({pctElapsed}%
                elapsed).
              </>
            )}
          </p>
        </div>
      </div>
      <Link
        href="/expenses"
        className="text-xs font-semibold text-sulpot-deep hover:underline"
      >
        Review spending
      </Link>
    </aside>
  );
}
