"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { billSchedule, type BillDraft } from "@/lib/utils/bill-draft";
import type { ExpenseCategory } from "@/lib/types";

export type BillFormValues = {
  name: string;
  expected_amount: number | "";
  category_id: string;
  day_of_month: number | "";
  due_date: string;
};

/**
 * The one bill form, used by the inline "Add bill" row and by the calendar's
 * Sheet. Two triggers, one surface - the same reason QuickAdd owns its own
 * mode rather than composing two dialogs.
 *
 * It is deliberately controlled: the draft belongs to whoever opened it, so a
 * calendar click can hand in a prebuilt one-time draft and this component
 * cannot disagree about which kind of bill is being created.
 */
export function BillForm({
  draft,
  onChange,
  categories,
  submitLabel,
  onSubmit,
  onCancel,
  autoFocusName = false,
}: {
  draft: BillDraft;
  onChange: (next: BillDraft) => void;
  categories: ExpenseCategory[];
  submitLabel: string;
  onSubmit: (values: BillFormValues) => void;
  onCancel?: () => void;
  autoFocusName?: boolean;
}) {
  const set = (patch: Partial<BillDraft>) => onChange({ ...draft, ...patch });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: draft.name,
          expected_amount: draft.expected_amount === "" ? "" : Number(draft.expected_amount),
          category_id: draft.category_id,
          ...billSchedule(draft),
        });
      }}
    >
      <Input
        value={draft.name}
        onChange={(e) => set({ name: e.target.value })}
        placeholder="Name (e.g. Electricity)"
        aria-label="Bill name"
        required
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the Sheet opened
        // from a calendar day, so the name is the first thing to type.
        autoFocus={autoFocusName}
      />
      <Input
        type="number"
        min="0.01"
        step="0.01"
        value={draft.expected_amount}
        onChange={(e) => set({ expected_amount: e.target.value })}
        placeholder="Expected amount"
        aria-label="Expected amount"
      />

      {/* One switch, two exclusive states, so it is a switch and not three
          radios. The label sits inside the control so the whole row is the
          hit target. */}
      <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
        <label htmlFor="bill-repeats" className="cursor-pointer text-sm">
          Repeats monthly
        </label>
        <button
          id="bill-repeats"
          type="button"
          role="switch"
          aria-checked={draft.repeats}
          onClick={() =>
            // Clause 2: flipping the mode drops the other schedule rather than
            // leaving a stale one behind. The date stays in the draft only so
            // flipping back and forth is lossless; billSchedule is what decides
            // what is sent, and it will not send both.
            set({ repeats: !draft.repeats })
          }
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            draft.repeats ? "bg-sulpot" : "bg-muted"
          )}
        >
          {/* The knob is inset by 0.5 (0.125rem) on BOTH sides, expressed as
              left-0.5 / right-0.5 rather than as a computed offset.

              It was left-[18px] before, which is the same shape of bug as the
              ones this feature keeps producing: a hardcoded px offset sitting
              next to rem-sized geometry. The track is w-9 (2.25rem) and the
              knob is w-4 (1rem), so at this project's 15px root they measure
              33.75px and 15px - and 18 + 15 = 33 left 0.75px of inset instead
              of 1.88px, so the knob sat flush against the edge and read as
              overflowing. Letting the two sides of the box do the arithmetic
              is correct at any root size, and needs no magic number.

              cn() rather than a template literal, so twMerge resolves the
              left/right pair instead of shipping both and leaving stylesheet
              order to arbitrate which one wins. */}
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]",
              draft.repeats ? "right-0.5" : "left-0.5"
            )}
          />
        </button>
      </div>

      {draft.repeats ? (
        <Input
          type="number"
          min="1"
          max="31"
          value={draft.day_of_month}
          onChange={(e) => set({ day_of_month: e.target.value })}
          placeholder="Due day (1-31)"
          aria-label="Due day of the month"
        />
      ) : (
        <Input
          type="date"
          value={draft.due_date}
          onChange={(e) => set({ due_date: e.target.value })}
          aria-label="Due date"
          required
        />
      )}

      <select
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        value={draft.category_id}
        onChange={(e) => set({ category_id: e.target.value })}
        aria-label="Category"
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
