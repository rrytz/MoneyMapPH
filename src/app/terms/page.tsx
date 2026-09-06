import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = {
  title: "Terms of Service · MoneyMap PH",
};

const sections = [
  {
    title: "The service",
    body: "MoneyMap PH is a personal finance tool for tracking expenses, budgets, income, and savings goals. Your data is yours; we don't use it for advertising and we don't share it with third parties outside the providers that operate the service.",
  },
  {
    title: "Your account",
    body: "You're responsible for keeping your sign-in credentials safe and for the activity that happens under your account. You may delete your account at any time by contacting us; deletion removes your stored data from our database.",
  },
  {
    title: "Acceptable use",
    body: "Use MoneyMap for legitimate personal bookkeeping. Don't attempt to disrupt the service, access other users' data, or use it for anything unlawful.",
  },
  {
    title: "No warranty",
    body: "The service is provided 'as is' and 'as available.' Financial figures and forecasts are informational tools, not financial advice. We aim for accuracy but can't guarantee it, and we're not liable for decisions you make based on the app.",
  },
  {
    title: "Changes",
    body: "We may update these terms or the service over time. Continued use after changes take effect means you accept the updated terms.",
  },
  {
    title: "Contact",
    body: "Questions about these terms? Reach us at contact@moneymap.ph.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <div className="mb-8">
          <Logo size="md" showTagline />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: September 7, 2026</p>
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold mb-2">{section.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            View Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
}