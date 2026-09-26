"use client";

import { useState, useOptimistic, useTransition } from "react";
import { Plus, Pencil, Trash2, TrendingDown, Search, Filter, PieChart, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExpenseForm } from "@/components/forms/expense-form";
import { removeExpense, addExpense } from "./actions";
import { formatDate } from "@/lib/utils/date";
import { CategoryIcon } from "@/components/shared/category-icon";
import { toast } from "sonner";
import type { Expense, ExpenseCategory, Account } from "@/lib/types";

interface ExpensesPageClientProps {
  initialEntries: Expense[];
  categories: ExpenseCategory[];
  totalThisMonth: number;
  expenseCount: number;
  categoryTotals: Record<string, number>;
  currentMonth: number;
  currentYear: number;
  accounts?: Account[];
}

export function ExpensesPageClient({
  initialEntries,
  categories,
  totalThisMonth: initialTotal,
  expenseCount: initialCount,
  categoryTotals: initialCategoryTotals,
  accounts,
}: ExpensesPageClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [, startTransition] = useTransition();

  const [optimisticEntries, addOptimisticEntry] = useOptimistic(
    initialEntries,
    (state: Expense[], newEntry: Expense) => [newEntry, ...state]
  );

  const [total, setTotal] = useState(initialTotal);
  const [prevTotal, setPrevTotal] = useState(initialTotal);
  if (initialTotal !== prevTotal) {
    setPrevTotal(initialTotal);
    setTotal(initialTotal);
  }
  const [count, setCount] = useState(initialCount);
  const [prevCount, setPrevCount] = useState(initialCount);
  if (initialCount !== prevCount) {
    setPrevCount(initialCount);
    setCount(initialCount);
  }
  const [categoryTotals, setCategoryTotals] = useState(initialCategoryTotals);
  const [prevCategoryTotals, setPrevCategoryTotals] = useState(initialCategoryTotals);
  if (initialCategoryTotals !== prevCategoryTotals) {
    setPrevCategoryTotals(initialCategoryTotals);
    setCategoryTotals(initialCategoryTotals);
  }

  function handleAddExpense(data: { title: string; amount: number; category_id: string; date: string; notes?: string; account_id?: string }) {
    const category = categories.find((c) => c.id === data.category_id);
    const optimistic: Expense = {
      id: `optimistic-${Date.now()}`,
      user_id: "",
      title: data.title,
      amount: data.amount,
      category_id: data.category_id,
      date: data.date,
      notes: data.notes || null,
      paycheck_id: null,
      account_id: data.account_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category,
    };

    setTotal((v) => v + data.amount);
    setCount((v) => v + 1);
    setCategoryTotals((prev) => ({ ...prev, [data.category_id]: (prev[data.category_id] || 0) + data.amount }));

    startTransition(async () => {
      addOptimisticEntry(optimistic);
      try {
        const result = await addExpense(data);
        if (result.error) {
          toast.error(result.error);
          setTotal((v) => v - data.amount);
          setCount((v) => v - 1);
          setCategoryTotals((prev) => ({ ...prev, [data.category_id]: (prev[data.category_id] || 0) - data.amount }));
        } else {
          toast.success("Expense added");
        }
      } catch {
        toast.error("Unable to add expense. Please try again.");
        setTotal((v) => v - data.amount);
        setCount((v) => v - 1);
        setCategoryTotals((prev) => ({ ...prev, [data.category_id]: (prev[data.category_id] || 0) - data.amount }));
      }
    });
    setFormOpen(false);
  }

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

  const filteredEntries = optimisticEntries.filter((entry) => {
    const matchesSearch = entry.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || entry.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedCategories = Object.entries(categoryTotals)
    .map(([categoryId, amount]) => {
      const cName = categories.find((c) => c.id === categoryId)?.name || "Uncategorized";
      return { name: cName, amount };
    })
    .sort((a, b) => b.amount - a.amount);
  const topCategory = sortedCategories[0] || { name: "None", amount: 0 };

  return (
    <div className="space-y-6">
      <PageHeader title="Spending Intelligence" description="Monitor expenses, category allocations, and daily outflow">
        <Button onClick={handleAdd} className="rounded-md font-medium text-xs px-4 h-9 cursor-pointer">
          <Plus className="mr-1.5 h-4 w-4" /> Add Expense
        </Button>
      </PageHeader>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <FintechCard>
          <FintechCardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                <TrendingDown className="h-5 w-5" />
              </div>
              <Badge variant="expense">Total Outflow</Badge>
            </div>
            <div>
              <span className="type-section-label block">Calendar month spend</span>
              <CurrencyDisplay amount={total} className="type-ledger tabular-nums font-semibold text-rose-600 dark:text-rose-400" />
            </div>
          </FintechCardContent>
        </FintechCard>

        <FintechCard>
          <FintechCardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
                <PieChart className="h-5 w-5" />
              </div>
              <span className="type-section-label">Highest Spend</span>
            </div>
            <div>
              <span className="type-section-label block">Top Category</span>
              <p className="text-xl font-bold tracking-tight text-foreground truncate">{topCategory.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">₱{topCategory.amount.toLocaleString()}</p>
            </div>
          </FintechCardContent>
        </FintechCard>

        <FintechCard>
          <FintechCardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
                <Calendar className="h-5 w-5" />
              </div>
              <span className="type-section-label">Logged Items</span>
            </div>
            <div>
              <span className="type-section-label block">Total Expenses</span>
              <p className="type-measurement tabular-nums text-foreground">{count}</p>
            </div>
          </FintechCardContent>
        </FintechCard>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search expense titles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9.5 h-10 rounded-md bg-card border-border text-xs"
          />
        </div>
        <Select value={selectedCategory} onValueChange={(val) => setSelectedCategory(val || "all")}>
          <SelectTrigger className="w-full sm:w-[220px] h-10 rounded-md bg-card border-border text-xs">
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

      {/* Expense List Section */}
      {filteredEntries.length === 0 ? (
        <EmptyState
          icon={<TrendingDown className="h-6 w-6" />}
          title="No expenses found"
          description={search || selectedCategory !== "all" ? "Try adjusting your search query or category filter." : "Start tracking your spending by adding your first expense."}
          actionLabel={search || selectedCategory !== "all" ? undefined : "Add Expense"}
          onAction={handleAdd}
        />
      ) : (
        <FintechCard className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-base text-foreground">Expense Log</h3>
            <span className="text-xs text-muted-foreground">{filteredEntries.length} items</span>
          </div>
          <div className="divide-y divide-border">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4 px-6 hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2.5 mb-1 min-w-0">
                    <span className="font-semibold text-sm text-foreground truncate min-w-0 flex-1">{entry.title}</span>
                    <Badge variant="expense" className="text-[10px] flex items-center gap-1 shrink max-w-[45%] overflow-hidden">
                      <CategoryIcon icon={entry.category?.icon} className="h-3 w-3 shrink-0" />
                      <span className="truncate min-w-0">{entry.category?.name || "Uncategorized"}</span>
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                      {formatDate(entry.date, "MMM d, yyyy")}
                    </span>
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground truncate">{entry.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <CurrencyDisplay amount={Number(entry.amount)} className="figure-inline text-sm font-bold text-rose-600 dark:text-rose-400" />
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
        </FintechCard>
      )}

      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        accounts={accounts}
        editEntry={editEntry}
        onAdd={handleAddExpense}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete expense entry"
        description="This will permanently delete this expense item. This action cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
