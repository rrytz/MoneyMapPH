export interface Profile {
  id: string;
  display_name: string | null;
  currency: string;
  theme: "light" | "dark" | "system";
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncomeSource {
  id: string;
  user_id: string;
  name: string;
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
  allocations: Array<{
    category_id?: string;
    label: string;
    amount: number;
  }>;
};
