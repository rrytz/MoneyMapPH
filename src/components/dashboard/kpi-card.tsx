import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
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
  badge?: string;
  iconBgClass?: string;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  changePercent,
  badge,
  isCurrency = true,
  isPercentage = false,
  colorClass,
  iconBgClass = "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
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
    <FintechCard className="relative">
      <FintechCardContent className="p-5 flex flex-col justify-between h-full space-y-4">
        <div className="flex items-center justify-between">
          <div className={cn("p-2.5 rounded-2xl shrink-0", iconBgClass)}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          {badge && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-200/50">
              {badge}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {isCurrency ? (
              <CurrencyDisplay amount={value} className={cn("font-bold text-foreground", colorClass)} />
            ) : (
              <span className={cn("font-bold text-foreground tabular-nums", colorClass)}>
                {isPercentage ? `${value.toFixed(1)}%` : value}
              </span>
            )}
          </div>
        </div>

        {TrendIcon && changePercent !== null && changePercent !== undefined && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/50 text-xs">
            <TrendIcon
              className={cn(
                "h-3.5 w-3.5",
                changePercent > 0 ? "text-emerald-600" : changePercent < 0 ? "text-rose-500" : "text-slate-400"
              )}
            />
            <span className="text-muted-foreground text-[11px]">
              {Math.abs(changePercent).toFixed(1)}% from last month
            </span>
          </div>
        )}
      </FintechCardContent>
    </FintechCard>
  );
}
