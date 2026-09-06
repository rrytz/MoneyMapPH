import Link from "next/link";
import { Logo } from "@/components/shared/logo";

const BARS = [
  { height: 52, gold: false },
  { height: 68, gold: false },
  { height: 40, gold: true },
  { height: 81, gold: false },
  { height: 60, gold: false },
  { height: 92, gold: false },
];

const STATS = [
  { value: "₱50k", label: "Avg. emergency fund goal" },
  { value: "2 min", label: "Daily logging time" },
  { value: "0–100", label: "Financial health score" },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8 sm:py-12 flex items-start sm:items-center justify-center dark:bg-background">
      <div className="auth-animate-rise w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-emerald-950/[0.06] dark:border-border dark:shadow-black/40 lg:grid lg:grid-cols-[1.15fr_1fr]">
        {/* Story panel */}
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden border-b border-border bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-10 xl:p-12 dark:from-emerald-950/50 dark:via-card dark:to-background lg:border-b-0 lg:border-r">
          <div
            aria-hidden
            className="auth-glow pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/20"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.55] dark:opacity-[0.12]"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--border) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(ellipse 80% 65% at 30% 15%, black 5%, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 80% 65% at 30% 15%, black 5%, transparent 75%)",
            }}
          />

          <div className="relative z-10">
            <Link href="/" className="inline-flex">
              <Logo size="md" showTagline />
            </Link>
          </div>

          <div className="relative z-10 -mt-6 mb-4">
            <h2 className="font-display text-[2rem] xl:text-[2.35rem] font-bold leading-[1.15] tracking-tight text-foreground">
              Your shift ends. Your{" "}
              <span className="text-emerald-600 dark:text-emerald-400">budget shouldn&apos;t guess.</span>
            </h2>
            <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
              Built for variable pay — basic, night diff, OT, and incentives — so
              your budget reflects the paycheck you actually get, not the one on paper.
            </p>
          </div>

          <div className="relative z-10">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Last 6 pay periods</span>
                <b className="font-semibold text-foreground tabular-nums">₱18,400 avg</b>
              </div>
              <div className="flex h-16 items-end gap-1.5">
                {BARS.map((bar, i) => (
                  <div
                    key={i}
                    className={`auth-bar flex-1 rounded-t-[5px] ${
                      bar.gold
                        ? "bg-gradient-to-t from-amber-500/20 to-amber-400"
                        : "bg-gradient-to-t from-emerald-600/20 to-emerald-500"
                    }`}
                    style={{ height: `${bar.height}%`, animationDelay: `${0.25 + i * 0.08}s` }}
                  />
                ))}
              </div>
              <div className="mt-4 flex gap-5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Salary + OT
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Lean cycle
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 flex gap-10 border-t border-border pt-6">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <b className="font-display block text-lg font-bold text-foreground">{stat.value}</b>
                <span className="text-[11px] text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form column */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12">{children}</div>
      </div>
    </div>
  );
}