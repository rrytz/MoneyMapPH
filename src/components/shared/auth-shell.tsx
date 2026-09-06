import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { PayStrip } from "@/components/shared/pay-strip";

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
            <Link href="/" className="inline-flex auth-animate-rise">
              <Logo size="md" showTagline />
            </Link>
          </div>

          <div className="relative z-10 -mt-6 mb-4">
            <h2 className="auth-animate-rise font-display text-[2rem] xl:text-[2.35rem] font-bold leading-[1.15] tracking-tight text-foreground">
              You work hard for it.{" "}
              <span className="text-emerald-600 dark:text-emerald-400">Make it work for you.</span>
            </h2>
            <p
              className="auth-animate-rise mt-4 max-w-[34ch] text-sm leading-relaxed text-muted-foreground"
              style={{ animationDelay: "0.1s" }}
            >
              Track spending, set budgets that fit your life, and grow real
              savings — from your first paycheck to your fiftieth.
            </p>
          </div>

          <div className="auth-animate-rise relative z-10" style={{ animationDelay: "0.2s" }}>
            <PayStrip />
          </div>

          <div
            className="auth-animate-rise relative z-10 mt-6 flex gap-10 border-t border-border pt-6"
            style={{ animationDelay: "0.3s" }}
          >
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