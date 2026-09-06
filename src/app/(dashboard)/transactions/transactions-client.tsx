"use client";

import { useState } from "react";
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
import { formatDate } from "@/lib/utils/date";
import type { UnifiedTransaction, ExpenseCategory, IncomeSource, MonthlySummary, BudgetStatus, MonthlySnapshot } from "@/lib/types";

interface TransactionsClientProps {
  initialTransactions: UnifiedTransaction[];
  categories: ExpenseCategory[];
  sources: IncomeSource[];
  summary: MonthlySummary;
  snapshots: MonthlySnapshot[];
  budgetStatuses: BudgetStatus[];
}

export function TransactionsClient({
  initialTransactions,
  categories,
  sources,
  summary,
  snapshots,
  budgetStatuses,
}: TransactionsClientProps) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

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
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);

    window.open(`/transactions/print?${q.toString()}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaction History"
        description="Unified historical logs of all financial movements, allocations, and expenditures"
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintPDF} className="h-9 rounded-xl border-border text-xs flex items-center gap-1.5 cursor-pointer">
            <Printer className="h-4 w-4" /> Print PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-9 rounded-xl border-border text-xs flex items-center gap-1.5 cursor-pointer">
            <FileDown className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
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
              value={type}
              onValueChange={(val) => {
                setType((val || "all") as "all" | "income" | "expense");
                setFilterCategory("all");
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl bg-card border-border text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income Only</SelectItem>
                <SelectItem value="expense">Expenses Only</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterCategory}
              onValueChange={(val) => {
                setFilterCategory(val || "all");
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl bg-card border-border text-xs">
                <SelectValue placeholder="Category/Source" />
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
              <Calendar className="h-3.5 w-3.5 text-emerald-600" /> Filter Date Range:
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
        <FintechCardHeader className="px-6 py-4 border-b border-border flex items-center justify-between">
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
                <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/50 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  <th className="py-3.5 px-5">Date</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Category/Source</th>
                  <th className="py-3.5 px-5">Description</th>
                  <th className="py-3.5 px-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginated.map((tx) => {
                  const isIncome = tx.type === "income";
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-5 font-medium text-muted-foreground whitespace-nowrap">
                        {formatDate(tx.date, "MMM dd, yyyy")}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={isIncome ? "income" : "expense"} className="text-[10px] uppercase font-bold px-2 py-0.5">
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {tx.categoryIcon && <span className="text-sm shrink-0">{tx.categoryIcon}</span>}
                          <span className="font-semibold text-foreground truncate max-w-[140px]">{tx.categoryName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-semibold text-foreground block">{tx.title}</span>
                        {tx.notes && <span className="text-[10px] text-muted-foreground block truncate max-w-[280px]">&quot;{tx.notes}&quot;</span>}
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold tabular-nums text-xs">
                        <span className={isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {isIncome ? "+" : "-"}<CurrencyDisplay amount={tx.amount} className="inline font-bold" />
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
              <span className="text-xs text-muted-foreground">
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
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
