import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import type { FinancialHealthReport } from "@/lib/types";

interface HealthHeroCardProps {
  report: FinancialHealthReport;
}

export function FinancialHealthHeroCard({ report }: HealthHeroCardProps) {
  const score = report.score;
  const strokeDasharray = 251.2; // 2 * PI * 40
  const strokeDashoffset = strokeDasharray - (strokeDasharray * score) / 100;

  return (
    <FintechCard className="relative overflow-hidden bg-card border border-border">
      <FintechCardContent className="p-6 flex flex-col justify-between h-full space-y-4">
        <div className="flex items-center gap-5" aria-label={`Financial Health Score: ${score} out of 100`}>
          <div className="relative h-24 w-24 flex items-center justify-center shrink-0">
            <svg className="h-full w-full transform -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-slate-100 dark:stroke-slate-800"
                strokeWidth="9"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-emerald-500 transition-all duration-1000 ease-out"
                strokeWidth="9"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute text-center flex flex-col items-center">
              <span className="text-2xl font-black text-foreground tracking-tight">{score}</span>
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                {report.grade}
              </span>
            </div>
          </div>

          <div className="space-y-1 min-w-0">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Financial Health Score
            </span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-bold text-foreground tracking-tight">{score} / 100</h2>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/50">
                {report.grade}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You&apos;re doing better than 82% of similar earners in BPO sector. Keep it up!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border">
          {[
            {
              label: "Emergency Fund",
              pct: Math.round((report.breakdown.emergencyFundScore / 30) * 100),
            },
            {
              label: "Savings Rate",
              pct: Math.round((report.breakdown.savingsRateScore / 30) * 100),
            },
            {
              label: "Budget Control",
              pct: Math.round((report.breakdown.budgetAdherenceScore / 20) * 100),
            },
            {
              label: "Paycheck Alloc.",
              pct: Math.round((report.breakdown.paycheckAllocationScore / 20) * 100),
            },
          ].map(({ label, pct }) => (
            <div key={label} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
              <span className="text-[10px] text-muted-foreground block font-medium">{label}</span>
              <span
                className={`text-xs font-bold ${
                  pct >= 75
                    ? "text-emerald-600 dark:text-emerald-400"
                    : pct >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {pct}%
              </span>
            </div>
          ))}
        </div>
      </FintechCardContent>
    </FintechCard>
  );
}
