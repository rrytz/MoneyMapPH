"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  PiggyBank,
  Shield,
  Trash2,
  Calendar,
  Pencil,
  Sparkles,
  ArrowUpRight,
  Target,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { addGoal, editGoal, removeGoal, recordContribution } from "./actions";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { SavingsGoal, ExpenseCategory } from "@/lib/types";
import type { EmergencyFundStatus } from "@/lib/services/forecast.service";

interface SavingsPageClientProps {
  initialGoals: SavingsGoal[];
  categories: ExpenseCategory[];
  emergencyStatus: EmergencyFundStatus;
}

export function SavingsPageClient({
  initialGoals,
  categories,
  emergencyStatus,
}: SavingsPageClientProps) {
  const goals = initialGoals;
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [contributionModalOpen, setContributionModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Goal Form State
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);

  // Contribution Form State
  const [contribAmount, setContribAmount] = useState("");
  const [contribDate, setContribDate] = useState(new Date().toISOString().split("T")[0]);
  const [contribCategory, setContribCategory] = useState("");
  const [contribNotes, setContribNotes] = useState("");

  const [isPending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const savingsCategory = categories.find((c) => 
    c.name.toLowerCase().includes("savings") || 
    c.name.toLowerCase().includes("emergency")
  ) || categories[0];

  function openNewGoalModal() {
    setSelectedGoal(null);
    setGoalName("");
    setGoalTarget("");
    setGoalDate("");
    setGoalNotes("");
    setIsEmergency(false);
    setGoalModalOpen(true);
  }

  function openEditGoalModal(goal: SavingsGoal) {
    setSelectedGoal(goal);
    setGoalName(goal.name);
    setGoalTarget(goal.target_amount.toString());
    setGoalDate(goal.target_date || "");
    setGoalNotes(goal.notes || "");
    setIsEmergency(goal.is_emergency_fund);
    setGoalModalOpen(true);
  }

  function openContributionModal(goal: SavingsGoal) {
    setSelectedGoal(goal);
    setContribAmount("");
    setContribDate(new Date().toISOString().split("T")[0]);
    const targetCat = categories.find((c) => 
      goal.is_emergency_fund 
        ? c.name.toLowerCase().includes("emergency") 
        : c.name.toLowerCase().includes("savings")
    ) || savingsCategory;
    
    setContribCategory(targetCat?.id || "");
    setContribNotes(`Funded target: ${goal.name}`);
    setContributionModalOpen(true);
  }

  async function handleGoalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goalName || !goalTarget) {
      toast.error("Please fill in required fields.");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: goalName,
        target_amount: Number(goalTarget),
        target_date: goalDate || undefined,
        notes: goalNotes || undefined,
        is_emergency_fund: isEmergency,
      };

      const res = selectedGoal
        ? await editGoal(selectedGoal.id, payload)
        : await addGoal(payload);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(selectedGoal ? "Savings goal updated" : "Savings goal created");
        setGoalModalOpen(false);
      }
    });
  }

  async function handleContributionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGoal || !contribAmount || !contribCategory) {
      toast.error("Please fill in required fields.");
      return;
    }

    startTransition(async () => {
      const res = await recordContribution(selectedGoal.id, {
        amount: Number(contribAmount),
        date: contribDate,
        category_id: contribCategory,
        notes: contribNotes || undefined,
      }, selectedGoal.name);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Allocated ₱${contribAmount} to ${selectedGoal.name}`);
        setContributionModalOpen(false);
      }
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await removeGoal(deleteId);
    setDeleting(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Goal deleted successfully");
    }
    setDeleteId(null);
  }

  const totalTarget = goals.reduce((sum, g) => sum + Number(g.target_amount), 0);
  const totalSaved = goals.reduce((sum, g) => sum + Number(g.current_amount), 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals Dashboard"
        description="Set goals, track emergency adequacy, and build long-term wealth"
      >
        <Button onClick={openNewGoalModal} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 h-9 cursor-pointer">
          <Plus className="mr-1.5 h-4 w-4" /> Create Goal
        </Button>
      </PageHeader>

      {/* Emergency Adequacy Alert Card */}
      {emergencyStatus.hasFund && (
        <FintechCard className="border-l-4 border-l-emerald-600 bg-card">
          <FintechCardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Emergency Reserve Adequacy</h3>
                  <p className="text-xs text-muted-foreground">Evaluated against 3-6 months of historical outflow</p>
                </div>
              </div>
              <Badge
                variant={
                  emergencyStatus.status === "adequate"
                    ? "income"
                    : emergencyStatus.status === "warning"
                    ? "warning"
                    : "expense"
                }
                className="uppercase tracking-wider font-bold text-[10px]"
              >
                {emergencyStatus.status === "adequate"
                  ? "Adequate Reserve"
                  : emergencyStatus.status === "warning"
                  ? "Warning Status"
                  : "Critical Reserve"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
                <span className="text-xs text-muted-foreground font-medium block">Coverage Horizon</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 block">
                  {emergencyStatus.monthsCovered} Months
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
                <span className="text-xs text-muted-foreground font-medium block">Avg Monthly Outflow</span>
                <CurrencyDisplay amount={emergencyStatus.averageExpenses} className="text-xl font-bold text-foreground mt-0.5 block" />
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
                <span className="text-xs text-muted-foreground font-medium block">Emergency Fund Balance</span>
                <CurrencyDisplay amount={emergencyStatus.currentBalance} className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block" />
              </div>
            </div>
          </FintechCardContent>
        </FintechCard>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <FintechCard>
          <FintechCardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <PiggyBank className="h-5 w-5" />
              </div>
              <Badge variant="income">Accumulated</Badge>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground block">Total Saved Balance</span>
              <CurrencyDisplay amount={totalSaved} className="text-3xl sm:text-4xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400" />
            </div>
          </FintechCardContent>
        </FintechCard>

        <FintechCard>
          <FintechCardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Target className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold text-slate-500">Progress</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground block">Overall Completion</span>
              <p className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums">{Math.round(overallProgress)}%</p>
            </div>
          </FintechCardContent>
        </FintechCard>

        <FintechCard>
          <FintechCardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold text-slate-500">Total Targets</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground block">Combined Goal Targets</span>
              <CurrencyDisplay amount={totalTarget} className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground" />
            </div>
          </FintechCardContent>
        </FintechCard>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-6 w-6" />}
          title="No Savings Goals Set"
          description="Create savings targets for emergency reserves, travel, motorcycle, or gadget funds."
          actionLabel="Create First Goal"
          onAction={openNewGoalModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {goals.map((goal) => {
            const goalProgress = goal.target_amount > 0 ? (Number(goal.current_amount) / Number(goal.target_amount)) * 100 : 0;
            const isCompleted = goalProgress >= 100;
            const isEmergencyGoal = goal.is_emergency_fund;

            return (
              <FintechCard
                key={goal.id}
                className={cn(
                  "relative overflow-hidden transition-all duration-200",
                  isEmergencyGoal && "border-emerald-500/40 ring-1 ring-emerald-500/20"
                )}
              >
                <FintechCardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-foreground truncate max-w-[200px]">{goal.name}</h4>
                        {isEmergencyGoal && (
                          <Badge variant="income" className="text-[10px]">
                            <Shield className="h-2.5 w-2.5 mr-0.5" /> Emergency Fund
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge variant="info" className="text-[10px]">
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Fully Funded
                          </Badge>
                        )}
                      </div>
                      {goal.target_date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                          <Calendar className="h-3 w-3" /> Target Date: {formatDate(goal.target_date, "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditGoalModal(goal)} className="h-8 w-8 text-slate-500">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(goal.id)} className="h-8 w-8 text-rose-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-between items-baseline pt-1">
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">Current Balance</span>
                      <CurrencyDisplay amount={Number(goal.current_amount)} className="text-2xl font-bold block text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground font-medium">Target Amount</span>
                      <CurrencyDisplay amount={Number(goal.target_amount)} className="text-base font-semibold block text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                      <span>Funded</span>
                      <span className="font-bold text-foreground tabular-nums">{Math.round(goalProgress)}%</span>
                    </div>
                    <Progress value={goalProgress} className="h-2 rounded-full [&>div]:bg-emerald-500" />
                  </div>

                  <Button
                    onClick={() => openContributionModal(goal)}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 shadow-xs cursor-pointer"
                  >
                    <ArrowUpRight className="h-4 w-4 mr-1.5" /> Contribute Funds
                  </Button>
                </FintechCardContent>
              </FintechCard>
            );
          })}
        </div>
      )}

      {/* Add / Edit Goal Dialog */}
      <Dialog open={goalModalOpen} onOpenChange={setGoalModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedGoal ? "Edit Savings Goal" : "Create Savings Goal"}</DialogTitle>
            <DialogDescription>
              Configure goal amount, metrics, target dates, and emergency fund status.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGoalSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="goal-name">Goal Name <span className="text-rose-500">*</span></Label>
              <Input
                id="goal-name"
                placeholder="e.g. Travel, Emergency Reserves"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target Amount (₱) <span className="text-rose-500">*</span></Label>
              <Input
                id="goal-target"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-date">Target Date (Optional)</Label>
              <Input
                id="goal-date"
                type="date"
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-notes">Notes (Optional)</Label>
              <Textarea
                id="goal-notes"
                placeholder="Details or priorities..."
                value={goalNotes}
                onChange={(e) => setGoalNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2 py-1">
              <input
                id="goal-emergency"
                type="checkbox"
                checked={isEmergency}
                onChange={(e) => setIsEmergency(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <Label htmlFor="goal-emergency" className="cursor-pointer select-none">
                Mark as primary Emergency Fund
              </Label>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setGoalModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {selectedGoal ? "Save Changes" : "Create Goal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Contribution Dialog */}
      <Dialog open={contributionModalOpen} onOpenChange={setContributionModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Contribute to {selectedGoal?.name}</DialogTitle>
            <DialogDescription>
              Logs a contribution towards this goal. This will register as an expense in the selected category.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleContributionSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="contrib-amount">Contribution Amount (₱) <span className="text-rose-500">*</span></Label>
              <Input
                id="contrib-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={contribAmount}
                onChange={(e) => setContribAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contrib-date">Date <span className="text-rose-500">*</span></Label>
              <Input
                id="contrib-date"
                type="date"
                value={contribDate}
                onChange={(e) => setContribDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contrib-category">Expense Category <span className="text-rose-500">*</span></Label>
              <Select value={contribCategory} onValueChange={(val) => setContribCategory(val || "")} required>
                <SelectTrigger id="contrib-category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contrib-notes">Notes (Optional)</Label>
              <Input
                id="contrib-notes"
                placeholder="e.g. Monthly transfer"
                value={contribNotes}
                onChange={(e) => setContribNotes(e.target.value)}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setContributionModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Record Contribution
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Savings Goal"
        description="This will permanently delete this savings goal. Linked transaction histories will not be deleted, but the goal target itself will be removed. This action cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
