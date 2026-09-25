import { cn } from "@/lib/utils";

/**
 * Tide gauge (S5a) — the app's signature instrument.
 *
 * The safe-to-spend cutoff IS the tide's edge, so the app's most distinctive
 * computation becomes the identity's visual instrument. No face: this is a
 * measuring device, not a character.
 *
 * Three states, and the important one is AWAITING. With a payday configured and
 * zero transactions, the naive safe-to-spend computation returns a *full*
 * figure. Painting that as a maximum waterline would present the absence of
 * data as excellent news — so the gauge withholds the mark until the water is
 * actually known. (Principle: no surface may imply knowledge it lacks.)
 */

export type TidePhase = "agosto" | "rising" | "sulpot";
export type GaugeState = "unmeasured" | "awaiting" | "measured";

export interface TideGaugeProps {
  state: GaugeState;
  /** 0–1: how much of the expected income to date remains unspent. */
  remainingRatio?: number;
  /** 0–1: where the cutoff sits on the scale. */
  cutoffRatio?: number;
  /** Rendered at the cutoff notch — the safe-to-spend figure. */
  cutoffLabel?: React.ReactNode;
  phase?: TidePhase;
  className?: string;
}

const PHASE_LABEL: Record<TidePhase, string> = {
  agosto: "AGOSTO",
  rising: "RISING",
  sulpot: "SULPOT",
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function TideGauge({
  state,
  remainingRatio = 0,
  cutoffRatio = 0,
  cutoffLabel,
  phase = "agosto",
  className,
}: TideGaugeProps) {
  const unmeasured = state === "unmeasured";
  const awaiting = state === "awaiting";
  const showWater = state === "measured";
  const showCutoff = state !== "unmeasured";
  const water = clamp01(remainingRatio) * 100;
  const cutoff = clamp01(cutoffRatio) * 100;

  return (
    <div className={cn("w-full", className)} data-gauge-state={state}>
      {/* Track + graduations */}
      <div
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full",
          unmeasured ? "bg-agosto-tint" : "bg-agosto-tint"
        )}
        role="img"
        aria-label={
          unmeasured
            ? "Tide gauge not yet measured"
            : awaiting
              ? "Tide gauge awaiting the first entry"
              : `${PHASE_LABEL[phase]} — ${Math.round(water)} percent of expected income remaining`
        }
      >
        {/* graduations — measurement chrome, so Martian Mono territory */}
        <div className="pointer-events-none absolute inset-0 flex justify-between px-[1px]">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span
              key={t}
              className={cn(
                "h-full w-px",
                unmeasured ? "bg-agosto/25" : "bg-agosto/40"
              )}
            />
          ))}
        </div>

        {/* the water — only when actually measured */}
        {showWater && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-sulpot transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${water}%` }}
          />
        )}

        {/* the cutoff — the tide's edge.
            An index mark, not a graduation: it breaks out of the track on both
            sides so it can never be read as one of the minor ticks. A 2px line
            inside a 2px-tall track is invisible against 1px ticks, which made
            the app's signature idea the least legible thing on the gauge. */}
        {showCutoff && (
          <span
            className="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full bg-ink"
            style={{ left: `${cutoff}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* readouts.
          The phase label is functional text, not data — it carries ink weight.
          Desaturation belongs to the water and the track, never to the word
          itself, or "lean" reads as a disabled control rather than a state. */}
      <div className="mt-2.5 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-muted">
          {unmeasured ? "HINDI PA NAKAKITA" : PHASE_LABEL[phase]}
        </span>
        {showCutoff && cutoffLabel && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink">
            Cutoff {cutoffLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The mark at small sizes (top-bar glance, 16–24px). Wave + line, no face.
 * Same visual language as the full gauge, reduced.
 */
export function TideMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-4 w-4", className)}
      aria-hidden="true"
    >
      <path
        d="M2 9c3-2.5 5-2.5 8 0s5 2.5 8 0 4-1.5 4-1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M2 17h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}
