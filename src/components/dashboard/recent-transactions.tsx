"use client";

import Link from "next/link";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import { History, Coffee, Building2, Zap, ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: "income" | "expense";
  title: string;
  amount: number;
  date: string;
  category?: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

function getIconForTitle(title: string, type: "income" | "expense") {
  if (type === "income") return <Building2 className="h-4 w-4 text-sulpot-deep dark:text-sulpot-bright" />;
  const lower = title.toLowerCase();
  if (lower.includes("starbucks") || lower.includes("food") || lower.includes("coffee")) return <Coffee className="h-4 w-4 text-rose-500" />;
  if (lower.includes("meralco") || lower.includes("bill") || lower.includes("utility")) return <Zap className="h-4 w-4 text-indigo-500" />;
  return <ShieldCheck className="h-4 w-4 text-ink-muted" />;
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <FintechCard>
        <FintechCardHeader className="flex flex-row items-center justify-between pb-3">
          <FintechCardTitle>Recent Transactions</FintechCardTitle>
          <Link href="/transactions" className="text-xs text-sulpot-deep hover:underline flex items-center gap-1 font-medium">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </FintechCardHeader>
        <FintechCardContent>
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="No transactions recorded"
            description="Start logging income and expenses to view real-time history."
            actionLabel="Add Transaction"
            actionHref="/transactions"
          />
        </FintechCardContent>
      </FintechCard>
    );
  }

  return (
    <FintechCard className="flex flex-col">
      <FintechCardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <FintechCardTitle>Recent Transactions</FintechCardTitle>
          <p className="text-xs text-muted-foreground">Latest financial activity</p>
        </div>
        <Link
          href="/transactions"
          className="text-xs font-semibold text-ink-muted hover:text-sulpot-deep border border-border px-3 py-1 rounded-xl bg-muted/30 transition-colors"
        >
          View all
        </Link>
      </FintechCardHeader>

      <FintechCardContent className="p-0 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[10px] uppercase font-normal text-muted-foreground tracking-wider">
              <th className="py-3 px-5">Description</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {transactions.map((tx) => {
              const isIncome = tx.type === "income";
              const categoryLabel = tx.category || (isIncome ? "INCOME" : "EXPENSE");

              return (
                <tr
                  key={tx.id}
                  className="hover:bg-muted/50 transition-colors duration-150"
                >
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-muted shrink-0">
                        {getIconForTitle(tx.title, tx.type)}
                      </div>
                      <span className="font-semibold text-foreground text-xs">{tx.title}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge
                      variant={isIncome ? "income" : "expense"}
                      className="text-[10px] uppercase px-2 py-0.5 tracking-wider font-bold"
                    >
                      {categoryLabel}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground font-medium">
                    {formatDate(tx.date, "MMM d, yyyy")}
                  </td>
                  <td
                    className={cn(
                      "py-3.5 px-5 text-right font-bold tabular-nums text-xs",
                      isIncome ? "text-sulpot-deep dark:text-sulpot-bright" : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {isIncome ? "+" : "-"}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </FintechCardContent>
    </FintechCard>
  );
}
