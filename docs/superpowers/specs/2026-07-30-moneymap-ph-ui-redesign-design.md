# MoneyMap PH UI Redesign Design Specification

**Date**: 2026-07-30  
**Target System**: MoneyMap PH (Next.js 16 App Router + Tailwind CSS v4 + Supabase)  
**Goal**: Transform MoneyMap PH into a world-class, modern fintech SaaS UI inspired by Linear, Stripe Dashboard, Arc Browser, and Vercel, while preserving 100% of underlying business logic, routes, database interactions, calculations, forms, and server actions.

---

## 1. Executive Summary & Design Principles

### Visual Aesthetic & Persona
- **Design Persona**: Fintech SaaS for Philippines variable-income earners (BPO employees, call center agents, freelancers, overtime & incentive earners).
- **Core Visual Identity**: Clean Slate neutral backgrounds (`#f8fafc` light / `#020617` dark), Emerald primary accents (`#059669` / `#10b981`), Amber warnings (`#f59e0b`), Rose expense indicators (`#f43f5e`), soft card shadows (`shadow-sm shadow-slate-200/50`), and `rounded-2xl` cards.
- **Typography Scale**: Inter font with `tabular-nums` for financial clarity. Display numbers at 36px font-bold `tracking-tight` so financial metrics dominate visually.

---

## 2. Design System Tokens & Base Components

### 2.1 Color Tokens (`globals.css`)
- **Light Theme Tokens**:
  - Background: `slate-50` (`#f8fafc`)
  - Foreground: `slate-900` (`#0f172a`)
  - Card: `#ffffff`
  - Card Foreground: `slate-900` (`#0f172a`)
  - Primary: `emerald-600` (`#059669`) / Hover: `emerald-700` (`#047857`)
  - Primary Foreground: `#ffffff`
  - Success: `emerald-500` (`#10b981`)
  - Warning: `amber-500` (`#f59e0b`)
  - Danger / Expense: `rose-500` (`#f43f5e`)
  - Border: `slate-200` (`#e2e8f0`)
  - Muted: `slate-100` (`#f1f5f9`) / Muted Text: `slate-500` (`#64748b`)
- **Dark Theme Tokens**:
  - Background: `slate-950` (`#020617`)
  - Foreground: `slate-50` (`#f8fafc`)
  - Card: `slate-900` (`#0f172a`)
  - Card Foreground: `slate-50` (`#f8fafc`)
  - Primary: `emerald-500` (`#10b981`)
  - Border: `slate-800` (`#1e293b`)
  - Muted: `slate-800` (`#1e293b`) / Muted Text: `slate-400` (`#94a3b8`)

### 2.2 Reusable UI Component Primitives
- **Button System**: `Primary` (Emerald fill), `Secondary` (Slate muted), `Outline` (Slate border), `Ghost`. Height: `h-10`, `rounded-xl`, focus ring `ring-emerald-500`.
- **Badge System**: `Income` (Emerald soft badge), `Expense` (Rose soft badge), `Warning` (Amber soft badge), `Info` (Indigo/Purple soft badge). `rounded-full px-2.5 py-0.5 text-xs font-semibold`.
- **Card Primitive**: `bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow`.
- **Empty State Component**: Reusable component taking `icon`, `title`, `description`, `actionLabel`, `onAction` or `actionHref`.

---

## 3. Component Architecture & Refactoring Plan

### 3.1 Sidebar (`components/layout/sidebar.tsx` & `nav-links.tsx`)
- Logo header: **MoneyMap PH** with emerald logo mark.
- Navigation links: All 13 items retained (`Overview`, `Income Tracker`, `Expenses`, `Budget Management`, `Paycheck Planner`, `Savings Goals`, `Purchase Simulator`, `Forecasting`, `Transactions`, `Reports`, `Settings`).
- Soft pill active indicator: `bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-400`.
- Quick Add Button: `+ Add Transaction` button pinned near bottom.
- User Card at Bottom: Display avatar, full name (`Juan Dela Cruz`), role subtitle (`BPO Senior Associate`), and direct Settings link.

### 3.2 Topbar (`components/layout/topbar.tsx`)
- Left: Breadcrumb path (`Workspace > Overview`).
- Center/Right: Quick Search bar (`Search data...`), Notification drawer bell, Theme toggle dropdown, and Avatar dropdown.

