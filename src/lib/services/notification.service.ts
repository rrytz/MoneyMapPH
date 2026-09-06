import { SupabaseClient } from "@supabase/supabase-js";
import { getBudgetStatuses } from "./financial.service";
import { calculateEmergencyFundStatus } from "./forecast.service";
import { getSavingsGoals } from "./goal.service";
import { getPaychecks } from "./paycheck.service";
import { getReminders } from "./reminder.service";
import { getCurrentMonthYear } from "@/lib/utils/date";

export interface NotificationItem {
  id: string;
  type: "warning" | "info" | "success";
  title: string;
  message: string;
  date: string;
  completed?: boolean; // relevant for reminders
  due_date?: string;   // relevant for reminders/goals
  categoryName?: string; // relevant for budget warnings
}

export async function getDynamicNotifications(
  supabase: SupabaseClient,
  userId: string,
  /** Pass the user's persisted dismissed_notification_ids from user_metadata to filter them out. */
  dismissedIds: string[] = []
): Promise<NotificationItem[]> {
  const { month, year } = getCurrentMonthYear();
  const list: NotificationItem[] = [];

  // Run checks concurrently to optimize response time
  const [budgetStatuses, emergencyStatus, goals, paychecks, reminders] = await Promise.all([
    getBudgetStatuses(supabase, userId, month, year).catch(() => []),
    calculateEmergencyFundStatus(supabase, userId).catch(() => null),
    getSavingsGoals(supabase, userId).catch(() => []),
    getPaychecks(supabase, userId, month, year).catch(() => []),
    getReminders(supabase, userId, { completed: false }).catch(() => []),
  ]);

  // 1. Budget warnings
  budgetStatuses.forEach((b) => {
    if (b.status === "over") {
      list.push({
        id: `budget-over-${b.categoryId}`,
        type: "warning",
        title: "Over Budget Alert",
        message: `You have exceeded your budget for ${b.categoryName} by ₱${Math.abs(b.remaining).toLocaleString()}`,
        date: new Date().toISOString(),
        categoryName: b.categoryName,
      });
    } else if (b.percentage >= 80) {
      list.push({
        id: `budget-warning-${b.categoryId}`,
        type: "warning",
        title: "Approaching Budget Limit",
        message: `You have spent ${b.percentage}% of your budget for ${b.categoryName}`,
        date: new Date().toISOString(),
        categoryName: b.categoryName,
      });
    }
  });

  // 2. Emergency fund adequacy checks
  if (emergencyStatus && emergencyStatus.hasFund) {
    if (emergencyStatus.status === "critical") {
      list.push({
        id: "emergency-fund-critical",
        type: "warning",
        title: "Low Emergency Reserves",
        message: `Your emergency reserve covers only ${emergencyStatus.monthsCovered} months of expenses. Aim for at least 3-6 months.`,
        date: new Date().toISOString(),
      });
    }
  } else {
    list.push({
      id: "emergency-fund-missing",
      type: "info",
      title: "No Emergency Fund",
      message: "Configure an Emergency Fund target on the Savings page to build a safety net.",
      date: new Date().toISOString(),
    });
  }

  // 3. Unallocated paycheck check
  paychecks.forEach((p) => {
    const allocated = (p.allocations || []).reduce((sum, a) => sum + Number(a.amount), 0);
    const unallocated = Number(p.amount) - allocated;
    if (unallocated > 0) {
      list.push({
        id: `paycheck-unallocated-${p.id}`,
        type: "info",
        title: "Unallocated Paycheck Balances",
        message: `You have ₱${unallocated.toLocaleString()} unallocated in paycheck "${p.name}".`,
        date: new Date().toISOString(),
      });
    }
  });

  // 4. Savings goals timeline check
  const now = new Date();
  goals.forEach((g) => {
    if (g.target_date && Number(g.current_amount) < Number(g.target_amount)) {
      const tDate = new Date(g.target_date);
      const diffTime = tDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && diffDays <= 30) {
        list.push({
          id: `goal-approaching-${g.id}`,
          type: "info",
          title: "Savings Target Due Soon",
          message: `Your goal "${g.name}" is due in ${diffDays} days, currently at ${Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)}% funding.`,
          date: new Date().toISOString(),
          due_date: g.target_date,
        });
      }
    }
  });

  // 5. Custom user reminders
  reminders.forEach((r) => {
    list.push({
      id: `custom-reminder-${r.id}`,
      type: "info",
      title: "Reminder",
      message: r.title + (r.notes ? ` (${r.notes})` : ""),
      date: new Date(r.due_date).toISOString(),
      completed: r.completed,
      due_date: r.due_date,
    });
  });

  // Filter out notifications the user has explicitly dismissed
  if (dismissedIds.length > 0) {
    return list.filter((n) => !dismissedIds.includes(n.id));
  }
  return list;
}
