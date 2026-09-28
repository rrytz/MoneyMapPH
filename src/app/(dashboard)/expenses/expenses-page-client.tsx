"use client";

import { useState, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MonthYearPicker } from "@/components/shared/month-year-picker";
import { Plus, Pencil, Trash2, TrendingDown, Search, Filter, PieChart, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountSelect } from "@/components/forms/account-select";
import { FilterPills } from "@/components/shared/filter-pills";
import { isUnassignedEntry } from "@/lib/utils/expense-account-assignment";
import { editExpense } from "./actions";
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
import { formatDate, getMonthName } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
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
  /**
   * From `?unassigned=1`. The URL is the source of truth, not a mirrored copy
   * of it: the Accounts page links here, so refresh, back/forward and a
   * bookmarked URL all have to mean the same thing. The same reason the month
   * is read from `searchParams` rather than held in state.
   */
  initialUnassignedOnly?: boolean;
}

export function ExpensesPageClient({
  initialEntries,
  categories,
  totalThisMonth: initialTotal,
  expenseCount: initialCount,
  categoryTotals: initialCategoryTotals,
  currentMonth,
  currentYear,
  accounts,
  initialUnassignedOnly = false,
}: ExpensesPageClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  // Paginated at 15 to match /transactions. This ledger rendered every entry,
  // so 28 rows made the page 2.87 folds while its sibling showed 15 behind a
  // pager - two ledgers doing one job in two ways. The cap is defensible here
  // rather than on a dashboard card because this is a dedicated ledger with
  // its own search and category filter: a page of results is the same job,
  // not a reduced one. Every entry stays reachable.
  const [currentPage, setCurrentPage] = useState(1);
  // Synced from the prop rather than initialised from it once, matching the
  // totals above: a back/forward navigation changes the URL without remounting
  // this component, and `useState(fn)` would freeze the first value forever.
  const [unassignedOnly, setUnassignedOnly] = useState(initialUnassignedOnly);
  const [prevUnassignedOnly, setPrevUnassignedOnly] = useState(initialUnassignedOnly);
  if (initialUnassignedOnly !== prevUnassignedOnly) {
    setPrevUnassignedOnly(initialUnassignedOnly);
    setUnassignedOnly(initialUnassignedOnly);
    setCurrentPage(1);
  }
  const itemsPerPage = 15;
  const [, startTransition] = useTransition();

  // The URL is the source of truth for the viewed month, the same idiom
  // /budgets uses. router.replace rather than push, so the arrows do not fill
  // the back button with month after month.
  //
  // Wrapped in a transition because a month change is a same-segment query
  // navigation, and loading.tsx does not fire for one - the segment never
  // changes. The pending flag dims the stack; dim rather than skeleton, because
  // the page is not going away. Identical to /transactions and /budgets.
  const [isMonthPending, startMonthTransition] = useTransition();
  const router = useRouter();
  function navigateToMonth(m: number, y: number) {
    startMonthTransition(() => {
      router.replace(`/expenses?month=${m}&year=${y}`, { scroll: false });
    });
  }

  /**
   * One reducer, two operations. `add` prepends as it always did; `assign`
   * rewrites `account_id` on a row in place.
   *
   * The in-place rewrite is what makes assigning from inside the Unassigned
   * view feel right: the row leaves the filtered set the moment it is assigned,
   * rather than sitting there claiming to be unassigned until the round trip
   * lands. It is deliberately a PATCH and not a replace - `assign` copies the
   * existing row and overrides one field, so an optimistic update cannot invent
   * or lose any of the others, exactly as the server call does not.
   */
  type OptimisticOp =
    | { kind: "add"; entry: Expense }
    | { kind: "assign"; id: string; account_id: string | null };

  const [optimisticEntries, applyOptimistic] = useOptimistic(
    initialEntries,
    (state: Expense[], op: OptimisticOp) =>
      op.kind === "add"
        ? [op.entry, ...state]
        : state.map((e) => (e.id === op.id ? { ...e, account_id: op.account_id } : e))
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
      applyOptimistic({ kind: "add", entry: optimistic });
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

  /**
   * Assign or clear one row's account, and nothing else.
   *
   * Reuses `editExpense` - the same server action the edit form already uses -
   * rather than adding a write path. Ownership is therefore checked by the same
   * authenticated `.eq("user_id", userId)` that action already does; a row
   * belonging to anyone else was never fetched in the first place.
   *
   * Every other field is passed through **from the row's own value**, not from
   * a fresh default. That is the whole safety property: the only byte that
   * differs is `account_id`. Sourcing `amount` from anywhere else - a zero, a
   * re-derived total - is how a tagging control silently rewrites money.
   *
   * Optimistic in the direction of the change, so the row leaves the
   * Unassigned view immediately instead of lingering until the round trip. If
   * the action rejects, the entry is restored to the account it had, which for
   * a failed clear is `null` again.
   */
  function handleAssignAccount(entry: Expense, nextAccountId: string) {
    const accountId = nextAccountId === "" ? null : nextAccountId;
    if ((entry.account_id ?? null) === accountId) return;

    startTransition(async () => {
      const previous = entry;
      applyOptimistic({ kind: "assign", id: entry.id, account_id: accountId });
      try {
        await editExpense(entry.id, {
          title: entry.title,
          amount: Number(entry.amount),
          category_id: entry.category_id,
          date: entry.date,
          notes: entry.notes ?? undefined,
          account_id: accountId ?? undefined,
        });
        router.refresh();
        toast.success(accountId ? "Account assigned" : "Account cleared");
      } catch {
        applyOptimistic({
          kind: "assign",
          id: previous.id,
          account_id: previous.account_id ?? null,
        });
        toast.error("Unable to update the account on this expense.");
      }
    });
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

  // One definition, imported rather than restated: the filter and the row
  // control have to agree on what "unassigned" is, or the view can show a row
  // the control believes is already tagged.
  const isUnassigned = (e: Expense) => isUnassignedEntry(e);

  // Counted over the whole month's entries, not the current page, so the number
  // does not change as you page through - a count that halves on page 2 reads
  // as a bug.
  const unassignedCount = optimisticEntries.filter(isUnassigned).length;

  const filteredEntries = optimisticEntries.filter((entry) => {
    const matchesSearch = entry.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || entry.category_id === selectedCategory;
    const matchesAccount = !unassignedOnly || isUnassigned(entry);
    return matchesSearch && matchesCategory && matchesAccount;
  });

  const totalItems = filteredEntries.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  // A filter that shrinks the result set can leave the current page past the
  // end, so clamp rather than render an empty list.
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + itemsPerPage);

  const sortedCategories = Object.entries(categoryTotals)
    .map(([categoryId, amount]) => {
      const cName = categories.find((c) => c.id === categoryId)?.name || "Uncategorized";
      return { name: cName, amount };
    })
    .sort((a, b) => b.amount - a.amount);
  const topCategory = sortedCategories[0] || { name: "None", amount: 0 };

  return (
    <div
      className={cn(
        "space-y-6 transition-opacity duration-150",
        isMonthPending && "opacity-55 pointer-events-none"
      )}
    >
      <PageHeader title="Spending Intelligence" description="Monitor expenses, category allocations, and daily outflow">
        <div className="flex flex-wrap items-center gap-3">
          {/* The period control. The query was already month-scoped but pinned to
              the current month, so this log could not be moved off it. The key on
              the client in page.tsx remounts this component on navigation, which
              is what resets the pager and the filters. */}
          <MonthYearPicker month={currentMonth} year={currentYear} onChange={navigateToMonth} />
          <Button onClick={handleAdd} className="rounded-md font-medium text-xs px-4 h-9 cursor-pointer">
            <Plus className="mr-1.5 h-4 w-4" /> Add Expense
          </Button>
        </div>
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
              {/* Names the viewed month, not "calendar month". With a navigator
                  in the header the old label became actively wrong: paging back
                  to August left a card reading "Calendar month spend" beside a
                  picker saying August. The label states what it is showing. */}
              <span className="type-section-label block">{getMonthName(currentMonth)} {currentYear} spend</span>
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
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9.5 h-10 rounded-md bg-card border-border text-xs"
          />
        </div>
        <Select value={selectedCategory} onValueChange={(val) => { setSelectedCategory(val || "all"); setCurrentPage(1); }}>
          <SelectTrigger className="w-full sm:w-[220px] h-10 rounded-md bg-card border-border text-xs">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            {/* base-ui renders the raw value, not the item's children, so this
                trigger showed "all". Unlike /transactions, this Select stores
                the category ID as its value, so the label has to be looked up -
                without that the trigger reads a raw UUID. */}
            <SelectValue placeholder="All Categories">
              {selectedCategory === "all"
                ? "All Categories"
                : (categories.find((c) => c.id === selectedCategory)?.name ??
                  selectedCategory)}
            </SelectValue>
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

        {/* The unassigned filter, and the reason it is a PERSISTENT control
            rather than a search box.

            30 of this ledger's 30 rows are untagged, and the list pages at 15,
            so they are not reachable without one. The /accounts screen already
            carries an "Unassigned Transactions" card saying that this money is
            excluded from totals - which is correct and, on its own, useless,
            because it offered no way to act. This is that way, and `?unassigned=1`
            is what makes the link from that card a destination rather than a
            note.

            The count is rendered because a filter that hides rows without saying
            how many is how a list ends up reading as complete. */}
        {accounts && accounts.length > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <FilterPills
              label="Account tagging"
              options={[
                { value: "all", label: "All" },
                { value: "unassigned", label: `Unassigned (${unassignedCount})` },
              ]}
              value={unassignedOnly ? "unassigned" : "all"}
              onChange={(v: string) => {
                setUnassignedOnly(v === "unassigned");
                setCurrentPage(1);
              }}
            />
          </div>
        )}
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
            <span className="text-xs text-muted-foreground">{totalItems} items</span>
          </div>
          <div className="divide-y divide-border">
            {paginatedEntries.map((entry) => (
              /* py-2, not p-4. The row was 61px and the h-8 icon buttons (30px)
                 were setting that, not the text - 15px of padding either side of
                 a 30px control. At py-2 the row is 46px, the same height the
                 dashboard's ledger and /transactions both land on, so three
                 ledgers now share one row instead of three heights. */
              <div key={entry.id} className="flex items-center justify-between py-2 px-6 hover:bg-muted/50 transition-colors">
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
                  {/* The tagging control, inline, from `sm` up ONLY.

                      At 375 this was measured, not assumed: the compact select
                      is 136px inside a 343px row that also carries the title,
                      the category badge, the date, the amount and two icon
                      buttons. The title collapsed to 3px. The row cannot hold
                      all of it, and the things that lose in that contest are the
                      things that identify the transaction - which is backwards,
                      because "which expense is this" is the question a ledger
                      row exists to answer. Compressing further was rejected: a
                      3px title is not a tight fit, it is no title.

                      So below `sm` the control is simply not rendered, and
                      assignment happens through the expense edit flow, which
                      already carries the full labelled AccountSelect. Nothing
                      is hidden to make room - the row is unchanged from what it
                      was before this feature, and every action on it still
                      works. `?unassigned=1` remains the way to FIND the
                      untagged rows on a phone; it just is not also the place to
                      fix them.

                      Deliberately NOT done: a page-level selector, because a
                      control above a list of untagged rows reads as "apply to
                      these", and there is no bulk feature to apply it to. */}
                  {accounts && accounts.length > 0 && (
                    <div className="mt-1 hidden sm:block">
                      <AccountSelect
                        compact
                        accounts={accounts}
                        value={entry.account_id ?? ""}
                        onChange={(v) => handleAssignAccount(entry, v)}
                      />
                    </div>
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border">
              <span className="type-measurement text-xs text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} items
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="h-8 text-xs rounded-lg border-border cursor-pointer"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="h-8 text-xs rounded-lg border-border cursor-pointer"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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
