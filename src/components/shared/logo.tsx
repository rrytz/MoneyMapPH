import { cn } from "@/lib/utils";
import { TideMark } from "@/components/shared/tide-gauge";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "default" | "light";
}

export function Logo({
  className,
  iconOnly = false,
  size = "md",
  tone = "default",
}: LogoProps) {
  const iconSizeMap = {
    sm: "h-6 w-6",
    md: "h-8.5 w-8.5",
    lg: "h-11 w-11",
    xl: "h-16 w-16",
  };

  const titleSizeMap = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-4xl",
  };

  const wordmarkBase = tone === "light" ? "text-white" : "text-foreground";
  const accentBase = tone === "light" ? "text-sulpot-tint" : "text-sulpot-deep dark:text-sulpot-bright";
  const markTone = tone === "light" ? "text-sulpot-bright" : "text-sulpot";

  return (
    <div
      className={cn("inline-flex select-none items-center gap-2.5", className)}
      role="img"
      aria-label="MoneyMap PH"
    >
      <TideMark className={cn("shrink-0", iconSizeMap[size], markTone)} />

      {!iconOnly && (
        <div className={cn("type-identity flex items-baseline leading-none", titleSizeMap[size])}>
          <span className={wordmarkBase}>Money</span>
          <span className={accentBase}>Map</span>
          <span className={cn("ml-0.5 align-super text-[0.55em] font-semibold tracking-wider", accentBase)}>
            PH
          </span>
        </div>
      )}
    </div>
  );
}
