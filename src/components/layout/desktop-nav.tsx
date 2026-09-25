"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS } from "@/lib/constants";
import { NAV_ICON_MAP } from "@/components/layout/nav-icons";
import { cn } from "@/lib/utils";

/**
 * S5c — desktop navigation.
 *
 * Grouped by intent rather than a flat list of nine, because "where am I" and
 * "what kind of thing is this page" are different questions. Money in, money
 * out, plan, records. Dashboard sits alone; Settings is deliberately absent
 * from these groups and lives in the topbar's account menu, so it never
 * competes with daily destinations.
 */

type NavHref = (typeof NAV_ITEMS)[number]["href"];

const GROUPS: Array<{ label: string | null; hrefs: NavHref[] }> = [
  { label: null, hrefs: ["/dashboard"] },
  { label: "Money in", hrefs: ["/income"] },
  { label: "Money out", hrefs: ["/expenses", "/budgets"] },
  { label: "Plan", hrefs: ["/savings", "/forecasting", "/simulator"] },
  { label: "Records", hrefs: ["/accounts", "/transactions"] },
];

export function DesktopNav() {
  const pathname = usePathname();
  const byHref = new Map(NAV_ITEMS.map((i) => [i.href, i]));
  const navRef = useRef<HTMLElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const updateOverflow = () => {
      setIsOverflowing(nav.scrollWidth > nav.clientWidth + 1);
    };

    updateOverflow();
    nav.addEventListener("scroll", updateOverflow, { passive: true });
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(nav);

    return () => {
      nav.removeEventListener("scroll", updateOverflow);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      <nav
        ref={navRef}
        aria-label="Primary navigation"
        tabIndex={0}
        className="type-nav hidden shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-4 [scrollbar-width:none] sm:px-6 lg:flex [&::-webkit-scrollbar]:hidden"
      >
        {GROUPS.map((group, gi) => (
          <div key={group.label ?? "root"} className="flex shrink-0 items-center gap-1">
            {gi > 0 && <span className="mx-1.5 h-4 w-px bg-border" aria-hidden="true" />}
            {group.label && (
              <span className="type-nav-group mr-1 hidden text-ink-faint xl:inline">
                {group.label}
              </span>
            )}
            {group.hrefs.map((href) => {
              const item = byHref.get(href);
              if (!item) return null;
              const Icon = NAV_ICON_MAP[item.icon];
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "type-nav flex h-9 items-center gap-1.5 rounded-lg px-2.5 transition-colors",
                    active
                      ? "bg-sulpot-tint text-sulpot-deep"
                      : "text-muted-foreground hover:bg-inset hover:text-ink"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {isOverflowing && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent"
        />
      )}
    </div>
  );
}
