import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
  colored?: boolean;
  signed?: boolean;
}

export function CurrencyDisplay({
  amount,
  currency = "PHP",
  className,
  colored = false,
  signed = false,
}: CurrencyDisplayProps) {
  return (
    <span
      className={cn(
        // Instrument Sans has no peso glyph (U+20B1), so the sign falls back to
        // a 400-weight system face. Without this, any medium/bold weight above
        // 400 triggers faux-bold synthesis that smears the sign's thin
        // double-bar. Digits are real Instrument Sans (variable 400-700) and
        // are unaffected; only the synthesized sign is.
        "tabular-nums font-medium [font-synthesis:none]",
        colored && amount > 0 && "text-income",
        colored && amount < 0 && "text-danger",
        className
      )}
    >
      {formatCurrency(signed ? amount : Math.abs(amount), currency)}
    </span>
  );
}
