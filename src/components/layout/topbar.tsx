"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/providers/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sun, Moon, Monitor, LogOut, Search, Wallet, Settings } from "lucide-react";
import { NotificationsDrawer } from "@/components/dashboard/notifications-drawer";
import { Logo } from "@/components/shared/logo";
import { TideMark } from "@/components/shared/tide-gauge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { cn } from "@/lib/utils";
import type { AccountWithBalance, Profile, SafeToSpendStatus } from "@/lib/types";
import type { NotificationItem } from "@/lib/services/notification.service";

/**
 * S5b — the shell.
 *
 * The old 64px topbar carried a hardcoded "Workspace › Overview" breadcrumb
 * (wrong on every page) and nothing else of substance. Both are gone.
 *
 * What replaces the removed sidebar is not navigation — it is the *answer*.
 * The balance readout is present on every page: total across accounts, with a
 * compact safe-to-spend meter. This is the "glance" register; home carries the
 * same answer large, as the "settle" register.
 *
 * There is no logo tile and no tagline: the balance says what the app is for.
 */
interface TopbarProps {
  profile: Profile | null;
  notifications?: NotificationItem[];
  totalBalance: number;
  safeToSpend: SafeToSpendStatus | null;
  accounts: AccountWithBalance[];
  loaded: boolean;
}

export function BalanceReadout({
  totalBalance,
  safeToSpend,
  accountCount,
  loaded,
  className,
}: {
  totalBalance: number;
  safeToSpend: SafeToSpendStatus | null;
  accountCount: number;
  loaded: boolean;
  className?: string;
}) {
  const negative = totalBalance < 0;
  // Share of the settled pool still unspent, derived from the service's own
  // fields (safeToSpend = income - spent, so the pool is safeToSpend + spent).
  // No waterline until the pool is actually known.
  const spent = safeToSpend ? Number(safeToSpend.spentThisPeriod) || 0 : 0;
  const remaining = safeToSpend ? Number(safeToSpend.safeToSpend) || 0 : 0;
  const pool = remaining + spent;
  const measured = !!safeToSpend?.hasPaychecks && pool > 0;
  const ratio = measured ? Math.max(0, Math.min(1, remaining / pool)) : 0;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <TideMark className={cn("h-4 w-4 shrink-0", loaded ? "text-sulpot" : "text-ink-faint")} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          {loaded ? (
            <span
              className={cn(
                "text-sm font-semibold tabular-nums leading-none",
                negative ? "text-rose" : "text-ink"
              )}
            >
              <CurrencyDisplay amount={totalBalance} signed className="figure-inline" />
            </span>
          ) : (
            /* Not fetched yet. Painting 0.00 here would state a fact we do
               not know — the same violation the tide gauge avoids. */
            <span className="text-sm font-semibold leading-none text-ink-faint">&mdash;</span>
          )}
          <span className="type-measurement text-[10px] text-ink-faint">
            {loaded ? `${accountCount} ${accountCount === 1 ? "account" : "accounts"}` : ""}
          </span>
        </div>
        <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-agosto-tint">
          {measured && (
            <div
              className="h-full rounded-full bg-sulpot"
              style={{ width: `${ratio * 100}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function Topbar({
  profile,
  notifications = [],
  totalBalance,
  safeToSpend,
  accounts,
  loaded,
}: TopbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName = profile?.display_name || "";
  const initials =
    displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "JD";

  const themeIcon = !mounted ? Monitor : theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const ThemeIcon = themeIcon;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-paper/90 px-4 backdrop-blur-md sm:px-6">
      <Link href="/dashboard" className="shrink-0" aria-label="MoneyMap PH home">
        <Logo iconOnly size="sm" />
      </Link>

      {/* The shell anchor — present on every page. */}
      <BalanceReadout
        totalBalance={totalBalance}
        safeToSpend={safeToSpend}
        accountCount={accounts.length}
        loaded={loaded}
        className="min-w-0"
      />

      <div className="ml-auto flex items-center gap-2">
        {/* Account switcher — accounts stay reachable without a page. */}
        {accounts.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium text-ink transition-colors hover:bg-inset">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="max-w-28 truncate">Accounts</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Your accounts
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {accounts.map((a) => (
                <DropdownMenuItem key={a.id} onSelect={() => router.push("/accounts")}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="truncate">{a.name}</span>
                    <span
                      className={cn(
                        "tabular-nums",
                        Number(a.current_balance) < 0 ? "text-rose" : "text-ink"
                      )}
                    >
                      <CurrencyDisplay amount={a.current_balance} signed className="figure-inline" />
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search data..."
            aria-label="Search"
            className="h-9 w-48 rounded-full border border-border bg-inset pl-9 pr-4 text-xs text-ink placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-sulpot lg:w-64"
          />
        </div>

        <NotificationsDrawer notifications={notifications} />

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink transition-colors hover:bg-inset">
            <ThemeIcon className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full">
            <Avatar className="h-9 w-9 border border-border">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
              <AvatarFallback className="bg-sulpot-tint text-xs font-semibold text-sulpot-deep">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">{displayName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
