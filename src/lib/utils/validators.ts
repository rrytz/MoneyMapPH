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
  allocations: z.array(allocationSchema),
});

export type IncomeSchemaType = z.infer<typeof incomeSchema>;
export type ExpenseSchemaType = z.infer<typeof expenseSchema>;
export type BudgetSchemaType = z.infer<typeof budgetSchema>;
export type PaycheckSchemaType = z.infer<typeof paycheckSchema>;
