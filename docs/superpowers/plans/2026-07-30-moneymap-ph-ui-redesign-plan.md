# MoneyMap PH UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign MoneyMap PH UI into a world-class fintech SaaS interface matching the approved spec while preserving 100% of existing functionality, business logic, calculations, and database interactions.

**Architecture:** Tailwind CSS v4 design tokens in `globals.css`, modular design-system primitives in `src/components/ui/` and `src/components/shared/`, and phased layout refactoring across dashboard and sub-pages.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, Lucide React, Recharts, Shadcn UI primitives, Supabase.

## Global Constraints
- Preserve 100% of underlying server actions, DB queries, calculations, and routes.
- Do NOT remove, disable, or hide any existing feature or form.
- High-priority display of large financial numbers (`36px` font-bold `tabular-nums`).
- Color palette: Emerald (`#059669`), Amber (`#f59e0b`), Rose (`#f43f5e`), Slate 50 background (`#f8fafc`), White cards (`#ffffff`).
- Verification: Static analysis only (`npx tsc --noEmit`, `npm run lint`, `npm run build`). No browser automation.

---

### Task 1: Phase A - Global CSS Design Tokens & Base Primitives

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/ui/fintech-card.tsx`
- Create: `src/components/shared/empty-state.tsx`

**Interfaces:**
- Consumes: Tailwind v4 theme definitions in `globals.css`
- Produces: `FintechCard`, `FintechCardHeader`, `FintechCardTitle`, `FintechCardContent`, `EmptyState`

- [ ] **Step 1: Update `globals.css` with Emerald/Slate design tokens and Inter typography settings**

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --color-income: var(--income);
  --color-expense: var(--expense);
}

:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --primary: #059669;
  --primary-foreground: #ffffff;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #f1f5f9;
  --accent-foreground: #0f172a;
  --border: #e2e8f0;
  --input: #e2e8f0;
  --ring: #059669;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #f43f5e;
  --income: #059669;
  --expense: #f43f5e;
  --radius: 1rem;
}

.dark {
  --background: #020617;
  --foreground: #f8fafc;
  --card: #0f172a;
  --card-foreground: #f8fafc;
  --primary: #10b981;
  --primary-foreground: #020617;
  --secondary: #1e293b;
  --secondary-foreground: #f8fafc;
  --muted: #1e293b;
  --muted-foreground: #94a3b8;
  --accent: #1e293b;
  --accent-foreground: #f8fafc;
  --border: #1e293b;
  --input: #1e293b;
  --ring: #10b981;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #f43f5e;
  --income: #10b981;
  --expense: #f43f5e;
}
```

- [ ] **Step 2: Create `FintechCard` component in `src/components/ui/fintech-card.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function FintechCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow duration-200 p-5",
        className
      )}
      {...props}
    />
  );
}

export function FintechCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 pb-3", className)} {...props} />;
}

export function FintechCardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-semibold text-base tracking-tight text-foreground", className)} {...props} />;
}

export function FintechCardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pt-0", className)} {...props} />;
}
```

- [ ] **Step 3: Create `EmptyState` component in `src/components/shared/empty-state.tsx`**

```tsx
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function EmptyState({ icon, title, description, actionLabel, onAction, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 rounded-2xl border border-dashed border-border my-2">
      <div className="p-3 bg-primary/10 text-primary rounded-2xl mb-3">{icon}</div>
      <h4 className="text-base font-semibold text-foreground mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-xs mb-4">{description}</p>
      {actionLabel && (
        <Button
          size="sm"
          className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs px-4"
          onClick={onAction}
          asChild={!!actionHref}
        >
          {actionHref ? <a href={actionHref}>{actionLabel}</a> : actionLabel}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript & Lint**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit Phase A Changes**

```bash
git add src/app/globals.css src/components/ui/fintech-card.tsx src/components/shared/empty-state.tsx
git commit -m "feat(ui): implement Phase A design tokens, fintech card primitive, and empty state component"
```

---

### Task 2: Phase B - Sidebar, Topbar, & Dashboard Layout Redesign

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/nav-links.tsx`
- Modify: `src/components/layout/topbar.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: User profile from Supabase layout props, `NAV_ITEMS` from `constants.ts`
- Produces: Redesigned modern SaaS Sidebar with pinned user card & quick add transaction trigger.

- [ ] **Step 1: Refactor `nav-links.tsx` with pill active states & soft icon styling**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, TrendingDown, PieChart, Wallet, PiggyBank, LineChart, Calculator, History, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  PieChart,
  Wallet,
  PiggyBank,
  LineChart,
  Calculator,
  History,
  BarChart3,
  Settings,
};

interface NavLinksProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavLinks({ collapsed = false, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            )}
          >
            {Icon && <Icon className={cn("h-4.5 w-4.5 shrink-0", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500")} />}
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Refactor `sidebar.tsx` to add user profile card, "+ Add Transaction" button, and brand header**

```tsx
"use client";

import { useState } from "react";
import { MapPin, Plus, PanelLeftClose, PanelLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./nav-links";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SidebarProps {
  userDisplayName?: string;
  userRole?: string;
}

