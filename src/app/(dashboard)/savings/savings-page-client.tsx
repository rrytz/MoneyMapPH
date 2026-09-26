"use client";

import { useState, useTransition, type FormEvent } from "react";
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
  CircleDollarSign,
  HandCoins,
  RotateCcw,
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
import { addGoal, editGoal, removeGoal, recordContribution, addDebt, editDebt, removeDebt, payDebt, unpayDebt } from "./actions";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { debtPaidOffAmount, debtRemaining, debtProgress, isDebtPaidOff, isDebtOverdue } from "@/lib/utils/debt";
import type { SavingsGoal, ExpenseCategory, Debt, DebtPayment } from "@/lib/types";
import type { EmergencyFundStatus } from "@/lib/services/forecast.service";

interface SavingsPageClientProps {
  initialGoals: SavingsGoal[];
  categories: ExpenseCategory[];
  emergencyStatus: EmergencyFundStatus;
  initialDebts: Debt[];
  debtPayments: DebtPayment[];
}

export function SavingsPageClient({
  initialGoals,
  categories,
  emergencyStatus,
  initialDebts,
  debtPayments,
}: SavingsPageClientProps) {
  const goals = initialGoals;
  const debts = initialDebts;
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

  // Debt Form State
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [debtDeleteId, setDebtDeleteId] = useState<string | null>(null);
  const [deletingDebt, setDeletingDebt] = useState(false);

  const [debtName, setDebtName] = useState("");
  const [debtTotal, setDebtTotal] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");
  const [debtCategory, setDebtCategory] = useState("");
  const [debtNotes, setDebtNotes] = useState("");

  // Payment Form State
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payCategory, setPayCategory] = useState("");
  const [payNotes, setPayNotes] = useState("");

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

  function openNewDebtModal() {
    setSelectedDebt(null);
    setDebtName("");
    setDebtTotal("");
    setDebtDueDate("");
    setDebtCategory("");
    setDebtNotes("");
    setDebtModalOpen(true);
  }

  function openEditDebtModal(debt: Debt) {
    setSelectedDebt(debt);
    setDebtName(debt.name);
    setDebtTotal(Number(debt.total_amount).toString());
    setDebtDueDate(debt.due_date);
    setDebtCategory(debt.category_id || "");
    setDebtNotes(debt.notes || "");
    setDebtModalOpen(true);
  }

  function openPayModal(debt: Debt) {
    setSelectedDebt(debt);
    setPayAmount("");
    setPayDate(new Date().toISOString().split("T")[0]);
    const fallback = categories.find((c) =>
      c.name.toLowerCase().includes("savings") || c.name.toLowerCase().includes("emergency")
    ) || categories[0];
    setPayCategory(debt.category_id || fallback?.id || "");
    setPayNotes("");
    setPayModalOpen(true);
  }

  async function handleDebtSubmit(e: FormEvent) {
    e.preventDefault();
    if (!debtName || !debtTotal || !debtDueDate) {
      toast.error("Please fill in required fields.");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: debtName,
        total_amount: Number(debtTotal),
        due_date: debtDueDate,
        category_id: debtCategory || undefined,
        notes: debtNotes || undefined,
      };

      const res = selectedDebt
        ? await editDebt(selectedDebt.id, payload)
        : await addDebt(payload);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(selectedDebt ? "Debt updated" : "Debt created");
        setDebtModalOpen(false);
      }
    });
  }

  async function handlePaySubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedDebt || !payAmount || !payCategory) {
      toast.error("Please fill in required fields.");
      return;
    }

    startTransition(async () => {
      const res = await payDebt({
        debtId: selectedDebt.id,
        paidAt: payDate,
        amount: Number(payAmount),
        categoryId: payCategory,
        notes: payNotes || undefined,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Recorded ₱${payAmount} payment on ${selectedDebt.name}`);
        setPayModalOpen(false);
      }
    });
  }

  async function handleUnpay(paymentId: string) {
    startTransition(async () => {
      const res = await unpayDebt({ paymentId });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Payment undone");
      }
    });
  }

  async function handleDebtDelete() {
    if (!debtDeleteId) return;
    setDeletingDebt(true);
    const res = await removeDebt(debtDeleteId);
    setDeletingDebt(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Debt deleted successfully");
    }
    setDebtDeleteId(null);
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
        <Button onClick={openNewGoalModal} className="rounded-xl bg-primary hover:bg-primary/80 text-white font-medium text-xs px-4 h-9 cursor-pointer">
          <Plus className="mr-1.5 h-4 w-4" /> Create Goal
        </Button>
      </PageHeader>

      {/* The page's answer first: accumulated savings. Completion and target
          context sit beside it as supporting readouts, not peer cards. */}
      <FintechCard>
        <FintechCardContent className="p-0">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <div className="p-2.5 rounded-xl bg-sulpot-tint text-sulpot-deep dark:bg-sulpot-tint dark:text-sulpot-bright">
                  <PiggyBank className="h-5 w-5" />
                </div>
                <Badge variant="income">Accumulated</Badge>
              </div>
              <span className="mt-6 block text-xs font-medium text-muted-foreground">Total saved balance</span>
              <CurrencyDisplay
                amount={totalSaved}
                className="type-ledger text-4xl sm:text-5xl font-semibold tracking-tight text-sulpot-deep dark:text-sulpot-bright"
              />
            </div>
            <div className="grid grid-cols-2 border-t border-border lg:border-t-0 lg:border-l">
              <div className="p-6">
                <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                  <Target className="h-5 w-5" />
                </div>
                <span className="mt-4 block text-xs text-muted-foreground">Overall completion</span>
                <p className="type-measurement mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {Math.round(overallProgress)}%
                </p>
              </div>
              <div className="border-l border-border p-6">
                <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
                  <Wallet className="h-5 w-5" />
                </div>
                <span className="mt-4 block text-xs text-muted-foreground">Combined goal targets</span>
                <CurrencyDisplay amount={totalTarget} className="type-ledger mt-1 block text-2xl font-semibold tabular-nums text-foreground" />
              </div>
            </div>
          </div>
        </FintechCardContent>
      </FintechCard>

      {/* Emergency Adequacy Alert Card */}
      {emergencyStatus.hasFund && (
        <FintechCard className="border-l-4 border-l-sulpot bg-card">
          <FintechCardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-sulpot-tint text-sulpot-deep dark:bg-sulpot-tint dark:text-sulpot-bright">
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
              <div className="rounded-lg bg-muted/30 border-transparent p-4">
                <span className="type-section-label block">Coverage Horizon</span>
                <span className="type-measurement text-2xl font-bold text-sulpot-deep dark:text-sulpot-bright tabular-nums mt-0.5 block">
                  {emergencyStatus.monthsCovered} Months
                </span>
              </div>
              <div className="rounded-lg bg-muted/30 border-transparent p-4">
                <span className="type-section-label block">Up to 6-month avg outflow</span>
                <CurrencyDisplay amount={emergencyStatus.averageExpenses} className="type-ledger text-xl font-bold text-foreground mt-0.5 block" />
              </div>
              <div className="rounded-lg bg-muted/30 border-transparent p-4">
                <span className="type-section-label block">Emergency Fund Balance</span>
                <CurrencyDisplay amount={emergencyStatus.currentBalance} className="type-ledger text-xl font-bold text-sulpot-deep dark:text-sulpot-bright mt-0.5 block" />
              </div>
            </div>
          </FintechCardContent>
        </FintechCard>
      )}

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
                  isEmergencyGoal && "border-sulpot/40 ring-1 ring-sulpot/20"
                )}
              >
                <FintechCardContent className="p-6 space-y-4">
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
                      <Button variant="ghost" size="icon" onClick={() => openEditGoalModal(goal)} className="h-8 w-8 text-ink-muted">
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
                      <CurrencyDisplay amount={Number(goal.current_amount)} className="type-ledger text-2xl font-bold block text-sulpot-deep dark:text-sulpot-bright" />
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground font-medium">Target Amount</span>
                      <CurrencyDisplay amount={Number(goal.target_amount)} className="type-ledger text-base font-semibold block text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                      <span>Funded</span>
                      <span className="font-bold text-foreground tabular-nums">{Math.round(goalProgress)}%</span>
                    </div>
                    <Progress value={goalProgress} className="h-2 rounded-full [&>div]:bg-sulpot" />
                  </div>

                  <Button
                    onClick={() => openContributionModal(goal)}
                    className="w-full rounded-xl bg-primary hover:bg-primary/80 text-white font-medium text-xs h-9 shadow-xs cursor-pointer"
                  >
                    <ArrowUpRight className="h-4 w-4 mr-1.5" /> Contribute Funds
                  </Button>
                </FintechCardContent>
              </FintechCard>
            );
          })}
        </div>
      )}

      {/* Payoff Debts Section */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <CircleDollarSign className="h-4 w-4" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Payoff Debts</h3>
          </div>
          <Button onClick={openNewDebtModal} className="rounded-xl font-medium text-xs px-4 h-9 cursor-pointer">
            <Plus className="mr-1.5 h-4 w-4" /> New Debt
          </Button>
        </div>

        {debts.length === 0 ? (
          <EmptyState
            icon={<CircleDollarSign className="h-6 w-6" />}
            title="No Debts Tracked"
            description="Add loans, credit balances, or personal debts to track payoff progress."
            actionLabel="Add First Debt"
            onAction={openNewDebtModal}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {debts.map((debt) => {
              const paid = debtPaidOffAmount(debtPayments.filter((p) => p.debt_id === debt.id));
              const remaining = debtRemaining(debt, paid);
              const progress = debtProgress(debt, paid);
              const paidOff = isDebtPaidOff(debt, paid);
              const overdue = isDebtOverdue(debt, paid, new Date().toISOString().split("T")[0]);
              const history = debtPayments
                .filter((p) => p.debt_id === debt.id)
                .sort((a, b) => a.paid_at.localeCompare(b.paid_at));

              return (
                <FintechCard
                  key={debt.id}
                  className="relative overflow-hidden transition-all duration-200 border-rose-200/70 dark:border-rose-900/40"
                >
                  <FintechCardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-foreground truncate max-w-[200px]">{debt.name}</h4>
                          {paidOff && (
                            <Badge variant="info" className="text-[10px]">
                              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Paid Off
                            </Badge>
                          )}
                          {overdue && (
                            <Badge variant="expense" className="text-[10px]">
                              <Calendar className="h-2.5 w-2.5 mr-0.5" /> Overdue
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                          <Calendar className="h-3 w-3" /> Due: {formatDate(debt.due_date, "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDebtModal(debt)} className="h-8 w-8 text-ink-muted">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDebtDeleteId(debt.id)} className="h-8 w-8 text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-between items-baseline pt-1">
                      <div>
                        <span className="text-xs text-muted-foreground font-medium">Remaining Balance</span>
                        <CurrencyDisplay amount={remaining} className="type-ledger text-2xl font-bold block text-rose-600 dark:text-rose-400" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground font-medium">Total Owed</span>
                        <CurrencyDisplay amount={Number(debt.total_amount)} className="type-ledger text-base font-semibold block text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>Paid Off</span>
                        <span className="font-bold text-foreground tabular-nums">{Math.round(progress * 100)}%</span>
                      </div>
                      <Progress value={progress * 100} className="h-2 rounded-full [&>div]:bg-rose-500" />
                    </div>

                    {history.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-border">
                        <span className="text-xs text-muted-foreground font-medium">Payment History</span>
                        {history.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground text-xs">{formatDate(p.paid_at, "MMM d, yyyy")}</span>
                            <span className="flex items-center gap-1 tabular-nums">
                              <CurrencyDisplay amount={Number(p.amount)} className="type-ledger font-semibold" />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-ink-muted hover:text-rose-600"
                                title="Undo payment"
                                onClick={() => handleUnpay(p.id)}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      onClick={() => openPayModal(debt)}
                      disabled={paidOff}
                      className="w-full rounded-xl font-medium text-xs h-9 cursor-pointer"
                    >
                      <HandCoins className="h-4 w-4 mr-1.5" /> Make Payment
                    </Button>
                  </FintechCardContent>
                </FintechCard>
              );
            })}
          </div>
        )}
      </div>

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
                className="h-4 w-4 rounded border-gray-300 text-sulpot-deep focus:ring-sulpot"
              />
              <Label htmlFor="goal-emergency" className="cursor-pointer select-none">
                Mark as primary Emergency Fund
              </Label>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setGoalModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/80 text-white">
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
              <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/80 text-white">
                Record Contribution
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New / Edit Debt Dialog */}
      <Dialog open={debtModalOpen} onOpenChange={setDebtModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedDebt ? "Edit Debt" : "New Debt"}</DialogTitle>
            <DialogDescription>
              Track what you owe. Payments will register as expenses toward payoff.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDebtSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="debt-name">Debt Name <span className="text-rose-500">*</span></Label>
              <Input
                id="debt-name"
                placeholder="e.g. Motorcycle Loan, Credit Card"
                value={debtName}
                onChange={(e) => setDebtName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-total">Total Owed (₱) <span className="text-rose-500">*</span></Label>
              <Input
                id="debt-total"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={debtTotal}
                onChange={(e) => setDebtTotal(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-due">Due Date <span className="text-rose-500">*</span></Label>
              <Input
                id="debt-due"
                type="date"
                value={debtDueDate}
                onChange={(e) => setDebtDueDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-category">Expense Category (Optional)</Label>
              <Select value={debtCategory} onValueChange={(val) => setDebtCategory(val || "")}>
                <SelectTrigger id="debt-category">
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
              <Label htmlFor="debt-notes">Notes (Optional)</Label>
              <Textarea
                id="debt-notes"
                placeholder="Lender, terms, or payoff plan..."
                value={debtNotes}
                onChange={(e) => setDebtNotes(e.target.value)}
                rows={2}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDebtModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {selectedDebt ? "Save Changes" : "Create Debt"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Make Payment Dialog */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Pay {selectedDebt?.name || ""}</DialogTitle>
            <DialogDescription>
              Logs a payment toward this debt. This will register as an expense in the selected category.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaySubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Payment Amount (₱) <span className="text-rose-500">*</span></Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Date <span className="text-rose-500">*</span></Label>
              <Input
                id="pay-date"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-category">Expense Category <span className="text-rose-500">*</span></Label>
              <Select value={payCategory} onValueChange={(val) => setPayCategory(val || "")} required>
                <SelectTrigger id="pay-category">
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
              <Label htmlFor="pay-notes">Notes (Optional)</Label>
              <Input
                id="pay-notes"
                placeholder="e.g. Monthly amortization"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setPayModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Record Payment
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

      {/* Delete Debt Confirmation */}
      <ConfirmDialog
        open={!!debtDeleteId}
        onOpenChange={(open) => !open && setDebtDeleteId(null)}
        onConfirm={handleDebtDelete}
        title="Delete Debt"
        description="This will permanently delete this debt and its payment history. Payments already logged will remain as expenses in your transactions. This action cannot be undone."
        loading={deletingDebt}
      />
    </div>
  );
}
