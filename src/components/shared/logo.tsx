import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
}

export function LogoIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-label="MoneyMap PH Logo"
    >
      <defs>
        {/* Main Ribbon Emerald Gradient */}
        <linearGradient id="mRibbonGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>

        {/* Arrow Glow Gradient */}
        <linearGradient id="arrowGrad" x1="45" y1="45" x2="85" y2="15" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        {/* Bar Chart Gradient */}
        <linearGradient id="barGrad" x1="0" y1="100%" x2="0" y2="0%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>

        {/* Drop Shadow & Glow filter */}
        <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#10b981" floodOpacity="0.35" />
        </filter>
      </defs>

      <g filter="url(#emeraldGlow)">
        {/* Ascending Bar Chart Pillars inside the M fold */}
        <rect x="34" y="56" width="6" height="18" rx="2" fill="url(#barGrad)" />
        <rect x="43" y="48" width="6" height="26" rx="2" fill="url(#barGrad)" />
        <rect x="52" y="40" width="6" height="34" rx="2" fill="url(#barGrad)" />

        {/* M-Ribbon Left Curve & Valley */}
        <path
          d="M 16 72 
             C 16 42, 22 24, 38 24 
             C 48 24, 52 38, 56 46 
             L 64 28 
             C 68 20, 74 16, 82 16"
          stroke="url(#mRibbonGrad)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Arrow Stem & Upward Arrow Head */}
        <path
          d="M 72 74 V 22"
          stroke="url(#mRibbonGrad)"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Arrowhead Triangle pointing Up-Right */}
        <path
          d="M 58 32 L 78 12 L 88 32 Z"
          fill="url(#arrowGrad)"
        />
      </g>
    </svg>
  );
}

export function Logo({
  className,
  iconOnly = false,
  size = "md",
  showTagline = false,
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

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <LogoIcon className={iconSizeMap[size]} />

      {!iconOnly && (
        <div className="flex flex-col">
          <div className={cn("font-extrabold tracking-tight flex items-baseline leading-none", titleSizeMap[size])}>
            <span className="text-foreground">Money</span>
            <span className="text-emerald-500 dark:text-emerald-400">Map</span>
            <span className="ml-0.5 text-[0.55em] font-extrabold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest align-super">
              PH
            </span>
          </div>

          {showTagline && (
            <span className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mt-1">
              Plan • Track • Grow
            </span>
          )}
        </div>
      )}
    </div>
  );
}
