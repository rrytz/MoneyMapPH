"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MonthYearPicker } from "@/components/shared/month-year-picker";
import {
  Search,
  FileDown,
  Printer,
  X,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, History } from "lucide-react";
import { SummaryView } from "./summary-view";
import { formatDate, getMonthDateRange } from "@/lib/utils/date";
import { FilterPills } from "@/components/shared/filter-pills";
import type { UnifiedTransaction, ExpenseCategory, IncomeSource, MonthlySummary, BudgetStatus, MonthlySnapshot } from "@/lib/types";

interface TransactionsClientProps {
  initialTransactions: UnifiedTransaction[];
  categories: ExpenseCategory[];
  sources: IncomeSource[];
  summary: MonthlySummary;
  snapshots: MonthlySnapshot[];
  budgetStatuses: BudgetStatus[];
  month: number;
  year: number;
}

export function TransactionsClient({
  initialTransactions,
  categories,
  sources,
  summary,
  snapshots,
  budgetStatuses,
  month,
  year,
}: TransactionsClientProps) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // The URL is the source of truth for the viewed month, the same idiom
  // /budgets uses. router.replace rather than push, so the arrows do not fill
  // the back button with month after month.
  //
  // Wrapped in a transition because a month change is a same-segment query
  // navigation: loading.tsx does not fire for it, since the segment never
  // changes. Measured here, the swap took 393ms with no intermediate state at
  // all - the old month simply persisted, then the new one replaced it. That is
  // near-invisible locally and a long silent wait on a slow connection, so the
  // pending flag dims the stack. Dim rather than skeleton, because the page is
  // not going away and a 400ms skeleton flash reads as a fault.
  const [isMonthPending, startMonthTransition] = useTransition();
  const router = useRouter();
  function navigateToMonth(m: number, y: number) {
    startMonthTransition(() => {
      router.replace(`/transactions?month=${m}&year=${y}`, { scroll: false });
    });
  }

  const filtered = initialTransactions.filter((tx) => {
    if (search) {
      const term = search.toLowerCase();
      const matchTitle = tx.title.toLowerCase().includes(term);
      const matchCategory = tx.categoryName.toLowerCase().includes(term);
      const matchNotes = tx.notes ? tx.notes.toLowerCase().includes(term) : false;
      if (!matchTitle && !matchCategory && !matchNotes) return false;
    }

    if (type !== "all" && tx.type !== type) return false;
    if (filterCategory !== "all" && tx.categoryName !== filterCategory) return false;
    if (startDate && new Date(tx.date) < new Date(startDate)) return false;
    if (endDate && new Date(tx.date) > new Date(endDate)) return false;

    return true;
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

  function resetFilters() {
    setSearch("");
    setType("all");
    setFilterCategory("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  }

  function handleExportCSV() {
    const headers = ["Date", "Type", "Category/Source", "Title", "Amount", "Notes"];
    const rows = filtered.map((tx) => [
      tx.date,
      tx.type.toUpperCase(),
      tx.categoryName,
      `"${tx.title.replace(/"/g, '""')}"`,
      tx.type === "expense" ? -tx.amount : tx.amount,
      tx.notes ? `"${tx.notes.replace(/"/g, '""')}"` : "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transactions_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrintPDF() {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (type !== "all") q.set("type", type);
    if (filterCategory !== "all") q.set("category", filterCategory);
    // The viewed month, unless the filter inputs say otherwise. Without this
    // the print sheet fell back to "All History" - so printing from a month view
    // exported every transaction ever while the screen beside it showed one
    // month, and the printed total silently disagreed with "Filtered Results".
    // The sheet labels its own range, so it was never lying; it was answering a
    // different question from the one the screen was showing.
    const monthRange = getMonthDateRange(month, year);
    q.set("startDate", startDate || monthRange.start);
    q.set("endDate", endDate || monthRange.end);

    window.open(`/transactions/print?${q.toString()}`, "_blank");
  }

  return (
    <div
      className={cn(
        "space-y-6 transition-opacity duration-150",
        isMonthPending && "opacity-55 pointer-events-none"
      )}
    >
      <PageHeader
        title="Transaction History"
        description="Unified historical logs of all financial movements, allocations, and expenditures"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* The period control. Before this the screen carried three periods at
              once - the ledger showed all history, the summary one month, the
              chart twelve - and nothing said so. The key on the client in page.tsx
              remounts this component on navigation, which is what resets the
              pager, the filters and the tab back to their defaults. */}
          <MonthYearPicker month={month} year={year} onChange={navigateToMonth} />
          <Button variant="outline" size="sm" onClick={handlePrintPDF} className="h-9 rounded-xl border-border text-xs flex items-center gap-1.5 cursor-pointer">
            <Printer className="h-4 w-4" /> Print PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-9 rounded-xl border-border text-xs flex items-center gap-1.5 cursor-pointer">
            <FileDown className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="p-1 rounded-xl">
          <TabsTrigger value="transactions" className="flex items-center gap-1.5 text-xs font-semibold rounded-lg">
            <History className="h-4 w-4" /> All Transactions
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-1.5 text-xs font-semibold rounded-lg">
            <FileText className="h-4 w-4" /> Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-6">

      {/* Filter Bar */}
      <FintechCard>
        <FintechCardContent className="p-4 space-y-4">
          {/* Type is a closed set of three, so it is a row of visible pills
              rather than a dropdown - one tap instead of two, and the current
              choice is legible without opening anything. The category filter
              below it stays a Select: that set is user-defined and unbounded,
              and a scroller of forty pills would read as equivalent to a
              dropdown of forty items when it is not.

              This is a restyle, not a capability: the same three values, the same
              state, the same filter. The cascade is preserved deliberately -
              narrowing to Income makes expense categories inapplicable, so the
              category filter resets rather than offering choices that cannot
              apply. */}
          <FilterPills
            label="Filter by transaction type"
            value={type}
            onChange={(val) => {
              setType(val as "all" | "income" | "expense");
              setFilterCategory("all");
              setCurrentPage(1);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "income", label: "Income" },
              { value: "expense", label: "Expenses" },
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search description, notes or category..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9.5 h-10 rounded-xl bg-card border-border text-xs"
              />
            </div>

            <Select
              value={filterCategory}
              onValueChange={(val) => {
                setFilterCategory(val || "all");
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl bg-card border-border text-xs">
                {/* base-ui's Select.Value renders the raw value, not the selected
                    item's children, so an unlabelled Value shows "all". The
                    label is written out here rather than left to the library,
                    which keeps the trigger reading as a label instead of a
                    database value. */}
                <SelectValue placeholder="Category/Source">
                  {filterCategory === "all" ? "All Categories" : filterCategory}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {type !== "expense" &&
                  sources.map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                {type !== "income" &&
                  categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              onClick={resetFilters}
              className="h-10 text-xs text-muted-foreground hover:text-foreground justify-center gap-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> Clear Filters
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60 text-xs">
            <span className="text-muted-foreground flex items-center gap-1 font-medium">
              <Calendar className="h-3.5 w-3.5 text-sulpot-deep" /> Filter Date Range:
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 py-0 px-2 text-xs w-36 rounded-lg bg-card border-border"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 py-0 px-2 text-xs w-36 rounded-lg bg-card border-border"
              />
            </div>
          </div>
        </FintechCardContent>
      </FintechCard>

      {/* Transaction Table */}
      <FintechCard className="p-0 overflow-hidden">
        {/* flex-row, explicitly. The header's base is flex-col, so a caller who
            writes `flex items-center justify-between` and forgets the direction
            gets a COLUMN: items-center then means horizontal centring, and the
            title and subtitle end up stacked in the middle of the card looking
            almost deliberate. 20 of the 28 call sites want the column and say
            nothing, so the default is right; this one wants a row and has to
            ask. */}
        <FintechCardHeader className="px-6 py-4 border-b border-border flex flex-row items-center justify-between">
          <FintechCardTitle>Filtered Results ({totalItems})</FintechCardTitle>
          <span className="text-xs text-muted-foreground">Showing logs based on filter criteria</span>
        </FintechCardHeader>
        <FintechCardContent className="p-0 overflow-x-auto">
          {paginated.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10 italic">
              No matching records found. Try modifying filter criteria.
            </p>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  <th className="py-2.5 px-5">Date</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Category/Source</th>
                  <th className="py-2.5 px-5">Description</th>
                  <th className="py-2.5 px-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {/* py-2, not py-3.5, and figure-inline on the amount. This ledger
                    was the last surface still using a 70px row with a 32px
                    type-ledger figure inside it, so the amount was the loudest
                    thing in every row of a transaction list. The dashboard's
                    Recent Transactions already runs py-2 rows with figure-inline
                    amounts; this makes the two ledgers one idiom instead of two.

                    It is also where most of this screen's height was, and unlike
                    the two compositions that were rendered and rejected, nothing
                    is removed to get it: the pager, the type/category/date
                    filters and the Type badge all stay. */}
                {paginated.map((tx) => {
                  const isIncome = tx.type === "income";
                  return (
                    <tr key={tx.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-5 font-medium text-muted-foreground whitespace-nowrap">
                        {formatDate(tx.date, "MMM dd, yyyy")}
                      </td>
                      <td className="py-2 px-4">
                        <Badge variant={isIncome ? "income" : "expense"} className="text-[10px] uppercase font-bold px-2 py-0.5">
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-1.5">
                          {tx.categoryIcon && <span className="text-sm shrink-0">{tx.categoryIcon}</span>}
                          <span className="font-semibold text-foreground truncate max-w-[140px]">{tx.categoryName}</span>
                        </div>
                      </td>
                      <td className="py-2 px-5">
                        <span className="font-semibold text-foreground block">{tx.title}</span>
                        {tx.notes && <span className="text-[10px] text-muted-foreground block truncate max-w-[280px]">&quot;{tx.notes}&quot;</span>}
                      </td>
                      <td className="py-2 px-5 text-right font-bold tabular-nums text-xs">
                        <span className={isIncome ? "text-sulpot-deep dark:text-sulpot-bright" : "text-rose-600 dark:text-rose-400"}>
                          {isIncome ? "+" : "-"}<CurrencyDisplay amount={tx.amount} className="figure-inline inline font-bold" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 px-6 border-t border-border">
              <span className="type-measurement text-xs text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} items
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-8 text-xs rounded-lg border-border cursor-pointer"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 text-xs rounded-lg border-border cursor-pointer"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </FintechCardContent>
      </FintechCard>
        </TabsContent>

        <TabsContent value="summary">
          <SummaryView
            summary={summary}
            snapshots={snapshots}
            categories={categories}
            budgetStatuses={budgetStatuses}
            month={month}
            year={year}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
