"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { NAV_ICON_MAP } from "./nav-icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavLinksProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavLinks({ collapsed = false, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const select = (href: string) => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    setPending(href);
    pendingTimer.current = setTimeout(() => {
      setPending((p) => (p === href ? null : p));
    }, 6000);
    onNavigate?.();
  };

  return (
    <TooltipProvider delay={200}>
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = NAV_ICON_MAP[item.icon];
          const isActive = pathname === item.href;
          const isPending = pending === item.href && pending !== pathname;
          const highlighted = isActive || isPending;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    onClick={() => select(item.href)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150",
                      highlighted
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold shadow-xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    {Icon && (
                      <Icon
                        className={cn(
                          "h-4.5 w-4.5 shrink-0 transition-colors",
                          highlighted ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                        )}
                      />
                    )}
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                }
              />
              <TooltipContent side="right" sideOffset={8}>
                <span className="font-medium">{item.label}</span>
                <span className="text-background/70">{item.description}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
