import { SupabaseClient } from "@supabase/supabase-js";
import { getBudgetStatuses } from "./financial.service";
import { calculateEmergencyFundStatus } from "./forecast.service";
import { getSavingsGoals } from "./goal.service";
import { getPaychecks } from "./paycheck.service";
import { getReminders } from "./reminder.service";
import { getBillsDueBy } from "./bills.service";
import { getSafeToSpend } from "./safe-to-spend.service";
import { getCurrentMonthYear, formatDate } from "@/lib/utils/date";
import { dueSoonKey, getBillsDueWindow } from "@/lib/utils/bills";
import { getLeanStatus } from "./pay-period.service";

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
  const [budgetStatuses, emergencyStatus, goals, paychecks, reminders, leanStatus, funds, billsDue] =
    await Promise.all([
      getBudgetStatuses(supabase, userId, month, year).catch(() => []),
      calculateEmergencyFundStatus(supabase, userId).catch(() => null),
      getSavingsGoals(supabase, userId).catch(() => []),
      getPaychecks(supabase, userId, month, year).catch(() => []),
      getReminders(supabase, userId, { completed: false }).catch(() => []),
      getLeanStatus(supabase, userId).catch(() => null),
      getSafeToSpend(supabase, userId).catch(() => null), // → funds
      (async () => {
        const fundsRes = await getSafeToSpend(supabase, userId).catch(() => null);
        if (!fundsRes) return null;
        const { fromISO, toISO } = getBillsDueWindow(new Date());
        return getBillsDueBy(supabase, userId, fromISO, toISO).catch(() => null); // → billsDue
      })(),
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

  // 6. Lean cutoff check (pay-period engine; paycheck income only)
  if (leanStatus) {
    if (leanStatus.phase === "lean" && leanStatus.targetPeriodEnd && leanStatus.median > 0) {
      const drop = Math.round((1 - (leanStatus.ratio ?? 0)) * 100);
      list.push({
        id: `lean-cutoff-${leanStatus.targetPeriodEnd}`,
        type: "warning",
        title: "Lean Cutoff Detected",
        message: `You earned ₱${leanStatus.targetIncome.toLocaleString()} for the cutoff ending ${formatDate(leanStatus.targetPeriodEnd, "MMM d")} vs your typical ₱${Math.round(leanStatus.median).toLocaleString()} (${drop}% below). Variable budgets will suggest tightening next cutoff.`,
        date: new Date().toISOString(),
      });
    }
  }

  // 7. Bills (K2): due-soon + coverage nudge
  if (funds && billsDue) {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const plus7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const dueSoonOcc = billsDue.occurrences.filter(
      (o) => o.dueDate >= todayISO && o.dueDate <= plus7
    );
    if (dueSoonOcc.length > 0) {
      const total = dueSoonOcc.reduce((s, o) => s + o.expectedAmount, 0);
      list.push({
        id: dueSoonKey(dueSoonOcc.map((o) => ({ bill_id: o.bill_id, dueDate: o.dueDate, expectedAmount: o.expectedAmount }))),
        type: "warning",
        title: "Bills Due Soon",
        message: `${dueSoonOcc.length} bill${dueSoonOcc.length === 1 ? "" : "s"} due in the next 7 days · ₱${total.toLocaleString()} total`,
        date: new Date().toISOString(),
      });
    }

    if (billsDue.upcomingTotal > funds.safeToSpend) {
      const shortfall = Math.round(billsDue.upcomingTotal - funds.safeToSpend);
      list.push({
        id: `bills-coverage-${funds.periodEnd}`,
        type: "warning",
        title: "Bills before Next Paycheck",
        message: `Bills before your ${formatDate(funds.payoutDate, "MMM d")} payout exceed what's left this cutoff by ₱${shortfall.toLocaleString()}.`,
        date: new Date().toISOString(),
      });
    }
  }

  // Filter out notifications the user has explicitly dismissed
  if (dismissedIds.length > 0) {
    return list.filter((n) => !dismissedIds.includes(n.id));
  }
  return list;
}
