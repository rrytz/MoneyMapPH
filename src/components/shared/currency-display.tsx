import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
  colored?: boolean;
}

export function CurrencyDisplay({
  amount,
  currency = "PHP",
  className,
  colored = false,
}: CurrencyDisplayProps) {
  return (
    <span
      className={cn(
        "tabular-nums font-medium",
        colored && amount > 0 && "text-income",
        colored && amount < 0 && "text-danger",
        className
      )}
    >
      {formatCurrency(Math.abs(amount), currency)}
    </span>
  );
}
