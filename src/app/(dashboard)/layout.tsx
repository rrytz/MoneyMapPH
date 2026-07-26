import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeProvider } from "@/providers/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { FinancialPulse } from "@/components/dashboard/financial-pulse";
import { Toaster } from "@/components/ui/sonner";
import type { Profile } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <FinancialPulse budgetUtilization={0} />
          <Topbar profile={profile as Profile | null} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
      <Toaster />
    </ThemeProvider>
  );
}
