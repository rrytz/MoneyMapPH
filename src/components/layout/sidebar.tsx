"use client";

import { useState } from "react";
import { TrendingUp, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./nav-links";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-border bg-card h-screen sticky top-0 transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      <div className={cn("flex items-center gap-2 px-4 h-16 border-b border-border shrink-0", collapsed && "justify-center px-2")}>
        <div className="rounded-lg bg-primary p-1.5 shrink-0">
          <TrendingUp className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && <span className="font-bold text-base tracking-tight">{APP_NAME}</span>}
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <NavLinks collapsed={collapsed} />
      </div>

      <div className="border-t border-border p-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="w-full"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
