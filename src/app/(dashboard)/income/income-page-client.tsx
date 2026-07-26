"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { IncomeForm } from "@/components/forms/income-form";
import { removeIncome } from "./actions";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
import type { IncomeEntry, IncomeSource } from "@/lib/types";

interface IncomePageClientProps {
  initialEntries: IncomeEntry[];
  initialCount: number;
  sources: IncomeSource[];
  totalThisMonth: number;
  currentMonth: number;
  currentYear: number;
}

export function IncomePageClient({
  initialEntries,
  initialCount,
  sources,
  totalThisMonth,
}: IncomePageClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<IncomeEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  return (
    <>
      <PageHeader title="Income" description="Track your income sources and earnings">
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add Income
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyDisplay amount={totalThisMonth} className="text-2xl font-bold text-income" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{initialCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sources Used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {new Set(initialEntries.map((e) => e.source_id)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {initialEntries.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No income recorded"
          description="Start tracking your income by adding your first entry."
          actionLabel="Add Income"
          onAction={handleAdd}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {initialEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {entry.source?.name || "Unknown Source"}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {formatDate(entry.date, "MMM d")}
                      </Badge>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground truncate">{entry.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <CurrencyDisplay amount={Number(entry.amount)} className="text-sm font-semibold text-income" />
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(entry)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(entry.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <IncomeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        sources={sources}
        editEntry={editEntry}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete income entry"
        description="This will permanently delete this income entry. This action cannot be undone."
        loading={deleting}
      />
    </>
  );
}
