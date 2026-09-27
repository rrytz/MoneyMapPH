"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Power, Trash2, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { billProfile } from "@/lib/utils/bill-profile";
import { formatDate } from "@/lib/utils/date";
import {
  billDraftFrom,
  billSchedule,
  emptyBillDraft,
  type BillDraft,
} from "@/lib/utils/bill-draft";
import { BillForm } from "./bill-form";
import { createBillAction, updateBillAction, deleteBillAction } from "./bills/actions";
import type { Bill, BillPayment, ExpenseCategory } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  Incomplete: "bg-muted/60 text-amber-700 border-amber-200/60 dark:text-amber-400",
  Paused: "bg-muted text-muted-foreground border-border/60",
  // Outline and dashed, to match the calendar chip. A one-time bill is a
  // DIFFERENT KIND of obligation, and the distinction is only useful if it is
  // visible where the bill is listed - not just where it falls on a calendar.
  "One-time": "border-dashed text-muted-foreground",
};

/**
 * What a schedule-less bill needs. Deliberately NOT just "day": since one-time
 * bills arrived, a bill with no schedule has TWO ways to become ready, and
 * naming only one of them is the same class of lie as reporting a ready
 * one-time bill as Incomplete.
 */
function activationHint(missing: Array<"amount" | "day">): string {
  const parts: string[] = [];
  if (missing.includes("amount")) parts.push("amount");
  if (missing.includes("day")) parts.push("a due date or repeat day");
  return `Set ${parts.join(" and ")} to activate`;
}

export function BillsCrud({
  bills,
  categories,
  payments,
}: {
  bills: Bill[];
  categories: ExpenseCategory[];
  payments: BillPayment[];
}) {
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BillDraft>(emptyBillDraft);

  const startEdit = (b: Bill) => {
    setEditingId(b.id);
    setAdding(false);
    setDraft(billDraftFrom(b));
  };

  function togglePause(b: Bill) {
    startTransition(async () => {
      const res = await updateBillAction({
        id: b.id,
        name: b.name,
        expected_amount: b.expected_amount != null ? Number(b.expected_amount) : "",
        // Pause carries the bill's EXISTING schedule, not a reconstructed one.
        // Omitting due_date here relied on the client dropping undefined keys,
        // which made pausing a one-time bill depend on that being true rather
        // than on anything this code said.
        ...(b.due_date != null
          ? { day_of_month: "" as number | "", due_date: b.due_date }
          : { day_of_month: (b.day_of_month ?? "") as number | "", due_date: "" }),
        category_id: b.category_id ?? "",
        active: !b.active,
      });
      if (res.error) toast.error(res.error);
    });
  }

  const paidBills = [...payments].sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1));
  const billName = (id: string) => bills.find((b) => b.id === id)?.name ?? "Deleted bill";

  return (
    <FintechCard>
      <FintechCardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Bills</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAdding((v) => !v);
              setEditingId(null);
              setDraft(emptyBillDraft());
            }}
          >
            <Plus className="h-3.5 w-3.5" /> {adding ? "Cancel" : "Add bill"}
          </Button>
        </div>

        {adding && (
          <div className="rounded-xl border p-3">
            {/* BillForm renders its own <form>, so this is a plain div. A
                wrapper <form> here would nest two forms, which is invalid HTML
                and silently breaks submission in some browsers. */}
            <BillForm
              draft={draft}
              onChange={setDraft}
              categories={categories}
              submitLabel="Save bill"
              onCancel={() => setAdding(false)}
              onSubmit={async (values) => {
                const res = await createBillAction({
                  name: values.name,
                  expected_amount: values.expected_amount,
                  category_id: values.category_id,
                  day_of_month: values.day_of_month,
                  due_date: values.due_date,
                });
                if (res.error) return toast.error(res.error);
                toast.success("Bill added");
                setAdding(false);
              }}
            />
          </div>
        )}

        <div className="space-y-2">
          {bills.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No bills yet. Add one or activate a template.
            </p>
          )}
          {bills.map((b) => {
            const profile = billProfile(b);
            const oneTime = b.due_date != null;
            return (
              <div
                key={b.id}
                className={
                  editingId === b.id
                    ? "space-y-2 rounded-xl border p-3"
                    : "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
                }
              >
                {editingId === b.id ? (
                  <BillForm
                    draft={draft}
                    onChange={setDraft}
                    categories={categories}
                    submitLabel="Save"
                    onCancel={() => setEditingId(null)}
                    onSubmit={async () => {
                      const res = await updateBillAction({
                        id: b.id,
                        name: draft.name,
                        expected_amount:
                          draft.expected_amount === "" ? "" : Number(draft.expected_amount),
                        ...billSchedule(draft),
                        category_id: draft.category_id,
                      });
                      if (res.error) return toast.error(res.error);
                      toast.success("Bill saved");
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            b.active
                              ? "text-sm font-medium"
                              : "text-sm font-medium text-muted-foreground line-through"
                          }
                        >
                          {b.name}
                        </span>
                        {profile.label && (
                          <Badge variant="outline" className={STATUS_STYLE[profile.label]}>
                            {profile.label}
                          </Badge>
                        )}
                        {oneTime && (
                          <Badge variant="outline" className={STATUS_STYLE["One-time"]}>
                            One-time
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {profile.missing.length === 0 ? (
                          oneTime ? (
                            <>
                              Due{" "}
                              {formatDate(new Date(`${b.due_date}T00:00:00`), "MMM d, yyyy")} ·{" "}
                              <CurrencyDisplay
                                amount={Number(b.expected_amount)}
                                className="figure-inline inline font-semibold"
                              />
                            </>
                          ) : (
                            <>
                              Due day {b.day_of_month} ·{" "}
                              <CurrencyDisplay
                                amount={Number(b.expected_amount)}
                                className="figure-inline inline font-semibold"
                              />
                            </>
                          )
                        ) : (
                          <>{activationHint(profile.missing)}</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(b)} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePause(b)}
                        aria-label={b.active ? "Pause" : "Resume"}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const res = await deleteBillAction({ id: b.id });
                          if (res.error) return toast.error(res.error);
                          toast.success("Bill deleted");
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* The permanent home for a payment. A paid bill is otherwise only
            findable by navigating the calendar back to the month it was paid
            in, which on the 1st of the next month is a calendar that no longer
            exists. A deleted bill cannot appear here - bill_payments cascades
            on bill delete - so every row resolves. */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <CheckCheck className="h-4 w-4 text-ink-faint" /> Paid
            </h4>
            <span className="text-[11px] text-muted-foreground">
              all payments, not just this month
            </span>
          </div>
          {paidBills.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              No payments recorded yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {paidBills.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{billName(p.bill_id)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Paid {formatDate(new Date(`${p.paid_at}T00:00:00`), "MMM d, yyyy")} · due{" "}
                      {formatDate(new Date(`${p.due_date}T00:00:00`), "MMM d")}
                    </div>
                  </div>
                  <CurrencyDisplay
                    amount={Number(p.amount)}
                    className="type-ledger shrink-0 text-sm font-semibold"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </FintechCardContent>
    </FintechCard>
  );
}
