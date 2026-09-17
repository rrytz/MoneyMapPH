# Backlog

Deferred / minor items tracked for later work. Items here are not planned —
they are captured intent, consistent with how minor follow-ups have been
tracked across milestones.

---

## Historical monthly-snapshot backfill

**Source:** Bundled K2 fix audit — debt-tracking design `docs/superpowers/specs/2026-09-18-debt-tracking-design.md` §"Bundled K2 fix".

**Status:** Backlog (explicitly out of scope for the debt-tracking feature).

**Problem:** Before 2026-09-18, `payBill`/`unpayBill` created real expenses but never called `generateSnapshot`, so `monthly_snapshots.total_expenses` silently under-states any month whose only money activity was bill payments — and never heals (a past month is rarely touched again). The forward fix now makes `payBill`/`unpayBill` regenerate like every other expense-creating action; the historical rows that already drifted are not healed by it.

**Suggested approach (do NOT put in a migration):** a one-off service-layer script (reuses `getMonthlySummary` + `generateSnapshot`) that recomputes `monthly_snapshots` for affected user-months, rather than duplicating the aggregation in SQL across all users' history.

**Out of scope constraints:** see Global Constraints 9 and the "Explicitly untouched / deferred" section of the debt-tracking spec.