import { CURRENCY_MAP, DEFAULT_CURRENCY } from "@/lib/constants";

export function formatCurrency(
  amount: number,
  currencyCode: string = DEFAULT_CURRENCY
): string {
  const config = CURRENCY_MAP[currencyCode] || CURRENCY_MAP[DEFAULT_CURRENCY];
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}

export function formatCompactAmount(val: number, symbol: string = "₱"): string {
  if (val >= 1000000) {
    return `${symbol}${(val / 1000000).toFixed(1)}M`;
  }
  if (val >= 1000) {
    return `${symbol}${(val / 1000).toFixed(0)}k`;
  }
  return `${symbol}${val.toLocaleString()}`;
}
