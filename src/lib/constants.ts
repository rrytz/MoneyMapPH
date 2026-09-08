export const APP_NAME = "MoneyMap PH";

export const BUDGET_THRESHOLDS = {
  UNDER: 75,
  NEAR: 100,
} as const;

export const LEAN_CUTOFF_THRESHOLD = 0.75;
export const MIN_LEAN_PERIODS = 6;
export const LEAN_WINDOW_PERIODS = 24;

export const ITEMS_PER_PAGE = 20;

export const CURRENCY_MAP: Record<string, { symbol: string; code: string; locale: string }> = {
  PHP: { symbol: "₱", code: "PHP", locale: "en-PH" },
  USD: { symbol: "$", code: "USD", locale: "en-US" },
  EUR: { symbol: "€", code: "EUR", locale: "en-EU" },
};

export const DEFAULT_CURRENCY = "PHP";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", description: "At-a-glance overview of your monthly finances" },
  { label: "Income", href: "/income", icon: "TrendingUp", description: "Log salary, overtime, incentives & track earnings" },
  { label: "Expenses", href: "/expenses", icon: "TrendingDown", description: "Track spending by category & search entries" },
  { label: "Budgets", href: "/budgets", icon: "PieChart", description: "Plan monthly budgets & monitor category limits" },
  { label: "Savings Goals", href: "/savings", icon: "PiggyBank", description: "Track targets like emergency & travel funds" },
  { label: "Transactions", href: "/transactions", icon: "History", description: "Searchable history of income and expenses" },
  { label: "Forecasting", href: "/forecasting", icon: "LineChart", description: "12-month projected net wealth" },
  { label: "Settings", href: "/settings", icon: "Settings", description: "Profile, currency & app preferences" },
] as const;
