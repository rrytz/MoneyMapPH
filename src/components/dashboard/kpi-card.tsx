import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  changePercent?: number | null;
  isCurrency?: boolean;
  isPercentage?: boolean;
  colorClass?: string;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  changePercent,
  isCurrency = true,
  isPercentage = false,
  colorClass,
}: KpiCardProps) {
  const TrendIcon =
    changePercent === null || changePercent === undefined
      ? null
      : changePercent > 0
        ? TrendingUp
        : changePercent < 0
          ? TrendingDown
          : Minus;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn("h-4 w-4 text-muted-foreground", colorClass)} />
      </CardHeader>
      <CardContent>
        {isCurrency ? (
          <CurrencyDisplay amount={value} className={cn("text-2xl font-bold", colorClass)} />
        ) : (
          <span className={cn("text-2xl font-bold tabular-nums", colorClass)}>
            {isPercentage ? `${value.toFixed(1)}%` : value}
          </span>
        )}
        {TrendIcon && changePercent !== null && changePercent !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            <TrendIcon
              className={cn(
                "h-3 w-3",
                changePercent > 0 ? "text-success" : changePercent < 0 ? "text-danger" : "text-muted-foreground"
              )}
            />
            <span className="text-xs text-muted-foreground">
              {Math.abs(changePercent).toFixed(1)}% from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
