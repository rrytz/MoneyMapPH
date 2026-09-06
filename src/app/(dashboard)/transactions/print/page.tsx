import { createClient } from "@/lib/supabase/server";
import { getUnifiedTransactions } from "@/lib/services/transaction.service";
import { redirect } from "next/navigation";
import { TriggerPrint } from "./trigger-print";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Logo } from "@/components/shared/logo";
import { formatDate } from "@/lib/utils/date";

export default async function PrintTransactionsPage(props: {
  searchParams: Promise<{
    search?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: transactions } = await getUnifiedTransactions(supabase, user.id, {
    search: searchParams.search,
    type: (searchParams.type === "income" || searchParams.type === "expense") ? searchParams.type : undefined,
    startDate: searchParams.startDate,
    endDate: searchParams.endDate,
    // No limit — print page exports all matching records
    limit: 10_000,
  });

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashFlow = totalIncome - totalExpense;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 bg-white text-black min-h-screen text-xs">
      <TriggerPrint />
      
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
        <div>
          <Logo size="md" showTagline />
          <p className="text-slate-500 text-[10px] mt-1">Financial Statement & Transactions Report</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-slate-800">Date Generated:</p>
          <p className="text-slate-500">{new Date().toLocaleDateString("en-PH", { dateStyle: "long" })}</p>
        </div>
      </div>

      {/* Filters Applied */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
        <div>
          <span className="font-bold block text-slate-700">Type Filter:</span>
          <span className="capitalize">{searchParams.type || "All"}</span>
        </div>
        <div>
          <span className="font-bold block text-slate-700">Search Term:</span>
          <span>{searchParams.search ? `"${searchParams.search}"` : "None"}</span>
        </div>
        <div>
          <span className="font-bold block text-slate-700">Start Date:</span>
          <span>{searchParams.startDate ? formatDate(searchParams.startDate, "MMM d, yyyy") : "All History"}</span>
        </div>
        <div>
          <span className="font-bold block text-slate-700">End Date:</span>
          <span>{searchParams.endDate ? formatDate(searchParams.endDate, "MMM d, yyyy") : "Latest"}</span>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-3 gap-4 border border-slate-200 rounded-lg p-4 bg-slate-50/50">
        <div>
          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Total Income</span>
          <CurrencyDisplay amount={totalIncome} className="text-base font-black text-slate-900" />
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Total Expenses</span>
          <CurrencyDisplay amount={totalExpense} className="text-base font-black text-slate-900" />
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Net Cash Flow</span>
          <CurrencyDisplay amount={netCashFlow} className={`text-base font-black ${netCashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}`} />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="space-y-2">
        <h2 className="font-bold text-sm text-slate-900">Transaction Logs ({transactions.length})</h2>
        <table className="w-full border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-left">
              <th className="p-2 border-r border-slate-200 font-semibold w-24">Date</th>
              <th className="p-2 border-r border-slate-200 font-semibold w-20">Type</th>
              <th className="p-2 border-r border-slate-200 font-semibold w-36">Category/Source</th>
              <th className="p-2 border-r border-slate-200 font-semibold">Description</th>
              <th className="p-2 font-semibold text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-slate-150 last:border-0 hover:bg-slate-50/30">
                <td className="p-2 border-r border-slate-200 whitespace-nowrap">{formatDate(tx.date, "MMM dd, yyyy")}</td>
                <td className="p-2 border-r border-slate-200 capitalize font-medium">{tx.type}</td>
                <td className="p-2 border-r border-slate-200 font-medium">{tx.categoryName}</td>
                <td className="p-2 border-r border-slate-200">
                  <span className="font-medium">{tx.title}</span>
                  {tx.notes && <span className="text-[9px] text-slate-500 block italic">({tx.notes})</span>}
                </td>
                <td className={`p-2 text-right font-bold tabular-nums ${tx.type === "income" ? "text-slate-900" : "text-rose-700"}`}>
                  {tx.type === "expense" ? "-" : "+"}₱{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Disclaimer / Footer */}
      <div className="text-center pt-8 border-t border-slate-200 text-[10px] text-slate-400">
        <p>This statement is generated automatically by MoneyMap PH. Keep for personal budget reviews only.</p>
      </div>
    </div>
  );
}
