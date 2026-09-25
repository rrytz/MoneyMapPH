"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMonthlySummary } from "@/lib/services/financial.service";
import { getDynamicNotifications } from "@/lib/services/notification.service";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { Topbar } from "@/components/layout/topbar";
import { DesktopNav } from "@/components/layout/desktop-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { FinancialPulse } from "@/components/dashboard/financial-pulse";
import { Toaster } from "@/components/ui/sonner";
import { getAccountsWithBalances } from "@/lib/services/account.service";
import { getSafeToSpend } from "@/lib/services/safe-to-spend.service";
import type { AccountWithBalance, Profile, SafeToSpendStatus } from "@/lib/types";
import type { NotificationItem } from "@/lib/services/notification.service";

const CHROME_TTL_MS = 60_000;

interface ChromeData {
  profile: Profile | null;
  notifications: NotificationItem[];
  budgetUtilization: number;
  /** S5b shell anchor: the glanceable answer, present on every page. */
  totalBalance: number;
  safeToSpend: SafeToSpendStatus | null;
  accounts: AccountWithBalance[];
  /**
   * Distinguishes "we have not fetched yet" from "the balance is genuinely
   * zero". Without this the shell anchor paints ₱0.00 before the query
   * resolves — a surface stating a fact it does not yet know, which is the
   * same violation the tide gauge avoids.
   */
  loaded: boolean;
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
  totalBalance: 0,
  safeToSpend: null,
  accounts: [],
  loaded: false,
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
      const [profileResult, summary, notifications, wallet, safeToSpend] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        getMonthlySummary(supabase, user.id, month, year).catch(() => null),
        getDynamicNotifications(supabase, user.id, dismissedIds).catch(() => []),
        getAccountsWithBalances(supabase, user.id).catch(() => null),
        getSafeToSpend(supabase, user.id).catch(() => null),
      ]);

      updateChrome(cacheKey, {
        profile: profileResult.data as Profile | null,
        notifications,
        budgetUtilization: summary?.budgetUtilization ?? 0,
        totalBalance: wallet?.totalLiquidity ?? 0,
        safeToSpend,
        accounts: wallet?.accounts ?? [],
        loaded: true,
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
  const {
    profile,
    notifications,
    budgetUtilization,
    totalBalance,
    safeToSpend,
    accounts,
    loaded,
  } = useChromeData();
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden">
        <Topbar
          profile={profile}
          notifications={notifications}
          totalBalance={totalBalance}
          safeToSpend={safeToSpend}
          accounts={accounts}
          loaded={loaded}
        />
        <DesktopNav />
        <main
          key={pathname}
          className="page-enter-anim flex-1 overflow-y-auto px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:pb-8"
        >
          {children}
        </main>
        <MobileNav />
      </div>
      <Toaster />
      <FinancialPulse budgetUtilization={budgetUtilization} />
    </>
  );
}