"use client";

import { useState } from "react";
import { Plus, Wallet, Trash2, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PaycheckForm } from "@/components/forms/paycheck-form";
import { removePaycheck } from "./actions";
import { formatDate } from "@/lib/utils/date";
import { calculatePaycheckSummary } from "@/lib/services/paycheck.service";
import { toast } from "sonner";
import type { Paycheck, ExpenseCategory } from "@/lib/types";

interface PaychecksPageClientProps {
  initialPaychecks: Paycheck[];
  categories: ExpenseCategory[];
}

export function PaychecksPageClient({ initialPaychecks, categories }: PaychecksPageClientProps) {
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
    <>
      <PageHeader title="Paycheck Planner" description="Allocate each paycheck to specific bills, savings, or categories">
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Plan Paycheck
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paycheck Income</CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyDisplay amount={totalPaycheckIncome} className="text-2xl font-bold text-income" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paychecks Recorded</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{initialPaychecks.length}</p>
          </CardContent>
        </Card>
      </div>

      {initialPaychecks.length === 0 ? (
        <EmptyState
          icon={Wallet}
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
              <Card key={paycheck.id} className="overflow-hidden">
                <CardHeader className="p-4 sm:p-6 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-bold">{paycheck.name}</CardTitle>
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(paycheck.date, "MMM d, yyyy")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>Total: <CurrencyDisplay amount={Number(paycheck.amount)} className="font-semibold text-foreground" /></span>
                        <span>Allocated: <CurrencyDisplay amount={summary.totalAllocated} className="font-semibold text-foreground" /></span>
                        <span>Unallocated: <CurrencyDisplay amount={summary.totalUnallocated} className="font-semibold text-foreground" /></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setExpandedId(isExpanded ? null : paycheck.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteId(paycheck.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-2">
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden mb-4">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{
                        width: `${Math.min((summary.totalAllocated / Number(paycheck.amount)) * 100, 100)}%`,
                      }}
                    />
                  </div>

                  {isExpanded && (
                    <div className="pt-2 border-t border-border space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Allocations</h4>
                      {summary.allocationBreakdown.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No category allocations set for this paycheck.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {summary.allocationBreakdown.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs py-1 px-2 rounded bg-muted/40">
                              <span className="font-medium">{item.label}</span>
                              <CurrencyDisplay amount={item.amount} className="font-semibold" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
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
    </>
  );
}
