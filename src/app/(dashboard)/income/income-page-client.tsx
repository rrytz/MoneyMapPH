"use client";

import { useState, useOptimistic, useTransition } from "react";
import { Plus, Pencil, Trash2, TrendingUp, DollarSign, Wallet, Layers, CalendarRange } from "lucide-react";
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
import { removeIncome, addIncome } from "./actions";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
import type { IncomeEntry, IncomeSource, Paycheck, ExpenseCategory } from "@/lib/types";

interface IncomePageClientProps {
  initialEntries: IncomeEntry[];
  sources: IncomeSource[];
  paychecks: Paycheck[];
  categories: ExpenseCategory[];
  totalThisMonth: number;
  currentMonth: number;
  currentYear: number;
}

export function IncomePageClient({
  initialEntries,
  sources,
  paychecks,
  categories,
  totalThisMonth,
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

  function handleAddIncome(data: { amount: number; source_id: string; date: string; notes?: string }) {
    const source = sources.find((s) => s.id === data.source_id);
    const optimistic: IncomeEntry = {
      id: `optimistic-${Date.now()}`,
      user_id: "",
      amount: data.amount,
      source_id: data.source_id,
      date: data.date,
      notes: data.notes || null,
      paycheck_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source,
    };

    startTransition(async () => {
      addOptimisticEntry(optimistic);
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
        <Button onClick={handleAdd} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 h-9 cursor-pointer">
          <Plus className="mr-1.5 h-4 w-4" /> Add Income
        </Button>
      </PageHeader>

      <Tabs defaultValue="income" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <TabsTrigger value="income" className="flex items-center gap-1.5 text-xs font-semibold rounded-lg">
            <TrendingUp className="h-4 w-4" /> Log Income
          </TabsTrigger>
          <TabsTrigger value="paychecks" className="flex items-center gap-1.5 text-xs font-semibold rounded-lg">
            <CalendarRange className="h-4 w-4" /> Allocate Paycheck
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <FintechCard>
              <FintechCardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <Badge variant="income">Active Month</Badge>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground block">Total Monthly Earnings</span>
                  <CurrencyDisplay amount={totalThisMonth} className="text-3xl sm:text-4xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400" />
                </div>
              </FintechCardContent>
            </FintechCard>

            <FintechCard>
              <FintechCardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">Logged Entries</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground block">Total Payments</span>
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums">{optimisticEntries.length}</p>
                </div>
              </FintechCardContent>
            </FintechCard>

            <FintechCard>
              <FintechCardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                    <Layers className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">Active Sources</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground block">Income Channels</span>
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums">
                    {Object.keys(sourceTotals).length}
                  </p>
                </div>
              </FintechCardContent>
            </FintechCard>
          </div>

          {/* Income List Section */}
          {optimisticEntries.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-6 w-6" />}
              title="No income recorded"
              description="Start tracking your salary, night differential, overtime, and incentives."
              actionLabel="Add First Income Entry"
              onAction={handleAdd}
            />
          ) : (
            <FintechCard className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-base text-foreground">Income Transactions</h3>
                <span className="text-xs text-muted-foreground">{optimisticEntries.length} items logged</span>
              </div>
              <div className="divide-y divide-border">
                {optimisticEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-4 px-6 hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
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
                      <CurrencyDisplay amount={Number(entry.amount)} className="text-sm font-bold text-emerald-600 dark:text-emerald-400" />
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-foreground" onClick={() => handleEdit(entry)}>
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
            </FintechCard>
          )}

          <IncomeForm
            open={formOpen}
            onOpenChange={setFormOpen}
            sources={sources}
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

        <TabsContent value="paychecks">
          <PaycheckPlanner
            initialPaychecks={paychecks}
            categories={categories}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}