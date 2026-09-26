"use client";

import { useState, useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, TrendingUp, DollarSign, Wallet, Layers, CalendarRange, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IncomeForm } from "@/components/forms/income-form";
import { PaycheckPlanner } from "./paycheck-planner";
import { LeanStatusChip } from "./lean-status-chip";
import { PeriodSafeToSpendCard } from "./period-safe-to-spend-card";
import { BillsSummaryCard } from "./bills-summary-card";
import { MonthCalendar } from "./month-calendar";
import { BillsCrud } from "./bills-crud";
import { removeIncome, addIncome } from "./actions";
import { formatDate } from "@/lib/utils/date";
import { isInShownMonth, type IncomeView } from "@/lib/utils/income-view";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { IncomeEntry, IncomeSource, Paycheck, ExpenseCategory, LeanStatus, SafeToSpendStatus, Account } from "@/lib/types";
import type { BillView, BillsDueBy } from "@/lib/types";

interface IncomePageClientProps {
  initialEntries: IncomeEntry[];
  monthEntries: IncomeEntry[];
  view: IncomeView;
  sources: IncomeSource[];
  paychecks: Paycheck[];
  categories: ExpenseCategory[];
  leanStatus: LeanStatus;
  safeToSpend: SafeToSpendStatus;
  totalThisMonth: number;
  currentMonth: number;
  currentYear: number;
  accounts?: Account[];
  initialActiveTab: "income" | "bills";
  billView?: BillView;
  billsDueBy?: BillsDueBy;
}

