export const APP_NAME = "MoneyMap PH";

export const BUDGET_THRESHOLDS = {
  UNDER: 75,
  NEAR: 100,
} as const;

export const ITEMS_PER_PAGE = 20;

export const CURRENCY_MAP: Record<string, { symbol: string; code: string; locale: string }> = {
  PHP: { symbol: "₱", code: "PHP", locale: "en-PH" },
  USD: { symbol: "$", code: "USD", locale: "en-US" },
  EUR: { symbol: "€", code: "EUR", locale: "en-EU" },
};

export const DEFAULT_CURRENCY = "PHP";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Income", href: "/income", icon: "TrendingUp" },
  { label: "Expenses", href: "/expenses", icon: "TrendingDown" },
  { label: "Budgets", href: "/budgets", icon: "PieChart" },
  { label: "Savings Goals", href: "/savings", icon: "PiggyBank" },
  { label: "Transactions", href: "/transactions", icon: "History" },
  { label: "Forecasting", href: "/forecasting", icon: "LineChart" },
  { label: "Settings", href: "/settings", icon: "Settings" },
] as const;
