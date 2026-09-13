"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { billProfile } from "@/lib/utils/bill-profile";
import { createBillAction, updateBillAction, deleteBillAction } from "./bills/actions";
import type { Bill, ExpenseCategory } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  Incomplete: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400",
  Paused: "bg-slate-100 text-slate-500 border-slate-200/60 dark:bg-slate-800 dark:text-slate-400",
};

export function BillsCrud({ bills, categories }: { bills: Bill[]; categories: ExpenseCategory[] }) {
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; expected_amount: string; day_of_month: string; category_id: string }>({
    name: "", expected_amount: "", day_of_month: "", category_id: "",
  });

  const startAdd = () => { setAdding(true); setEditingId(null); setDraft({ name: "", expected_amount: "", day_of_month: "", category_id: "" }); };
  const startEdit = (b: Bill) => { setEditingId(b.id); setAdding(false); setDraft({
    name: b.name,
    expected_amount: b.expected_amount ?? "",
    day_of_month: b.day_of_month != null ? String(b.day_of_month) : "",
    category_id: b.category_id ?? "",
  }); };

  function togglePause(b: Bill) {
    startTransition(async () => {
      const res = await updateBillAction({
        id: b.id,
        name: b.name,
        expected_amount: b.expected_amount != null ? Number(b.expected_amount) : "",
        day_of_month: b.day_of_month ?? "",
        category_id: b.category_id ?? "",
        active: !b.active,
      });
      if (res.error) toast.error(res.error);
    });
  }

  return (
    <FintechCard>
      <FintechCardContent className="p-5 space-y-4">
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
                day_of_month: draft.day_of_month === "" ? "" : Number(draft.day_of_month),
                category_id: draft.category_id,
              });
              if (res.error) return toast.error(res.error);
              toast.success("Bill added");
              setAdding(false);
            }}
          >
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name (e.g. Electricity)" required />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min="0.01" step="0.01" value={draft.expected_amount} onChange={(e) => setDraft({ ...draft, expected_amount: e.target.value })} placeholder="Expected amount" />
              <Input type="number" min="1" max="31" value={draft.day_of_month} onChange={(e) => setDraft({ ...draft, day_of_month: e.target.value })} placeholder="Due day (1-31)" />
            </div>
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
            return (
              <div key={b.id} className={editingId === b.id ? "rounded-xl border p-3 space-y-2" : "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"}>
                {editingId === b.id ? (
                  <form className="space-y-2 flex-1" onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await updateBillAction({
                      id: b.id,
                      name: draft.name,
                      expected_amount: draft.expected_amount === "" ? "" : Number(draft.expected_amount),
                      day_of_month: draft.day_of_month === "" ? "" : Number(draft.day_of_month),
                      category_id: draft.category_id,
                    });
                    if (res.error) return toast.error(res.error);
                    toast.success("Bill saved");
                    setEditingId(null);
                  }}>
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" min="0.01" step="0.01" value={draft.expected_amount} onChange={(e) => setDraft({ ...draft, expected_amount: e.target.value })} />
                      <Input type="number" min="1" max="31" value={draft.day_of_month} onChange={(e) => setDraft({ ...draft, day_of_month: e.target.value })} />
                    </div>
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
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {profile.missing.length === 0 ? (
                          <>
                            Due day {b.day_of_month} · <CurrencyDisplay amount={Number(b.expected_amount)} className="inline font-semibold" />
                          </>
                        ) : (
                          <>Set {profile.missing.join(" and ")} to activate</>
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
      </FintechCardContent>
    </FintechCard>
  );
}