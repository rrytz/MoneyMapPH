import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = {
  title: "Privacy Policy · MoneyMap PH",
};

const sections = [
  {
    title: "Information we collect",
    body: "When you sign in with Google or email, we receive only the basics needed to identify your account: your name and email address. The financial data you enter (expenses, budgets, income, savings goals) lives in your own MoneyMap account and is never sold or shared.",
  },
  {
    title: "How your data is used",
    body: "Your data powers the features you use — budgets, summaries, notifications, and forecasting. We use two infrastructure providers: Supabase for authentication and database storage (hosted in Tokyo, ap-northeast-1), and Vercel to serve the app itself.",
  },
  {
    title: "Security",
    body: "All traffic to and from MoneyMap is encrypted with HTTPS. Passwords are never stored by our app — sign-in is handled entirely by Supabase Auth using industry-standard OAuth and password hashing. Your session is short-lived and refreshed automatically.",
  },
  {
    title: "Your choices",
    body: "You can sign out at any time, and you can permanently delete your account and all of its data by contacting us — we'll remove your records from our database.",
  },
  {
    title: "Contact",
    body: "Questions about this policy or your data? Reach us at contact@moneymap.ph.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <div className="mb-8">
          <Logo size="md" showTagline />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Privacy Policy</h1>
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
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
            View Terms of Service
          </Link>
        </p>
      </div>
    </main>
  );
}