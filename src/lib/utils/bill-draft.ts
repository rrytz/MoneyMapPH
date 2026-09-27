import type { Bill } from "@/lib/types";

/**
 * The form's draft shape. Deliberately NOT the API shape: `repeats` is a
 * boolean here because it is what the toggle holds, while the API wants one
 * field or the other and never both.
 */
export type BillDraft = {
  name: string;
  expected_amount: string;
  day_of_month: string;
  due_date: string;
  category_id: string;
  repeats: boolean;
};

export function emptyBillDraft(): BillDraft {
  return {
    name: "",
    expected_amount: "",
    day_of_month: "",
    due_date: "",
    category_id: "",
    // Recurring is the default because it is the common case and it is what
    // every existing bill is. Defaulting to one-time would silently change the
    // meaning of an untouched form.
    repeats: true,
  };
}

export function billDraftFrom(b: Bill): BillDraft {
  return {
    name: b.name,
    expected_amount: b.expected_amount ?? "",
    day_of_month: b.day_of_month != null ? String(b.day_of_month) : "",
    due_date: b.due_date ?? "",
    category_id: b.category_id ?? "",
    // The stored shape decides which kind this is, so editing and saving a bill
    // cannot change what kind it is by accident.
    repeats: b.due_date == null,
  };
}

/**
 * The draft for a bill due on one specific date, opened by clicking a calendar
 * day.
 *
 * THE CONTRACT, and the reason it is a function and not two assignments at the
 * call site: the date and the toggle are set TOGETHER, atomically. There is no
 * way to produce a draft carrying a date while the toggle still says "repeats
 * monthly", because this is the only thing that makes a dated draft.
 *
 * Setting them separately is a silent-data-loss bug, and the same family as
 * pay_bill. billSchedule sends ONLY the field for the current mode, so a draft
 * with `due_date` set and `repeats: true` submits BOTH fields empty - the
 * chosen date is discarded, the bill is created with no schedule at all, and
 * it renders badged "Incomplete" with no error anywhere. The user picked a
 * date, named the bill, pressed Save, and got a template.
 */
export function billDraftForDate(isoDate: string): BillDraft {
  return { ...emptyBillDraft(), due_date: isoDate, repeats: false };
}

/**
 * What actually gets sent, given the toggle. Exactly one schedule field, ever.
 *
 * Consequences that are intended:
 *  - one-time + date   -> day_of_month "", due_date set
 *  - recurring + day   -> day_of_month set, due_date ""
 *  - recurring + EMPTY -> both empty, i.e. a schedule-less TEMPLATE. This is
 *    reachable on purpose: a bill can have neither, and onboarding seeds ten
 *    like it. It is a legitimate state, not an error, and the form shows it.
 */
export function billSchedule(d: BillDraft): {
  day_of_month: number | "";
  due_date: string;
} {
  return d.repeats
    ? {
        day_of_month: d.day_of_month === "" ? "" : Number(d.day_of_month),
        due_date: "",
      }
    : { day_of_month: "", due_date: d.due_date };
}