### 3.3 Dashboard Hero & Grid Layout (`app/(dashboard)/dashboard/page.tsx`)
- **Row 1 (Hero & Core KPIs)**:
  - **Financial Health Hero Card**:
    - Circular SVG progress gauge (75 / 100).
    - Status badge: `Great Progress`.
    - 4 Sub-metric progress bars: Emergency Fund (80%), Savings Rate (72%), Budget Control (78%), Income Stability (65%).
    - Persona insight copy: *"You're doing better than 82% of similar earners in BPO sector. Keep it up!"*
  - **Remaining Budget KPI Card**:
    - Wallet icon badge in soft amber container.
    - Title: "Remaining Budget".
    - Display number: `₱14,270.00` in 36px font-bold `tracking-tight`.
  - **Savings Rate KPI Card**:
    - Piggy bank icon in soft purple container.
    - Top badge: `25% goal`.
    - Title: "Savings Rate".
    - Display number: `18.5%` in 36px font-bold `tracking-tight`.

- **Row 2 (Variable Income & Performance Charts)**:
  - **Income vs Expenses Area Chart (`income-expense-chart.tsx`)**:
    - Recharts AreaChart with monotone curve.
    - SVG LinearGradient fill (emerald `emerald-500` to transparent for income, subtle gray for expenses).
    - Rounded custom tooltip, subtle gridlines, custom legend.
  - **Variable Income & Spending Breakdown (`category-donut-chart.tsx` & Category progress bars)**:
    - BPO breakdown categories (Base Pay, Overtime, Night Differential, Incentives, Bonuses).
    - Horizontal progress bars per category with category icons and formatted amounts (`₱8,400`, `₱4,200`, etc.).

- **Row 3 (Goals & Recent Transactions)**:
  - **Savings Goals Card**:
    - Target goals with circular mini progress rings and current/target amounts.
    - Rich empty state if 0 goals exist.
  - **Recent Transactions Card (`recent-transactions.tsx`)**:
    - Modern table layout with hover states, soft borders, category badges (`FOOD` in rose, `INCOME` in emerald, `BILLS` in purple), and formatted amounts.

---

## 4. Preservation Matrix (Business Logic & Features)

| Feature | Visual Upgrade | Preservation Guarantee |
| :--- | :--- | :--- |
| **Income Tracking** | Redesigned form & list cards with BPO source tags (Night Diff, Overtime, Incentives) | 100% Supabase `income_entries` CRUD & calculation formulas intact |
| **Expense Tracking** | Refactored form modal & category cards | 100% Supabase `expenses` CRUD & category relations intact |
| **Budget Management** | Progress bar category allocation UI | 100% Supabase `budgets` & `budget_categories` intact |
| **Savings Goals** | Circular progress rings & goal cards | 100% DB trigger sync & contribution handlers intact |
| **Emergency Fund Tracker**| High-visibility status card & month coverage meter | 100% calculation formula in `forecast.service.ts` intact |
| **Forecasting** | Modern dual-line trend chart | 100% 6-month historical & 12-month projection logic intact |
| **Paycheck Planner** | Allocation progress cards & unallocated badges | 100% paycheck allocation calculations intact |
| **Purchase Simulator** | Interactive impact meter & goal timeline impact | 100% non-mutating simulation math intact |
| **Financial Health Score** | Hero card with 4 sub-metrics & circular ring | 100% `calculateFinancialHealthReport` service intact |
| **Transactions** | Unified table with search & type badges | 100% `getUnifiedTransactions` service intact |
| **Reports** | Clean printable report card layout | 100% `/transactions/print` & CSV export intact |
| **Notifications** | Drawer with budget/goal/paycheck warning badges | 100% `getDynamicNotifications` aggregator intact |
| **Settings** | Clean profile & preferences form card | 100% profile update & theme toggle intact |

---

## 5. Verification Plan

- **TypeScript Compilation**: Run `npx tsc --noEmit` to verify 0 compilation errors.
- **ESLint Code Quality**: Run `npm run lint` to verify clean application linting.
- **Production Build**: Run `npm run build` to verify Next.js 16 Turbopack production compilation across all 19 routes.
- **Zero Browser Automation**: All checks performed strictly via static code tools.
