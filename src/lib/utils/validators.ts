import { z } from "zod";

export const incomeSchema = z.object({
  amount: z.coerce
    .number()
    .positive("Amount must be greater than 0")
    .max(999999999999, "Amount is too large"),
  source_id: z.string().uuid("Select an income source"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(500, "Notes must be 500 characters or less").optional().or(z.literal("")),
  paycheck_id: z.string().uuid().optional().or(z.literal("")),
});

export const expenseSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than 0")
    .max(999999999999, "Amount is too large"),
  category_id: z.string().uuid("Select a category"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(500, "Notes must be 500 characters or less").optional().or(z.literal("")),
  paycheck_id: z.string().uuid().optional().or(z.literal("")),
});

export const budgetCategorySchema = z.object({
  category_id: z.string().uuid(),
  amount: z.coerce.number().min(0, "Amount cannot be negative"),
});

export const budgetSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  categories: z.array(budgetCategorySchema).min(1, "Add at least one category"),
});

export const allocationSchema = z.object({
  category_id: z.string().uuid().optional().or(z.literal("")),
  label: z.string().min(1, "Label is required"),
  amount: z.coerce.number().min(0, "Amount cannot be negative"),
});

export const paycheckSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(500).optional().or(z.literal("")),
  period_end: z.string().optional().or(z.literal("")),
  allocations: z.array(allocationSchema),
});

export const savingsGoalSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(100, "Name must be 100 characters or less"),
  target_amount: z.coerce.number().positive("Target amount must be greater than 0"),
  target_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  is_emergency_fund: z.boolean().default(false),
});

export const contributionSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(500).optional().or(z.literal("")),
  category_id: z.string().uuid("Select a category"),
});

export const simulatedPurchaseSchema = z.object({
  name: z.string().min(1, "Purchase name is required").max(100, "Name must be 100 characters or less"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  target_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type IncomeSchemaType = z.infer<typeof incomeSchema>;
export type ExpenseSchemaType = z.infer<typeof expenseSchema>;
export type BudgetSchemaType = z.infer<typeof budgetSchema>;
export type PaycheckSchemaType = z.infer<typeof paycheckSchema>;
export type SavingsGoalSchemaType = z.infer<typeof savingsGoalSchema>;
export type ContributionSchemaType = z.infer<typeof contributionSchema>;
export type SimulatedPurchaseSchemaType = z.infer<typeof simulatedPurchaseSchema>;

export const profileSchema = z.object({
  display_name: z.string().min(1, "Display name is required").max(50, "Name must be 50 characters or less"),
  currency: z.string().min(1, "Currency is required").max(3, "Currency code is 3 letters"),
  theme: z.enum(["light", "dark", "system"]),
});

export const reminderSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be 100 characters or less"),
  due_date: z.string().min(1, "Due date is required"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(50, "Name must be 50 characters or less"),
  icon: z.string().optional().or(z.literal("")),
  color: z.string().optional().or(z.literal("")),
});

export const sourceSchema = z.object({
  name: z.string().min(1, "Source name is required").max(50, "Name must be 50 characters or less"),
  type: z.enum(["core", "incentive"]).default("core"),
});

export type ProfileSchemaType = z.infer<typeof profileSchema>;
export type ReminderSchemaType = z.infer<typeof reminderSchema>;
export type CategorySchemaType = z.infer<typeof categorySchema>;
export type SourceSchemaType = z.infer<typeof sourceSchema>;



