"use client";

import { useState } from "react";
import { Plus, Wallet, Trash2, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PaycheckForm } from "@/components/forms/paycheck-form";
import { removePaycheck } from "./actions";
import { formatDate } from "@/lib/utils/date";
import { calculatePaycheckSummary } from "@/lib/services/paycheck.service";
import { toast } from "sonner";
import type { Paycheck, ExpenseCategory } from "@/lib/types";

interface PaycheckPlannerProps {
  initialPaychecks: Paycheck[];
  categories: ExpenseCategory[];
}

export function PaycheckPlanner({ initialPaychecks, categories }: PaycheckPlannerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await removePaycheck(deleteId);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Paycheck planner deleted");
    }
    setDeleteId(null);
  }

  const totalPaycheckIncome = initialPaychecks.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base text-foreground">Paycheck Allocation Planner</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Allocate each paycheck to specific bills, savings, or categories</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 h-9 cursor-pointer">
          <Plus className="mr-1.5 h-4 w-4" /> Plan Paycheck
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FintechCard>
          <FintechCardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Wallet className="h-5 w-5" />
              </div>
              <Badge variant="income">Planned</Badge>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground block">Total Paycheck Income</span>
              <CurrencyDisplay amount={totalPaycheckIncome} className="text-3xl sm:text-4xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400" />
            </div>
          </FintechCardContent>
        </FintechCard>

        <FintechCard>
          <FintechCardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Calendar className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold text-slate-500">Scheduled</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground block">Paychecks Recorded</span>
              <p className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums">{initialPaychecks.length}</p>
            </div>
          </FintechCardContent>
        </FintechCard>
      </div>

      {initialPaychecks.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No paycheck plans"
          description="Plan out your paycheck allocations to know exactly where every peso goes."
          actionLabel="Plan Paycheck"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <div className="space-y-4">
          {initialPaychecks.map((paycheck) => {
            const summary = calculatePaycheckSummary(paycheck);
            const isExpanded = expandedId === paycheck.id;

            return (
              <FintechCard key={paycheck.id} className="overflow-hidden">
                <FintechCardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <FintechCardTitle>{paycheck.name}</FintechCardTitle>
                        <Badge variant="income" className="text-[10px] flex items-center gap-1 font-semibold">
                          <Calendar className="h-3 w-3" />
                          {formatDate(paycheck.date, "MMM d, yyyy")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 font-medium">
                        <span>Total: <CurrencyDisplay amount={Number(paycheck.amount)} className="font-bold text-foreground" /></span>
                        <span>Allocated: <CurrencyDisplay amount={summary.totalAllocated} className="font-bold text-emerald-600 dark:text-emerald-400" /></span>
                        <span>Unallocated: <CurrencyDisplay amount={summary.totalUnallocated} className="font-bold text-slate-500" /></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setExpandedId(isExpanded ? null : paycheck.id)}
                        className="h-8 w-8 text-slate-500"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-500 hover:text-rose-600"
                        onClick={() => setDeleteId(paycheck.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </FintechCardHeader>
                <FintechCardContent className="pt-0">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-4">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{
                        width: `${Math.min((summary.totalAllocated / Number(paycheck.amount)) * 100, 100)}%`,
                      }}
                    />
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-border space-y-2">
                      <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Allocations Breakdown</h4>
                      {summary.allocationBreakdown.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 italic">No category allocations set for this paycheck.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {summary.allocationBreakdown.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border/60">
                              <span className="font-semibold text-foreground">{item.label}</span>
                              <CurrencyDisplay amount={item.amount} className="font-bold text-foreground" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </FintechCardContent>
              </FintechCard>
            );
          })}
        </div>
      )}

      <PaycheckForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete paycheck plan"
        description="This will permanently delete this paycheck planner entry. This action cannot be undone."
        loading={deleting}
      />
    </div>
  );
}