export function IncomePageClient({
  initialEntries,
  monthEntries,
  view,
  sources,
  paychecks,
  categories,
  leanStatus,
  safeToSpend,
  totalThisMonth,
  currentMonth,
  currentYear,
  initialActiveTab,
  accounts,
  billView,
  billsDueBy,
}: IncomePageClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<IncomeEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [, startTransition] = useTransition();

  const [optimisticEntries, addOptimisticEntry] = useOptimistic(
    initialEntries,
    (state: IncomeEntry[], newEntry: IncomeEntry) => [newEntry, ...state]
  );

  const [optimisticMonthEntries, addOptimisticMonthEntry] = useOptimistic(
    monthEntries,
    (state: IncomeEntry[], newEntry: IncomeEntry) => [newEntry, ...state]
  );

  function handleAddIncome(data: { amount: number; source_id: string; date: string; notes?: string; account_id?: string }) {
    const source = sources.find((s) => s.id === data.source_id);
    const optimistic: IncomeEntry = {
      id: `optimistic-${Date.now()}`,
      user_id: "",
      amount: data.amount,
      source_id: data.source_id,
      date: data.date,
      notes: data.notes || null,
      paycheck_id: null,
      account_id: data.account_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source,
    };

    startTransition(async () => {
      addOptimisticEntry(optimistic);
      if (isInShownMonth(data.date, currentMonth, currentYear)) {
        addOptimisticMonthEntry(optimistic);
      }
      try {
        const result = await addIncome(data);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Income added");
        }
      } catch {
        toast.error("Unable to add income. Please try again.");
      }
    });
    setFormOpen(false);
  }

  function handleEdit(entry: IncomeEntry) {
    setEditEntry(entry);
    setFormOpen(true);
  }

  function handleAdd() {
    setEditEntry(null);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await removeIncome(deleteId);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Income entry deleted");
    }
    setDeleteId(null);
  }

  // Group earnings by source for variable income breakdown
  const sourceTotals: Record<string, number> = {};
  optimisticEntries.forEach((e) => {
    const sName = e.source?.name || "Other";
    sourceTotals[sName] = (sourceTotals[sName] || 0) + Number(e.amount);
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Income Command Center" description="Track salary, night differential, overtime, incentives, and variable earnings">
        <Button onClick={handleAdd} className="rounded-xl bg-primary hover:bg-primary/80 text-white font-medium text-xs px-4 h-9 cursor-pointer">
          <Plus className="mr-1.5 h-4 w-4" /> Add Income
        </Button>
      </PageHeader>

      <Tabs defaultValue={initialActiveTab} className="space-y-6">
        <TabsList className="p-1 rounded-xl">
          <TabsTrigger value="income" className="flex items-center gap-1.5 text-xs font-semibold rounded-lg">
            <TrendingUp className="h-4 w-4" /> Log Income
          </TabsTrigger>
          <TabsTrigger value="paychecks" className="flex items-center gap-1.5 text-xs font-semibold rounded-lg">
            <CalendarRange className="h-4 w-4" /> Allocate Paycheck
          </TabsTrigger>
          <TabsTrigger value="bills" className="flex items-center gap-1.5 text-xs font-semibold rounded-lg">
            <Receipt className="h-4 w-4" /> Bills
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="space-y-6">
          {/* The answer first: calendar-month earnings. Counts support the
              figure instead of competing with it as peer cards. */}
          <FintechCard>
            <FintechCardContent className="p-0">
              <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
                <div className="p-6 sm:p-8">
                  <div className="flex items-center justify-between gap-3">
                    <div className="p-2.5 rounded-xl bg-sulpot-tint text-sulpot-deep dark:bg-sulpot-tint dark:text-sulpot-bright">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <Badge variant="income">Calendar month</Badge>
                  </div>
                  <div className="mt-6">
                    <span className="text-xs font-medium text-muted-foreground block">Calendar month earnings</span>
                    <CurrencyDisplay
                      amount={totalThisMonth}
                      className="type-ledger text-4xl sm:text-5xl font-semibold tracking-tight text-sulpot-deep dark:text-sulpot-bright"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 border-t border-border lg:border-t-0 lg:border-l">
                  <div className="p-6">
                    <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <span className="mt-4 block text-xs text-muted-foreground">Logged entries</span>
                    <p className="type-measurement mt-1 text-2xl font-semibold tabular-nums text-foreground">
                      {optimisticMonthEntries.length}
                    </p>
                  </div>
                  <div className="border-l border-border p-6">
                    <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                      <Layers className="h-5 w-5" />
                    </div>
                    <span className="mt-4 block text-xs text-muted-foreground">Income channels</span>
                    <p className="type-measurement mt-1 text-2xl font-semibold tabular-nums text-foreground">
                      {Object.keys(sourceTotals).length}
                    </p>
                  </div>
                </div>
              </div>
            </FintechCardContent>
          </FintechCard>

          {/* Income List Section */}
          <FintechCard className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-semibold text-base text-foreground">Income Transactions</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{optimisticEntries.length} items logged</span>
                <div className="inline-flex items-center rounded-lg bg-muted p-0.5">
                  <Link
                    href="/income"
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                      view === "all"
                        ? "text-muted-foreground hover:text-foreground"
                        : "bg-background text-foreground shadow-sm"
                    )}
                  >
                    Calendar month
                  </Link>
                  <Link
                    href="/income?view=all"
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                      view === "all"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    All Entries
                  </Link>
                </div>
              </div>
            </div>
            {optimisticEntries.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<TrendingUp className="h-6 w-6" />}
                  title="No income recorded"
                  description={
                    view === "all"
                      ? "Start tracking your salary, night differential, overtime, and incentives."
                      : "No earnings logged for this calendar month. Switch to All Entries to view older records."
                  }
                  actionLabel="Add First Income Entry"
                  onAction={handleAdd}
                />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {optimisticEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-4 px-6 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground">
                          {entry.source?.name || "Income"}
                        </span>
                        <Badge variant="income" className="text-[10px]">
                          {formatDate(entry.date, "MMM d, yyyy")}
                        </Badge>
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground truncate">{entry.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <CurrencyDisplay amount={Number(entry.amount)} className="figure-inline text-sm font-bold text-sulpot-deep dark:text-sulpot-bright" />
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-ink-muted hover:text-foreground" onClick={() => handleEdit(entry)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600" onClick={() => setDeleteId(entry.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FintechCard>

          <IncomeForm
            open={formOpen}
            onOpenChange={setFormOpen}
            sources={sources}
            accounts={accounts}
            editEntry={editEntry}
            onAdd={handleAddIncome}
          />

          <ConfirmDialog
            open={!!deleteId}
            onOpenChange={(open) => !open && setDeleteId(null)}
            onConfirm={handleDelete}
            title="Delete income entry"
            description="This will permanently delete this income entry. This action cannot be undone."
            loading={deleting}
          />
        </TabsContent>

        <TabsContent value="paychecks" className="space-y-6">
          <LeanStatusChip status={leanStatus} />
          <PeriodSafeToSpendCard status={safeToSpend} />
          <PaycheckPlanner
            initialPaychecks={paychecks}
            categories={categories}
          />
        </TabsContent>

        <TabsContent value="bills" className="space-y-6">
          {billView && billsDueBy && safeToSpend ? (
            <div className="space-y-6">
              <BillsSummaryCard
                paidTotal={billsDueBy.paidTotal}
                upcomingTotal={billsDueBy.upcomingTotal}
                totalDue={billsDueBy.totalDue}
                horizonDate={billsDueBy.horizonDate}
                payoutDate={safeToSpend.payoutDate}
                safeToSpend={safeToSpend.safeToSpend}
              />
              <MonthCalendar
                bills={billView.bills}
                occurrences={billView.occurrences}
                payments={billView.payments}
                categories={categories}
                month={currentMonth}
                year={currentYear}
              />
              <BillsCrud
                bills={billView.bills}
                categories={categories}
              />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-10 text-center">
              Load your bills from the Income tab.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
