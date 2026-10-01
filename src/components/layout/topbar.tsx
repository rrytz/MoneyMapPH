"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/providers/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sun, Moon, Monitor, LogOut, Settings } from "lucide-react";
import { NotificationsDrawer } from "@/components/dashboard/notifications-drawer";
import { Logo } from "@/components/shared/logo";
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
    <div className={cn("flex items-center", className)}>
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
          {/* Hidden below sm. At 320px the header has ~131px of content width
              after the logo, four circular controls and the safe-area gutter -
              and "₱3,300.00" alone spends most of it. The count was wrapping to
              two lines and the second line ran into the Accounts button. It is
              also the most redundant thing here: the button beside it opens the
              account list that answers the same question. The balance is the
              identity and stays; the meter is the signal and stays. */}
          <span className="type-measurement hidden text-[10px] text-ink-faint sm:inline">
            {loaded ? `${accountCount} ${accountCount === 1 ? "account" : "accounts"}` : ""}
          </span>
        </div>
        {/* w-full max-w-28 rather than a fixed w-28: the fixed width overflowed
            its own min-w-0 parent on a phone, where the cap never applies but
            the container is already narrower than 112px. */}
        <div className="mt-1.5 h-1 w-full max-w-28 overflow-hidden rounded-full bg-agosto-tint">
          {measured && (
            <div
              // Read by the meter sweep. It used to be located with
              // `div[style*="width"]`, which matches any div carrying an inline
              // width and so reported whichever came first rather than this one.
              data-meter-fill
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
    // h-14 on mobile, h-16 from lg. The bar was one height at every width,
    // which is a desktop toolbar measured in a phone's budget: measured at
    // 390px, the labelled Accounts button alone spent 95px - a quarter of the
    // viewport - to say one word. Desktop is untouched.
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-paper/90 px-4 backdrop-blur-md sm:px-6 lg:h-16">
      <Link href="/dashboard" className="shrink-0" aria-label="MoneyMap PH home">
        {/* The one brand mark. It was rendering twice - this Logo, and a second
            TideMark inside the balance readout - at 24px and 16px, from the same
            commit. The mark now carries the readout's loaded tone instead, so a
            single element does four jobs: linked, aria-labelled, sized, and
            faint until the balance exists. That upholds "no surface may imply
            knowledge it lacks" from the one place a reader looks first, and it
            reclaims 28px at 320px, where the readout had only 80px to work with. */}
        <Logo iconOnly size="sm" tone={loaded ? "default" : "faint"} />
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
        {/* The wallet/accounts dropdown lived here. Removed: /accounts is a
            primary tab in the mobile bottom nav AND in the desktop nav, so the
            icon duplicated a first-class destination on every width. The
            per-account balances it showed inline live on /accounts itself. */}

        {/* Search lived here as an uncontrolled input with no value, onChange,
            submit, form, or URL state - a non-feature, removed rather than
            wired. The right cluster is ml-auto anchored, so nothing shifts. */}
        <NotificationsDrawer notifications={notifications} />

        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-ink transition-colors hover:bg-inset lg:rounded-lg"
            aria-label="Theme"
          >
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
          <DropdownMenuTrigger className="shrink-0 rounded-full" aria-label="Account menu">
            <Avatar className="h-9 w-9 border border-border">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
              <AvatarFallback className="bg-sulpot-tint text-xs font-semibold text-sulpot-deep">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Group wrapper is load-bearing: see the accounts menu above. */}
            <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs">{displayName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
