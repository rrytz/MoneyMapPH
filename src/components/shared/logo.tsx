import { cn } from "@/lib/utils";
import { TideMark } from "@/components/shared/tide-gauge";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "default" | "light" | "faint";
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
  // "faint" exists for the topbar, where the mark had to mirror the balance's
  // loaded state. It was a second TideMark inside the readout doing that job;
  // now the one mark carries it, so the bar states nothing before the data
  // exists. No other call site passes a tone, so this is purely additive.
  const markTone =
    tone === "light" ? "text-sulpot-bright" : tone === "faint" ? "text-ink-faint" : "text-sulpot";

  return (
    <div
      className={cn("inline-flex select-none items-center gap-2.5", className)}
      role="img"
      aria-label="Agos"
    >
      <TideMark className={cn("shrink-0", iconSizeMap[size], markTone)} />

      {!iconOnly && (
        <div className={cn("type-identity flex items-baseline leading-none", titleSizeMap[size])}>
          <span className={wordmarkBase}>Ago</span>
          <span className={accentBase}>s</span>
        </div>
      )}
    </div>
  );
}
