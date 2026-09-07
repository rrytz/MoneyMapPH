"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/providers/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sun, Moon, Monitor, LogOut, Settings, Search } from "lucide-react";
import { NotificationsDrawer } from "@/components/dashboard/notifications-drawer";
import type { Profile } from "@/lib/types";
import type { NotificationItem } from "@/lib/services/notification.service";

interface TopbarProps {
  profile: Profile | null;
  notifications?: NotificationItem[];
}

export function Topbar({ profile, notifications = [] }: TopbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "JD";

  const themeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const ThemeIcon = themeIcon;

  return (
    <header className="vt-topbar sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span>Workspace</span>
        <span>›</span>
        <span className="font-semibold text-foreground">Overview</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search data..."
            className="h-8.5 w-48 lg:w-64 rounded-full bg-slate-100 dark:bg-slate-900 border border-border pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <NotificationsDrawer notifications={notifications} />

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors hover:bg-muted h-9 w-9 cursor-pointer border border-border">
            <ThemeIcon className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-full h-9 w-9 p-0 hover:bg-muted cursor-pointer border border-border">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profile?.display_name || "Juan Dela Cruz"}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
