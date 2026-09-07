"use client";

import { useState, useTransition } from "react";
import {
  Bell,
  Trash2,
  Plus,
  AlertTriangle,
  Clock,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { addReminder, toggleReminder, removeReminder } from "@/app/actions/reminders";
import { dismissNotification } from "@/app/actions/notifications";
import { formatDate } from "@/lib/utils/date";
import type { NotificationItem } from "@/lib/services/notification.service";

interface NotificationsDrawerProps {
  notifications: NotificationItem[];
}

export function NotificationsDrawer({ notifications }: NotificationsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const [isPending, startTransition] = useTransition();

  const warningCount = notifications.length;

  const systemAlerts = notifications.filter((n) => !n.id.startsWith("custom-reminder-") && !dismissedIds.has(n.id));
  const reminderChecklist = notifications.filter((n) => n.id.startsWith("custom-reminder-"));

  async function handleAddReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!reminderTitle || !reminderDate) {
      toast.error("Please fill in Title and Due Date.");
      return;
    }

    startTransition(async () => {
      const res = await addReminder({
        title: reminderTitle,
        due_date: reminderDate,
        notes: reminderNotes || undefined,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Reminder created successfully");
        setReminderTitle("");
        setReminderDate("");
        setReminderNotes("");
      }
    });
  }

  async function handleToggle(id: string, currentStatus: boolean) {
    const rawId = id.replace("custom-reminder-", "");
    const res = await toggleReminder(rawId, !currentStatus);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(!currentStatus ? "Marked as completed" : "Marked as active");
    }
  }

  async function handleDelete(id: string) {
    const rawId = id.replace("custom-reminder-", "");
    const res = await removeReminder(rawId);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Reminder deleted");
    }
  }

  async function handleDismissSystemAlert(id: string) {
    setDismissedIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        const res = await dismissNotification(id);
        if (res.error) {
          setDismissedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          toast.error(res.error);
        } else {
          toast.success("Alert dismissed");
        }
      } catch {
        setDismissedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.error("Unable to dismiss alert. Please try again.");
      }
    });
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger className="relative inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 w-9 cursor-pointer">
        <Bell className="h-4 w-4" />
        {warningCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col h-full bg-card">
        <SheetHeader className="border-b border-border p-4 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <Bell className="h-5 w-5 text-primary" /> Notification Center
          </SheetTitle>
          <SheetDescription>
            Manage active financial alerts and custom due-date reminders.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Section: Financial Health Alerts */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              System Alerts ({systemAlerts.length})
            </h3>
            {systemAlerts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">
                No active financial warnings or alerts. You are on track!
              </p>
            ) : (
              <div className="space-y-2.5">
                {systemAlerts.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                        item.type === "warning"
                          ? "bg-destructive/5 border-destructive/10 text-destructive-foreground"
                          : "bg-primary/5 border-primary/10 text-foreground"
                      }`}
                    >
                      <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                        item.type === "warning" ? "text-destructive" : "text-primary"
                      }`} />
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <span className="font-semibold block text-foreground">{item.title}</span>
                        <p className="text-muted-foreground leading-relaxed">{item.message}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDismissSystemAlert(item.id)}
                        disabled={isPending}
                        title="Dismiss alert"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Section: Custom Reminders Checklists */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Reminders Checklist ({reminderChecklist.length})
            </h3>
            {reminderChecklist.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">
                No pending custom reminders. Add one below to track actions.
              </p>
            ) : (
              <div className="space-y-2">
                {reminderChecklist.map((item) => {
                    const isDone = !!item.completed;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-border bg-muted/20 text-xs flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            onClick={() => handleToggle(item.id, isDone)}
                            className="text-muted-foreground hover:text-primary mt-0.5 shrink-0 cursor-pointer"
                          >
                            {isDone ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0 space-y-0.5">
                            <span className={`font-medium block truncate text-foreground ${isDone ? "line-through text-muted-foreground" : ""}`}>
                              {item.title}
                            </span>
                            {item.due_date && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-3 w-3" /> Due {formatDate(item.due_date, "MMM d, yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id)}
                          className="h-7 w-7 text-rose-500 hover:text-rose-600 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Section: Add Reminder Form */}
          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
              <Plus className="h-4 w-4" /> Add Custom Reminder
            </h3>
            <form onSubmit={handleAddReminder} className="space-y-3.5">
              <div className="space-y-1">
                <Label htmlFor="rem-title" className="text-[10px] uppercase font-bold text-muted-foreground">Title *</Label>
                <Input
                  id="rem-title"
                  placeholder="e.g. Credit Card Due Date"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="rem-date" className="text-[10px] uppercase font-bold text-muted-foreground">Due Date *</Label>
                  <Input
                    id="rem-date"
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rem-notes" className="text-[10px] uppercase font-bold text-muted-foreground">Notes</Label>
                  <Input
                    id="rem-notes"
                    placeholder="Brief detail..."
                    value={reminderNotes}
                    onChange={(e) => setReminderNotes(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <Button type="submit" disabled={isPending} className="w-full h-8 text-xs mt-1">
                {isPending ? "Creating..." : "Save Reminder"}
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
