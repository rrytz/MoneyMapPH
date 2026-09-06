import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeProvider } from "@/providers/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { FinancialPulse } from "@/components/dashboard/financial-pulse";
import { Toaster } from "@/components/ui/sonner";
import { getDynamicNotifications } from "@/lib/services/notification.service";
import { getMonthlySummary } from "@/lib/services/financial.service";
import { getCurrentMonthYear } from "@/lib/utils/date";
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

  const { month, year } = getCurrentMonthYear();
  const dismissedIds: string[] = (user.user_metadata?.dismissed_notification_ids as string[]) || [];

  const [profileRes, notifications, summary] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single(),
    getDynamicNotifications(supabase, user.id, dismissedIds).catch(() => []),
    getMonthlySummary(supabase, user.id, month, year).catch(() => null),
  ]);

  const profile = profileRes.data;
  const budgetUtilization = summary?.budgetUtilization ?? 0;

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar profile={profile as Profile | null} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <FinancialPulse budgetUtilization={budgetUtilization} />
          <Topbar profile={profile as Profile | null} notifications={notifications} />
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
