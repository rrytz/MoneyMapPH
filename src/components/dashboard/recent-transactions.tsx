import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import { TrendingUp, TrendingDown } from "lucide-react";
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

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground text-sm">
          No recent transactions
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "rounded-full p-1.5",
                  tx.type === "income" ? "bg-income/10" : "bg-danger/10"
                )}>
                  {tx.type === "income" ? (
                    <TrendingUp className="h-3.5 w-3.5 text-income" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-danger" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{tx.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(tx.date, "MMM d")}</p>
                </div>
              </div>
              <CurrencyDisplay
                amount={tx.amount}
                className={cn(
                  "text-sm font-semibold",
                  tx.type === "income" ? "text-income" : "text-danger"
                )}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
