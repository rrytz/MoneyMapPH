"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_ITEMS } from "@/lib/constants";
import { NAV_ICON_MAP } from "./nav-icons";
import { cn } from "@/lib/utils";

const PRIMARY_MOBILE_HREFS = ["/dashboard", "/income", "/expenses", "/budgets"];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const select = (href: string) => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    setPending(href);
    pendingTimer.current = setTimeout(() => {
      setPending((p) => (p === href ? null : p));
    }, 6000);
    setMoreOpen(false);
  };

  const primaryItems = NAV_ITEMS.filter((item) => PRIMARY_MOBILE_HREFS.includes(item.href));
  const secondaryItems = NAV_ITEMS.filter((item) => !PRIMARY_MOBILE_HREFS.includes(item.href));

  const isMoreActive = secondaryItems.some((item) => item.href === pathname);
  const MoreIcon = NAV_ICON_MAP.MoreHorizontal;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-border bg-card/95 backdrop-blur-md">
      <div className="flex items-center justify-around h-16 px-2">
        {primaryItems.map((item) => {
          const Icon = NAV_ICON_MAP[item.icon];
          const isActive = pathname === item.href;
          const isPending = pending === item.href && pending !== pathname;
          const highlighted = isActive || isPending;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => select(item.href)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-1 text-[11px] font-medium transition-colors",
                highlighted ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {Icon && <Icon className="h-5 w-5 shrink-0" />}
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger className="flex flex-col items-center justify-center gap-1 flex-1 py-1 text-[11px] font-medium transition-colors cursor-pointer text-muted-foreground hover:text-foreground">
            <span
              className={cn(
                "flex flex-col items-center gap-1",
                isMoreActive && "text-emerald-600 dark:text-emerald-400 font-semibold"
              )}
            >
              {MoreIcon && <MoreIcon className="h-5 w-5 shrink-0" />}
              <span>More</span>
            </span>
          </SheetTrigger>

          <SheetContent side="bottom" className="rounded-t-3xl border-t border-border bg-card p-6 pt-4 max-h-[80vh] overflow-y-auto">
            <SheetHeader className="pb-4 border-b border-border">
              <SheetTitle className="text-base font-bold text-foreground">Navigation & Tools</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2.5 pt-4">
              {secondaryItems.map((item) => {
                const Icon = NAV_ICON_MAP[item.icon];
                const highlighted = pathname === item.href || (pending === item.href && pending !== pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => select(item.href)}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-2xl border border-border text-xs font-semibold transition-colors",
                      highlighted
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/50"
                        : "bg-slate-50 dark:bg-slate-900 text-foreground hover:bg-slate-100"
                    )}
                  >
                    {Icon && <Icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
