"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMonthlySummary } from "@/lib/services/financial.service";
import { getDynamicNotifications } from "@/lib/services/notification.service";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { FinancialPulse } from "@/components/dashboard/financial-pulse";
import { Toaster } from "@/components/ui/sonner";
import type { Profile } from "@/lib/types";
import type { NotificationItem } from "@/lib/services/notification.service";

const CHROME_TTL_MS = 60_000;

interface ChromeData {
  profile: Profile | null;
  notifications: NotificationItem[];
  budgetUtilization: number;
}

interface ChromeCacheEntry {
  key: string;
  data: ChromeData;
  fetchedAt: number;
}

let chromeCache: ChromeCacheEntry | null = null;
let refreshInFlight: Promise<void> | null = null;
const chromeListeners = new Set<() => void>();

function getChromeSnapshot(): ChromeCacheEntry | null {
  return chromeCache;
}

function subscribeChrome(callback: () => void) {
  chromeListeners.add(callback);
  return () => {
    chromeListeners.delete(callback);
  };
}

function updateChrome(key: string, data: ChromeData) {
  chromeCache = { key, data, fetchedAt: Date.now() };
  chromeListeners.forEach((listener) => listener());
}

const DEFAULT_CHROME: ChromeData = {
  profile: null,
  notifications: [],
  budgetUtilization: 0,
};

async function refreshChrome(cacheKey: string, month: number, year: number) {
  if (refreshInFlight) return;

  refreshInFlight = (async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const dismissedIds = (user.user_metadata?.dismissed_notification_ids as string[]) || [];
      const [profileResult, summary, notifications] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        getMonthlySummary(supabase, user.id, month, year).catch(() => null),
        getDynamicNotifications(supabase, user.id, dismissedIds).catch(() => []),
      ]);

      updateChrome(cacheKey, {
        profile: profileResult.data as Profile | null,
        notifications,
        budgetUtilization: summary?.budgetUtilization ?? 0,
      });
    } catch {
      // Keep cached/default chrome so navigation is never blocked.
    }
  })();

  await refreshInFlight;
  refreshInFlight = null;
}

function useChromeData(): ChromeData {
  const pathname = usePathname();
  const { month, year } = getCurrentMonthYear();
  const cacheKey = `${year}-${month}`;

  const cacheEntry = useSyncExternalStore(subscribeChrome, getChromeSnapshot, () => null);

  const data: ChromeData =
    cacheEntry && cacheEntry.key === cacheKey ? cacheEntry.data : DEFAULT_CHROME;

  useEffect(() => {
    const isFresh =
      !!cacheEntry &&
      cacheEntry.key === cacheKey &&
      Date.now() - cacheEntry.fetchedAt < CHROME_TTL_MS;
    if (!isFresh && !refreshInFlight) {
      void refreshChrome(cacheKey, month, year);
    }
  }, [cacheKey, pathname, month, year, cacheEntry]);

  return data;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { profile, notifications, budgetUtilization } = useChromeData();

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <Sidebar profile={profile} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <FinancialPulse budgetUtilization={budgetUtilization} />
          <Topbar profile={profile} notifications={notifications} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
      <Toaster />
    </>
  );
}