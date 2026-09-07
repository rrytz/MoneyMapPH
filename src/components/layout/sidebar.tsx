"use client";

import { useState } from "react";
import { Plus, PanelLeftClose, PanelLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./nav-links";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { Profile } from "@/lib/types";

interface SidebarProps {
  profile?: Profile | null;
}

export function Sidebar({ profile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const displayName = profile?.display_name || "Juan Dela Cruz";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "JD";

  return (
    <aside
      className={cn(
        "vt-sidebar hidden lg:flex flex-col border-r border-border bg-card h-screen sticky top-0 transition-all duration-300 z-20",
        collapsed ? "w-[72px]" : "w-[250px]"
      )}
    >
      <div className={cn("flex items-center gap-2.5 px-4 h-16 border-b border-border shrink-0", collapsed && "justify-center px-2")}>
        <Logo iconOnly={collapsed} size="md" showTagline={!collapsed} />
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <NavLinks collapsed={collapsed} />
      </div>

      <div className="p-3 border-t border-border space-y-3 shrink-0 bg-card">
        {!collapsed && (
          <Link
            href="/transactions"
            className="w-full inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Transaction
          </Link>
        )}

        <div
          className={cn(
            "flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border transition-colors",
            collapsed && "justify-center p-1.5"
          )}
        >
          <div className="h-8.5 w-8.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-200/50">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">BPO Senior Associate</p>
            </div>
          )}
          {!collapsed && (
            <Link href="/settings" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <Settings className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 justify-center h-7.5"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
