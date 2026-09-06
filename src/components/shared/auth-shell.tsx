import Link from "next/link";
import { Logo } from "@/components/shared/logo";

const features = [
  {
    title: "Track expenses in seconds",
    body: "Log spending and income on the go — categorized, organized, always current.",
  },
  {
    title: "Budgets that flex with you",
    body: "Set limits per category and see where you stand before the month ends.",
  },
  {
    title: "Forecast ahead",
    body: "Forecasting and savings tools turn today's numbers into tomorrow's plan.",
  },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-emerald-950 p-10 xl:p-14 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-emerald-500/25 blur-[110px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-20 -left-24 h-80 w-80 rounded-full bg-teal-400/20 blur-[100px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-900/60 via-transparent to-teal-800/40"
        />

        <div className="relative">
          <Link href="/" className="inline-flex">
            <Logo size="md" showTagline tone="light" />
          </Link>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight">
            Your money,{" "}
            <span className="text-emerald-300">mapped out.</span>
          </h2>
          <ul className="mt-8 space-y-6">
            {features.map((feature) => (
              <li key={feature.title} className="flex gap-4">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <p className="font-semibold sm:text-sm">{feature.title}</p>
                  <p className="text-sm text-emerald-100/70">{feature.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-sm text-emerald-100/60">
          Built for Filipino savers. Plan • Track • Grow
        </div>
      </div>

      {/* Form panel */}
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="mb-8 lg:hidden">
          <Link href="/" className="inline-flex">
            <Logo size="lg" showTagline />
          </Link>
        </div>
        <div className="w-full max-w-md">{children}</div>
        <p className="mt-10 max-w-md px-4 text-center text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>
          . Your data is encrypted and never sold.
        </p>
      </div>
    </div>
  );
}