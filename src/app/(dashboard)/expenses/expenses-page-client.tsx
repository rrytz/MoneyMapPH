"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, TrendingDown, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExpenseForm } from "@/components/forms/expense-form";
import { removeExpense } from "./actions";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
import type { Expense, ExpenseCategory } from "@/lib/types";

interface ExpensesPageClientProps {
  initialEntries: Expense[];
  initialCount: number;
  categories: ExpenseCategory[];
  totalThisMonth: number;
  currentMonth: number;
  currentYear: number;
}

export function ExpensesPageClient({
  initialEntries,
  initialCount,
  categories,
  totalThisMonth,
}: ExpensesPageClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  function handleEdit(entry: Expense) {
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
    const result = await removeExpense(deleteId);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Expense entry deleted");
    }
    setDeleteId(null);
  }

  const filteredEntries = initialEntries.filter((entry) => {
    const matchesSearch = entry.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || entry.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <PageHeader title="Expenses" description="Track your spending and category details">
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add Expense
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyDisplay amount={totalThisMonth} className="text-2xl font-bold text-danger" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{initialCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categories Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {new Set(initialEntries.map((e) => e.category_id)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredEntries.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title="No expenses found"
          description={search || selectedCategory !== "all" ? "Try adjusting your search or category filter." : "Start tracking your expenses by adding your first item."}
          actionLabel={search || selectedCategory !== "all" ? undefined : "Add Expense"}
          onAction={handleAdd}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{entry.title}</span>
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        {entry.category?.icon && <span>{entry.category.icon}</span>}
                        {entry.category?.name || "Uncategorized"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.date, "MMM d")}
                      </span>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground truncate">{entry.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <CurrencyDisplay amount={Number(entry.amount)} className="text-sm font-semibold text-danger" />
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

      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        editEntry={editEntry}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete expense entry"
        description="This will permanently delete this expense item. This action cannot be undone."
        loading={deleting}
      />
    </>
  );
}
