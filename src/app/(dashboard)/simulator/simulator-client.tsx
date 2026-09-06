"use client";

import { useState, useTransition } from "react";
import {
  Trash2,
  Calendar,
  ArrowRight,
  Activity,
  Calculator,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { addSimulation, removeSimulation } from "./actions";
import { formatDate } from "@/lib/utils/date";
import { calculatePurchaseImpact } from "@/lib/services/simulation.service";
import type { SimulatedPurchase, SavingsGoal } from "@/lib/types";
import type { EmergencyFundStatus } from "@/lib/services/forecast.service";

interface SimulatorClientProps {
  simulations: SimulatedPurchase[];
  goals: SavingsGoal[];
  emergencyStatus: EmergencyFundStatus;
  monthlyNetSavings: number;
}

export function SimulatorClient({
  simulations,
  goals,
  emergencyStatus,
  monthlyNetSavings,
}: SimulatorClientProps) {
  const [purchaseName, setPurchaseName] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeAmount = Number(purchaseAmount) || 0;
  const impact = calculatePurchaseImpact(
    activeAmount,
    emergencyStatus,
    goals,
    monthlyNetSavings
  );

  async function handleSaveSimulation(e: React.FormEvent) {
    e.preventDefault();
    if (!purchaseName || !purchaseAmount) {
      toast.error("Please provide name and amount.");
      return;
    }

    startTransition(async () => {
      const res = await addSimulation({
        name: purchaseName,
        amount: Number(purchaseAmount),
        target_date: targetDate || undefined,
        notes: notes || undefined,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Simulation saved successfully");
        setPurchaseName("");
        setPurchaseAmount("");
        setTargetDate("");
        setNotes("");
      }
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await removeSimulation(deleteId);
    setDeleting(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Simulation removed");
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Can I Afford This?"
        description="Simulate large purchases and evaluate real-time impact on emergency reserves and savings timelines"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulator Form (1 Column) */}
        <FintechCard className="h-fit">
          <FintechCardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Calculator className="h-4 w-4" />
              </div>
              <FintechCardTitle>Simulate Purchase</FintechCardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Enter details to calculate financial impact</p>
          </FintechCardHeader>
          <form onSubmit={handleSaveSimulation}>
            <FintechCardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sim-name">Purchase Name <span className="text-rose-500">*</span></Label>
                <Input
                  id="sim-name"
                  placeholder="e.g. Electric Scooter, Gaming Laptop"
                  value={purchaseName}
                  onChange={(e) => setPurchaseName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sim-amount">Cost Amount (₱) <span className="text-rose-500">*</span></Label>
                <Input
                  id="sim-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sim-date">Target Purchase Date</Label>
                <Input
                  id="sim-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sim-notes">Notes</Label>
                <Textarea
                  id="sim-notes"
                  placeholder="Details, store links or payment terms..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={isPending} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9.5 shadow-xs cursor-pointer">
                Save Simulation
              </Button>
            </FintechCardContent>
          </form>
        </FintechCard>

        {/* Impact Visualizer Dashboard (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Emergency Fund Impact Card */}
          <FintechCard>
            <FintechCardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                  <Activity className="h-4 w-4" />
                </div>
                <FintechCardTitle>Emergency Reserve Impact</FintechCardTitle>
              </div>
              <p className="text-xs text-muted-foreground">How this purchase shifts your emergency safety net</p>
            </FintechCardHeader>
            <FintechCardContent className="space-y-4">
              {!emergencyStatus.hasFund ? (
                <p className="text-xs text-muted-foreground py-2 italic">
                  No Emergency Fund goal configured. Create one on the Savings tab to evaluate impact.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-border">
                      <span className="text-xs text-muted-foreground font-medium block">Coverage Before</span>
                      <span className="text-xl font-bold text-foreground tabular-nums block mt-0.5">
                        {impact.emergencyFundImpact.beforeMonthsCovered} Months
                      </span>
                      <Badge variant="income" className="mt-1 text-[9px] uppercase font-bold">
                        {impact.emergencyFundImpact.beforeStatus}
                      </Badge>
                    </div>
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-950">
                      <span className="text-xs text-muted-foreground font-medium block">Coverage After</span>
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
                        {impact.emergencyFundImpact.afterMonthsCovered} Months
                      </span>
                      <Badge
                        variant={impact.emergencyFundImpact.afterStatus === "critical" ? "expense" : "income"}
                        className="mt-1 text-[9px] uppercase font-bold"
                      >
                        {impact.emergencyFundImpact.afterStatus}
                      </Badge>
                    </div>
                  </div>

                  {impact.emergencyFundImpact.isSeverelyImpacted && (
                    <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 p-3.5 rounded-2xl border border-rose-200/50 text-xs flex items-start gap-2.5 font-medium">
                      <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5 text-rose-600" />
                      <span>
                        <strong>Critical Drop Warning:</strong> Making this purchase will deplete your emergency reserve to less than 3 months of expenses. Consider saving up over time instead.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </FintechCardContent>
          </FintechCard>

          {/* Goal Timelines Impact Card */}
          <FintechCard>
            <FintechCardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                  <Calendar className="h-4 w-4" />
                </div>
                <FintechCardTitle>Savings Goals Timeline Shift</FintechCardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Timeline shift for active goals when redirecting net savings (₱{monthlyNetSavings.toLocaleString()}/mo)
              </p>
            </FintechCardHeader>
            <FintechCardContent className="p-0">
              {goals.length === 0 ? (
                <p className="text-xs text-muted-foreground p-6 text-center">
                  No active savings goals found.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {impact.goalsImpact.map((item) => (
                    <div key={item.id} className="p-4 px-6 flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
                      <div>
                        <span className="text-xs font-semibold text-foreground block">{item.name}</span>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>Original: {item.beforeMonthsToReach === 0 ? "Achieved" : item.beforeMonthsToReach === "infinite" ? "No progress" : `${item.beforeMonthsToReach} mo`}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="font-semibold text-foreground">
                            Projected: {item.afterMonthsToReach === 0 ? "Achieved" : item.afterMonthsToReach === "infinite" ? "No progress" : `${item.afterMonthsToReach} mo`}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {item.delayMonths === 0 ? (
                          <Badge variant="income" className="text-[10px]">No Impact</Badge>
                        ) : item.delayMonths === "infinite" ? (
                          <Badge variant="expense" className="text-[10px]">Delayed indefinitely</Badge>
                        ) : (
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            +{item.delayMonths} mo delay
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FintechCardContent>
          </FintechCard>
        </div>
      </div>

      {/* Saved Simulations Section */}
      <FintechCard>
        <FintechCardHeader className="pb-4">
          <FintechCardTitle>Saved Simulated Purchases</FintechCardTitle>
          <p className="text-xs text-muted-foreground">Saved purchase scenarios for review</p>
        </FintechCardHeader>
        <FintechCardContent>
          {simulations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No saved purchase simulations. Create and save one using the form above.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {simulations.map((sim) => (
                <div key={sim.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-border space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-sm text-foreground block truncate max-w-[150px]">{sim.name}</span>
                      {sim.target_date && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" /> {formatDate(sim.target_date, "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-rose-500 hover:text-rose-600"
                      onClick={() => setDeleteId(sim.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-medium">Estimated Amount</span>
                    <CurrencyDisplay amount={Number(sim.amount)} className="text-lg font-bold text-foreground block" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </FintechCardContent>
      </FintechCard>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Saved Simulation"
        description="This will permanently delete this saved simulated purchase from your records. This action cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
