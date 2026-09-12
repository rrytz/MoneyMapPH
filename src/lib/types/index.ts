export interface Profile {
  id: string;
  display_name: string | null;
  currency: string;
  theme: "light" | "dark" | "system";
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type IncomeSourceType = "core" | "incentive";

export interface IncomeSource {
  id: string;
  user_id: string;
  name: string;
  type: IncomeSourceType;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface IncomeEntry {
  id: string;
  user_id: string;
  amount: number;
  source_id: string;
  date: string;
  notes: string | null;
  paycheck_id: string | null;
  created_at: string;
  updated_at: string;
  source?: IncomeSource;
}

export interface ExpenseCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  category_id: string;
  date: string;
  notes: string | null;
  paycheck_id: string | null;
  created_at: string;
  updated_at: string;
  category?: ExpenseCategory;
}

export interface Budget {
  id: string;
  user_id: string;
  month: number;
  year: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  budget_categories?: BudgetCategory[];
}

export interface BudgetCategory {
  id: string;
  budget_id: string;
  category_id: string;
  amount: number;
  created_at: string;
  updated_at: string;
  category?: ExpenseCategory;
}

export interface Paycheck {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  date: string;
  notes: string | null;
  period_end?: string | null;
  created_at: string;
  updated_at: string;
  allocations?: PaycheckAllocation[];
}

export interface PaycheckAllocation {
  id: string;
  paycheck_id: string;
  category_id: string | null;
  label: string;
  amount: number;
  created_at: string;
  updated_at: string;
  category?: ExpenseCategory;
}

export interface MonthlySnapshot {
  id: string;
  user_id: string;
  month: number;
  year: number;
  total_income: number;
  total_expenses: number;
  total_budget: number;
  savings_amount: number;
  savings_rate: number;
  category_breakdown: Record<string, number>;
  income_breakdown: Record<string, number>;
  snapshot_date: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpenses: number;
  totalBudget: number;
  remainingBudget: number;
  savingsAmount: number;
  savingsRate: number;
  categorySpending: Record<string, number>;
  incomeBySource: Record<string, number>;
  budgetUtilization: number;
}

export interface BudgetStatus {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: "under" | "near" | "over";
}

export type LeanPhase = "insufficient" | "normal" | "lean";

export interface LeanStatus {
  phase: LeanPhase;
  targetPeriodEnd: string | null;
  targetIncome: number;
  median: number;
  ratio: number | null;
  threshold: number;
  periodsUsed: number;
  windowPeriods: number;
}

export interface PaycheckSummary {
  paycheck: Paycheck;
  totalAllocated: number;
  totalUnallocated: number;
  allocationBreakdown: Array<{
    label: string;
    amount: number;
    categoryId: string | null;
    categoryName: string | null;
  }>;
}

export type IncomeFormData = {
  amount: number;
  source_id: string;
  date: string;
  notes?: string;
  paycheck_id?: string;
};

export type ExpenseFormData = {
  title: string;
  amount: number;
  category_id: string;
  date: string;
  notes?: string;
  paycheck_id?: string;
};

export type BudgetFormData = {
  month: number;
  year: number;
  categories: Array<{
    category_id: string;
    amount: number;
  }>;
};

export type PaycheckFormData = {
  name: string;
  amount: number;
  date: string;
  notes?: string;
  period_end?: string;
  allocations: Array<{
    category_id?: string;
    label: string;
    amount: number;
  }>;
};

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  notes: string | null;
  is_emergency_fund: boolean;
  created_at: string;
  updated_at: string;
}

export type SavingsGoalFormData = {
  name: string;
  target_amount: number;
  target_date?: string;
  notes?: string;
  is_emergency_fund?: boolean;
};

export interface ForecastProjection {
  month: number;
  year: number;
  estimatedBalance: number;
}

export interface ForecastDataPoint {
  date: string;
  forecasted: number;
  historical?: number;
}

export interface SimulatedPurchase {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  target_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SimulatedPurchaseFormData = {
  name: string;
  amount: number;
  target_date?: string;
  notes?: string;
};

export interface FinancialHealthReport {
  score: number;
  grade: "Excellent" | "Good" | "Fair" | "Critical";
  breakdown: {
    savingsRateScore: number;
    emergencyFundScore: number;
    budgetAdherenceScore: number;
    paycheckAllocationScore: number;
  };
  recommendations: string[];
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  due_date: string;
  completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnifiedTransaction {
  id: string;
  type: "income" | "expense";
  title: string;
  amount: number;
  date: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  notes: string | null;
}

export type ActionResponse<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

export interface SafeToSpendStatus {
  periodStart: string;
  periodEnd: string;
  payoutDate: string;
  coreIncome: number;
  incentiveIncomeLogged: number;
  spentThisPeriod: number;
  safeToSpend: number;
  hasPaychecks: boolean;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  fractionElapsed: number;
}



