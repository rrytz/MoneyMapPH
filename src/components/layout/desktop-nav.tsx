"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { NAV_ICON_MAP } from "@/components/layout/nav-icons";
import { cn } from "@/lib/utils";

/**
 * S5b — desktop navigation.
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

  return (
    <nav
      aria-label="Primary"
      className="hidden shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-paper px-4 sm:px-6 lg:flex"
    >
      {GROUPS.map((group, gi) => (
        <div key={group.label ?? "root"} className="flex shrink-0 items-center gap-1">
          {gi > 0 && <span className="mx-1.5 h-4 w-px bg-border" aria-hidden="true" />}
          {group.label && (
            <span className="mr-1 hidden text-[10px] uppercase tracking-wider text-ink-faint xl:inline">
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
                  "flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
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
  );
}
