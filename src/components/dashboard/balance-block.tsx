import Link from "next/link";
import { TideGauge, type TidePhase } from "@/components/shared/tide-gauge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SafeToSpendStatus } from "@/lib/types";

/**
 * S5b — the balance block. Home's single dominant element.
 *
 * This is the "settle" register of the same answer the top bar shows as
 * "glance". It carries the tide gauge, because the safe-to-spend cutoff *is*
 * the tide's edge — the app's most distinctive computation, made visual.
 *
 * The block is honest about what it knows: with no paychecks configured the
 * gauge stays UNMEASURED, and with a payday set but no entries it stays
 * AWAITING with the cutoff marked but no waterline. It never paints a full
 * meter derived from absent data.
 *
 * The character slot lives here — the first-run voice asks for a first
 * account, and the character otherwise stays silent.
 */

export interface BalanceBlockProps {
  totalBalance: number;
  safeToSpend: SafeToSpendStatus | null;
  hasAnyAccount: boolean;
  monthIncome?: number;
  monthExpenses?: number;
  className?: string;
}

export function BalanceBlock({
  totalBalance,
  safeToSpend,
  hasAnyAccount,
  monthIncome = 0,
  monthExpenses = 0,
  className,
}: BalanceBlockProps) {
  const negative = totalBalance < 0;
  const net = (Number(monthIncome) || 0) - (Number(monthExpenses) || 0);

  // Gauge inputs — the honest path.
  // The share still unspent is derived from the service's OWN two fields:
  // safeToSpend = (coreIncome + incentives) - spent, therefore
  // (coreIncome + incentives) = safeToSpend + spent. Dividing by that
  // reconstructed pool avoids re-deriving the income model here — a local
  // formula can silently disagree with the service, which is exactly what
  // happened when this component pro-rated coreIncome itself.
  const spent = safeToSpend ? Number(safeToSpend.spentThisPeriod) || 0 : 0;
  const remaining = safeToSpend ? Number(safeToSpend.safeToSpend) || 0 : 0;
  const settledPool = remaining + spent;

  // No accounts at all -> UNMEASURED. Accounts but no paycheck config ->
  // UNMEASURED (the cutoff does not exist yet). Paycheck configured but
  // nothing logged this period -> AWAITING (cutoff known, water unknown).
  const state: "unmeasured" | "awaiting" | "measured" = !hasAnyAccount || !safeToSpend?.hasPaychecks
    ? "unmeasured"
    : settledPool > 0
      ? "measured"
      : "awaiting";

  const remainingRatio = settledPool > 0 ? Math.max(0, Math.min(1, remaining / settledPool)) : 0;
  // Where the cutoff sits on the scale: how far through the period we are.
  const cutoffRatio = Math.max(0.1, Math.min(1, safeToSpend?.fractionElapsed || 0.5));

  const phase: TidePhase =
    state !== "measured" ? "agosto" : remainingRatio > 0.5 ? "sulpot" : "rising";

  const phaseLine: Record<TidePhase, string> = {
    agosto: "Agosto hanggang nextang sulpot.",
    rising: "Babang na ang tubig.",
    sulpot: "Sulpot na.",
  };

  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-6 sm:p-8", className)}
      aria-label="Your balance"
    >
      {hasAnyAccount ? (
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="caption text-muted-foreground">Total across your accounts</p>
            <p
              className={cn(
                "font-display text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl",
                negative ? "text-rose" : "text-ink"
              )}
            >
              <CurrencyDisplay amount={totalBalance} signed />
            </p>
            {state !== "unmeasured" && (
              <p className="text-sm text-muted-foreground">{phaseLine[phase]}</p>
            )}
          </div>

          <div className="max-w-xl">
            <TideGauge
              state={state}
              remainingRatio={remainingRatio}
              cutoffRatio={cutoffRatio}
              cutoffLabel={state === "unmeasured" ? undefined : <CurrencyDisplay amount={remaining} />}
              phase={phase}
            />
          </div>

          <div className="grid grid-cols-2 gap-6 border-t border-border pt-6 sm:grid-cols-3">
            <div>
              <p className="caption text-muted-foreground">Safe to spend</p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold tabular-nums",
                  remaining < 0 ? "text-rose" : "text-ink"
                )}
              >
                {state === "unmeasured" ? (
                  <span className="text-base font-normal text-muted-foreground">
                    Set a payday to see this
                  </span>
                ) : (
                  /* Preserve the sign: a breached cutoff is not positive funds. */
                  <CurrencyDisplay amount={remaining} signed />
                )}
              </p>
            </div>
            <div>
              <p className="caption text-muted-foreground">Spent this period</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                <CurrencyDisplay amount={spent} />
              </p>
            </div>
            <div>
              <p className="caption text-muted-foreground">Calendar month net</p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold tabular-nums",
                  net >= 0 ? "text-sulpot" : "text-rose"
                )}
              >
                {net >= 0 ? "+" : ""}
                <CurrencyDisplay amount={net} signed />
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* First-run: the balance block IS the invitation. The character speaks
           here because silence would read as broken rather than calm. */
        <div className="space-y-5">
          <p className="caption text-muted-foreground">Wala pang datos</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
            Itikha muna ang iyong unang account.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Once your first account exists, this space answers the only question that matters
            first: how much do you have right now.
          </p>
          <Link
            href="/accounts"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-sulpot-deep"
          >
            Add your first account
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