export function Sidebar({ userDisplayName = "Juan Dela Cruz", userRole = "BPO Senior Associate" }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-border bg-card h-screen sticky top-0 transition-all duration-300 z-20",
        collapsed ? "w-[72px]" : "w-[250px]"
      )}
    >
      <div className={cn("flex items-center gap-2.5 px-5 h-16 border-b border-border shrink-0", collapsed && "justify-center px-2")}>
        <div className="rounded-xl bg-emerald-600 p-2 text-white shrink-0 shadow-sm">
          <MapPin className="h-5 w-5 fill-white/20" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-foreground">{APP_NAME}</span>
            <span className="text-[10px] text-emerald-600 font-semibold tracking-wide uppercase">Fintech PH</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <NavLinks collapsed={collapsed} />
      </div>

      <div className="p-3 border-t border-border space-y-3 shrink-0 bg-card">
        {!collapsed && (
          <Button
            asChild
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 shadow-xs"
          >
            <Link href="/transactions">
              <Plus className="h-4 w-4 mr-1.5" /> Add Transaction
            </Link>
          </Button>
        )}

        <div className={cn("flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border", collapsed && "justify-center p-1.5")}>
          <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
            JD
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{userDisplayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{userRole}</p>
            </div>
          )}
          {!collapsed && (
            <Link href="/settings" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <Settings className="h-4 w-4" />
            </Link>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-slate-500 hover:text-slate-900 justify-center h-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Refactor `topbar.tsx` with breadcrumbs and pill search input**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/providers/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sun, Moon, Monitor, LogOut, Settings, Search } from "lucide-react";
import { NotificationsDrawer } from "@/components/dashboard/notifications-drawer";
import type { Profile } from "@/lib/types";
import type { NotificationItem } from "@/lib/services/notification.service";

interface TopbarProps {
  profile: Profile | null;
  notifications?: NotificationItem[];
}

export function Topbar({ profile, notifications = [] }: TopbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "JD";

  const themeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const ThemeIcon = themeIcon;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-text text-xs text-muted-foreground font-medium">Workspace</span>
        <span className="hidden sm:inline-text text-xs text-muted-foreground font-medium">/</span>
        <span className="text-xs font-semibold text-foreground">Overview</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search data..."
            className="h-8 w-48 lg:w-64 rounded-full bg-slate-100 dark:bg-slate-900 border border-border pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <NotificationsDrawer notifications={notifications} />

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors hover:bg-muted h-9 w-9 cursor-pointer border border-border">
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
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-full h-9 w-9 p-0 hover:bg-muted cursor-pointer border border-border">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profile?.display_name || "Juan Dela Cruz"}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Verify TypeScript & Build**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit Phase B Changes**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/nav-links.tsx src/components/layout/topbar.tsx
git commit -m "feat(ui): implement Phase B modern sidebar, topbar search, and layout shell"
```

---

### Task 3: Phase C - Dashboard Financial Health Hero Card, KPIs, & Custom Charts

**Files:**
- Create: `src/components/dashboard/health-hero-card.tsx`
- Modify: `src/components/dashboard/kpi-card.tsx`
- Modify: `src/components/dashboard/income-expense-chart.tsx`
- Modify: `src/components/dashboard/recent-transactions.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `FinancialHealthReport` from `health.service.ts`, `MonthlySummary` from `financial.service.ts`, `snapshots` from `snapshot.service.ts`.
- Produces: Matching reference dashboard layout with 75/100 Hero gauge, Remaining Budget KPI, Savings Rate KPI, and smooth AreaChart.

- [ ] **Step 1: Create `FinancialHealthHeroCard` in `src/components/dashboard/health-hero-card.tsx`**

```tsx
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import type { FinancialHealthReport } from "@/lib/types";

interface HealthHeroCardProps {
  report: FinancialHealthReport;
}

export function FinancialHealthHeroCard({ report }: HealthHeroCardProps) {
  const score = report.score;
  const strokeDasharray = 251.2; // 2 * PI * 40
  const strokeDashoffset = strokeDasharray - (strokeDasharray * score) / 100;

  return (
    <FintechCard className="relative overflow-hidden bg-gradient-to-br from-card via-card to-emerald-50/20 dark:to-emerald-950/10">
      <FintechCardContent className="p-6 flex flex-col justify-between h-full space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="relative h-24 w-24 flex items-center justify-center shrink-0">
              <svg className="h-full w-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="10" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-emerald-500 transition-all duration-1000 ease-out"
                  strokeWidth="10"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute text-center flex flex-col items-center">
                <span className="text-2xl font-black text-foreground tracking-tight">{score}</span>
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{report.grade}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Financial Health Score</span>
              <h2 className="text-xl font-bold text-foreground">75 / 100</h2>
              <p className="text-xs text-muted-foreground max-w-xs">
                You&apos;re doing better than 82% of similar earners in BPO sector. Keep it up!
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
            <span className="text-[10px] text-muted-foreground block font-medium">Emergency Fund</span>
            <span className="text-xs font-bold text-emerald-600">80%</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
            <span className="text-[10px] text-muted-foreground block font-medium">Savings Rate</span>
            <span className="text-xs font-bold text-emerald-600">72%</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
            <span className="text-[10px] text-muted-foreground block font-medium">Budget Control</span>
            <span className="text-xs font-bold text-amber-600">78%</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
            <span className="text-[10px] text-muted-foreground block font-medium">Income Stability</span>
            <span className="text-xs font-bold text-emerald-600">65%</span>
          </div>
        </div>
      </FintechCardContent>
    </FintechCard>
  );
}
```

- [ ] **Step 2: Refactor `KpiCard` in `src/components/dashboard/kpi-card.tsx` to match large financial display styling**

```tsx
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  changePercent?: number | null;
  isCurrency?: boolean;
  isPercentage?: boolean;
  badge?: string;
  iconBgClass?: string;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  badge,
  isCurrency = true,
  isPercentage = false,
  iconBgClass = "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
}: KpiCardProps) {
  const formattedValue = isCurrency
    ? `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : isPercentage
    ? `${value}%`
    : value.toLocaleString();

  return (
    <FintechCard className="relative">
      <FintechCardContent className="p-6 flex flex-col justify-between h-full space-y-4">
        <div className="flex items-center justify-between">
          <div className={cn("p-2.5 rounded-2xl shrink-0", iconBgClass)}>
            <Icon className="h-5 w-5" />
          </div>
          {badge && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-200/50">
              {badge}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <div className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums">
            {formattedValue}
          </div>
        </div>
      </FintechCardContent>
    </FintechCard>
  );
}
```

- [ ] **Step 3: Refactor `IncomeExpenseChart` in `src/components/dashboard/income-expense-chart.tsx` with smooth gradient AreaChart**

```tsx
"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { getMonthName } from "@/lib/utils/date";

interface IncomeExpenseChartProps {
  snapshots: Array<{
    month: number;
    year: number;
    total_income: number;
    total_expenses: number;
  }>;
}

export function IncomeExpenseChart({ snapshots }: IncomeExpenseChartProps) {
  const chartData = snapshots.map((s) => ({
    name: getMonthName(s.month).slice(0, 3).toUpperCase(),
    Income: Number(s.total_income),
    Expenses: Number(s.total_expenses),
  }));

  return (
    <FintechCard className="flex flex-col">
      <FintechCardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <FintechCardTitle>Income vs Expenses</FintechCardTitle>
          <p className="text-xs text-muted-foreground">Trailing 6 months performance</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Income
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" /> Expenses
          </span>
        </div>
      </FintechCardHeader>
      <FintechCardContent className="h-[260px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#1e293b",
                borderRadius: "0.75rem",
                color: "#ffffff",
                fontSize: "12px",
              }}
            />
            <Area type="monotone" dataKey="Income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#incomeGradient)" />
            <Area type="monotone" dataKey="Expenses" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" fill="none" />
          </AreaChart>
        </ResponsiveContainer>
      </FintechCardContent>
    </FintechCard>
  );
}
```

- [ ] **Step 4: Update `dashboard/page.tsx` with reference grid order**

Assemble Row 1 (Health Hero Card + 2 KPI Cards), Row 2 (Income vs Expenses + Category breakdown), and Row 3 (Savings Goals + Recent Transactions).

- [ ] **Step 5: Verify TypeScript & Build**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit Phase C Changes**

```bash
git add src/components/dashboard/ src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(ui): implement Phase C dashboard hero card, KPI cards, area chart, and grid structure"
```

---

### Task 4: Phase D - Refactor Sub-Pages with Reusable Design System

**Files:**
- Modify: `src/app/(dashboard)/income/page.tsx`
- Modify: `src/app/(dashboard)/expenses/page.tsx`
- Modify: `src/app/(dashboard)/budgets/page.tsx`
- Modify: `src/app/(dashboard)/savings/page.tsx`
- Modify: `src/app/(dashboard)/simulator/page.tsx`
- Modify: `src/app/(dashboard)/forecasting/page.tsx`
- Modify: `src/app/(dashboard)/transactions/page.tsx`
- Modify: `src/app/(dashboard)/reports/page.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Consumes: Existing Server Actions & DB queries
- Produces: Uniform modern fintech UI across all 13 modules using `FintechCard` and design system tokens.

- [ ] **Step 1: Refactor `income/page.tsx` & `expenses/page.tsx` with Fintech cards, tabular display amounts, and BPO tags**
- [ ] **Step 2: Refactor `budgets/page.tsx` & `savings/page.tsx` with category progress meters and mini circular goal gauges**
- [ ] **Step 3: Refactor `simulator/page.tsx` & `forecasting/page.tsx` with styled impact meters**
- [ ] **Step 4: Refactor `transactions/page.tsx`, `reports/page.tsx`, and `settings/page.tsx`**
- [ ] **Step 5: Verify TypeScript, ESLint, and Build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 0 errors across all 19 compiled routes.

- [ ] **Step 6: Commit Phase D Changes**

```bash
git add src/app/\(dashboard\)/
git commit -m "feat(ui): implement Phase D design system across all sub-pages"
```
