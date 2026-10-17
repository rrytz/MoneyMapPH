import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Shield, Zap, Leaf, Wallet, ChevronRight, ArrowUpRight } from "lucide-react";

const FEATURES = [
  { icon: Shield, title: "Secure", desc: "Your data is protected" },
  { icon: Zap, title: "Simple", desc: "Easier everyday" },
  { icon: Leaf, title: "Grow", desc: "Build your future" },
];

/* The auth surface is a branded, always-dark moment: "Agos" (current/flow)
   rendered as light on deep water. It is wrapped in a `.dark` scope so the
   shared Input/Button primitives resolve their dark tokens regardless of the
   visitor's app theme — the login page is deliberately theme-immune, and the
   dark: variants inside fire by construction rather than by luck. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-[#0b100d] text-white lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-[#0a1a10] via-[#071209] to-[#020805]"
        />
        <AuthWave />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-12">
          {/* Top: mark + tagline */}
          <div className="flex items-start justify-between">
            <Link href="/" className="inline-flex auth-animate-rise">
              <Logo size="md" />
            </Link>
            <p
              className="text-right text-xs leading-relaxed text-white/50 auth-animate-rise"
              style={{ animationDelay: "0.05s" }}
            >
              Smarter money.
              <br />A brighter tomorrow.
            </p>
          </div>

          {/* Center: eyebrow, headline, subtitle, balance card */}
          <div className="max-w-md">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sulpot-bright auth-animate-rise"
              style={{ animationDelay: "0.1s" }}
            >
              Your financial journey starts here
            </p>
            <h1
              className="type-page-title mt-4 text-[3.5rem] font-bold leading-[1.04] tracking-tight text-white auth-animate-rise"
              style={{ animationDelay: "0.15s" }}
            >
              Welcome to
              <br />
              <span className="text-sulpot-bright">Agos</span>
            </h1>
            <p
              className="mt-5 max-w-sm text-sm leading-relaxed text-white/60 auth-animate-rise"
              style={{ animationDelay: "0.22s" }}
            >
              Track your spending, set budgets, and build the life you want — one
              smart decision at a time.
            </p>

            {/* Glass balance card — a taste of the product, not live data */}
            <div
              className="mt-8 w-full max-w-sm rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md auth-animate-rise"
              style={{ animationDelay: "0.3s" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sulpot/15">
                    <Wallet className="h-4 w-4 text-sulpot" />
                  </span>
                  <span className="text-sm text-white/70">Total Balance</span>
                </div>
                <ChevronRight className="h-4 w-4 text-white/40" />
              </div>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[2rem] font-bold leading-none tracking-tight tabular-nums text-white">
                    ₱8,903.00
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="flex items-center gap-1 text-sm font-semibold text-sulpot-bright">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      +12.5%
                    </span>
                    <span className="text-xs text-white/50">vs. last month</span>
                  </div>
                </div>
                <Sparkline className="h-12 w-24 shrink-0" />
              </div>
            </div>
          </div>

          {/* Bottom: three promises */}
          <div className="grid grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="auth-animate-rise"
                style={{ animationDelay: `${0.38 + i * 0.06}s` }}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="h-4 w-4 text-sulpot-bright" />
                </span>
                <p className="mt-3 text-sm font-semibold text-white">{f.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-white/50">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Form column */}
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}

/* Flowing emerald ribbons — "Agos" (current) made visual. Three blurred
   gradient bands, faint where they meet the edges, brightest mid-panel. */
function AuthWave() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 900"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="agos-flow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
          <stop offset="42%" stopColor="#10b981" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#065f46" stopOpacity="0" />
        </linearGradient>
        <filter id="agos-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <g filter="url(#agos-soft)" fill="url(#agos-flow)">
        <path d="M-120,300 C160,150 400,440 920,240 L920,420 C400,630 160,340 -120,470 Z" />
        <path
          d="M-120,520 C220,380 460,640 920,470 L920,600 C460,790 220,540 -120,660 Z"
          opacity="0.7"
        />
        <path
          d="M-120,140 C140,50 380,300 920,120 L920,210 C380,400 140,160 -120,240 Z"
          opacity="0.5"
        />
      </g>
    </svg>
  );
}

function Sparkline({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 40"
      fill="none"
      preserveAspectRatio="none"
      className={className}
    >
      <defs>
        <linearGradient id="agos-spark" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" stopOpacity="0.25" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <path
        d="M2,33 C14,31 22,27 32,28 C44,29 50,18 60,16 C72,14 80,8 98,4"
        stroke="url(#agos-spark)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
