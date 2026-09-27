"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Power, Trash2, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { billProfile } from "@/lib/utils/bill-profile";
import { formatDate } from "@/lib/utils/date";
import { createBillAction, updateBillAction, deleteBillAction } from "./bills/actions";
import type { Bill, BillPayment, ExpenseCategory } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  Incomplete: "bg-muted/60 text-amber-700 border-amber-200/60 dark:text-amber-400",
  Paused: "bg-muted text-muted-foreground border-border/60",
  // Outline, to match the calendar chip. A one-time bill is a DIFFERENT KIND of
  // obligation, and the distinction is only useful if it is visible where the
  // bill is listed - not just where it happens to fall on a calendar.
  "One-time": "border-dashed text-muted-foreground",
};

type Draft = {
  name: string;
  expected_amount: string;
  day_of_month: string;
  due_date: string;
  category_id: string;
  repeats: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  expected_amount: "",
  day_of_month: "",
  due_date: "",
  category_id: "",
  // Recurring is the default because it is the overwhelmingly common case and
  // it is what every existing bill is. Defaulting to one-time would silently
  // change the meaning of an untouched form.
  repeats: true,
};

/**
 * What a schedule-less bill needs. Deliberately NOT just "day": since one-time
 * bills arrived, a bill with no schedule has TWO ways to become ready, and
 * telling the user only about one of them is the same class of lie as reporting
 * a ready one-time bill as Incomplete.
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
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const startEdit = (b: Bill) => {
    setEditingId(b.id);
    setAdding(false);
    setDraft({
      name: b.name,
      expected_amount: b.expected_amount ?? "",
      day_of_month: b.day_of_month != null ? String(b.day_of_month) : "",
      due_date: b.due_date ?? "",
      category_id: b.category_id ?? "",
      // The stored shape is the source of truth for which kind this is, so
      // editing a bill and saving it cannot change what kind it is by accident.
      repeats: b.due_date == null,
    });
  };

  /**
   * The form's toggle is the single source of truth for which kind of schedule
   * is written. Only the field for the current mode is sent, so a bill can
   * never end up scheduled both ways - and switching the toggle actually MOVES
   * the bill rather than leaving a stale schedule behind.
   */
  const scheduleFields = (d: Draft): { day_of_month: number | ""; due_date: string } =>
    d.repeats
      ? { day_of_month: d.day_of_month === "" ? "" : Number(d.day_of_month), due_date: "" }
      : { day_of_month: "", due_date: d.due_date };

  function togglePause(b: Bill) {
    startTransition(async () => {
      const res = await updateBillAction({
        id: b.id,
        name: b.name,
        expected_amount: b.expected_amount != null ? Number(b.expected_amount) : "",
        // Pause must carry the bill's EXISTING schedule, not a reconstructed
        // one. Omitting due_date here relied on the client dropping undefined
        // keys, which meant pausing a one-time bill depended on that being
        // true rather than on anything this code said.
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
          <Button size="sm" variant="outline" onClick={adding ? () => setAdding(false) : startAdd}>
            <Plus className="h-3.5 w-3.5" /> {adding ? "Cancel" : "Add bill"}
          </Button>
        </div>

        {adding && (
          <form
            className="space-y-3 rounded-xl border p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await createBillAction({
                name: draft.name,
                expected_amount: draft.expected_amount === "" ? "" : Number(draft.expected_amount),
                ...scheduleFields(draft),
                category_id: draft.category_id,
              });
              if (res.error) return toast.error(res.error);
              toast.success("Bill added");
              setAdding(false);
            }}
          >
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name (e.g. Electricity)" required />
            <Input type="number" min="0.01" step="0.01" value={draft.expected_amount} onChange={(e) => setDraft({ ...draft, expected_amount: e.target.value })} placeholder="Expected amount" />

            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <label htmlFor="bill-repeats" className="text-sm cursor-pointer">
                Repeats monthly
              </label>
              <button
                id="bill-repeats"
                type="button"
                role="switch"
                aria-checked={draft.repeats}
                onClick={() => setDraft({ ...draft, repeats: !draft.repeats })}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  draft.repeats ? "bg-sulpot" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${
                    draft.repeats ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {draft.repeats ? (
              <Input type="number" min="1" max="31" value={draft.day_of_month} onChange={(e) => setDraft({ ...draft, day_of_month: e.target.value })} placeholder="Due day (1-31)" />
            ) : (
              <Input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} required />
            )}

            <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button type="submit" size="sm">Save bill</Button>
          </form>
        )}

        <div className="space-y-2">
          {bills.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No bills yet. Add one or activate a template.</p>}
          {bills.map((b) => {
            const profile = billProfile(b);
            const oneTime = b.due_date != null;
            return (
              <div key={b.id} className={editingId === b.id ? "rounded-xl border p-3 space-y-2" : "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"}>
                {editingId === b.id ? (
                  <form className="space-y-2 flex-1" onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await updateBillAction({
                      id: b.id,
                      name: draft.name,
                      expected_amount: draft.expected_amount === "" ? "" : Number(draft.expected_amount),
                      ...scheduleFields(draft),
                      category_id: draft.category_id,
                    });
                    if (res.error) return toast.error(res.error);
                    toast.success("Bill saved");
                    setEditingId(null);
                  }}>
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
                    <Input type="number" min="0.01" step="0.01" value={draft.expected_amount} onChange={(e) => setDraft({ ...draft, expected_amount: e.target.value })} />
                    {draft.repeats ? (
                      <Input type="number" min="1" max="31" value={draft.day_of_month} onChange={(e) => setDraft({ ...draft, day_of_month: e.target.value })} />
                    ) : (
                      <Input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} required />
                    )}
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button type="submit" size="sm">Save</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={b.active ? "text-sm font-medium" : "text-sm font-medium text-muted-foreground line-through"}>{b.name}</span>
                        {profile.label && <Badge variant="outline" className={STATUS_STYLE[profile.label]}>{profile.label}</Badge>}
                        {oneTime && <Badge variant="outline" className={STATUS_STYLE["One-time"]}>One-time</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {profile.missing.length === 0 ? (
                          oneTime ? (
                            <>
                              Due {formatDate(new Date(`${b.due_date}T00:00:00`), "MMM d, yyyy")} · <CurrencyDisplay amount={Number(b.expected_amount)} className="figure-inline inline font-semibold" />
                            </>
                          ) : (
                            <>
                              Due day {b.day_of_month} · <CurrencyDisplay amount={Number(b.expected_amount)} className="figure-inline inline font-semibold" />
                            </>
                          )
                        ) : (
                          <>{activationHint(profile.missing)}</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(b)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => togglePause(b)} aria-label={b.active ? "Pause" : "Resume"}><Power className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        const res = await deleteBillAction({ id: b.id });
                        if (res.error) return toast.error(res.error);
                        toast.success("Bill deleted");
                      }} aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* The permanent home for a payment. A paid bill is otherwise only
            findable by navigating the calendar back to the month it was paid
            in, which on the 1st of the next month is a calendar that no
            longer exists. A deleted bill cannot appear here at all -
            bill_payments cascades on bill delete - so every row resolves. */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <CheckCheck className="h-4 w-4 text-ink-faint" /> Paid
            </h4>
            <span className="text-[11px] text-muted-foreground">all payments, not just this month</span>
          </div>
          {paidBills.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="space-y-1.5">
              {paidBills.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{billName(p.bill_id)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Paid {formatDate(new Date(`${p.paid_at}T00:00:00`), "MMM d, yyyy")} · due {formatDate(new Date(`${p.due_date}T00:00:00`), "MMM d")}
                    </div>
                  </div>
                  <CurrencyDisplay amount={Number(p.amount)} className="type-ledger shrink-0 text-sm font-semibold" />
                </div>
              ))}
            </div>
          )}
        </div>
      </FintechCardContent>
    </FintechCard>
  );
}
