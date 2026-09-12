-- ============================================================
-- INCOME SOURCE TYPE
-- Classifies income sources as core (salary) or incentive
-- (bonus/OT/commission). Defaults everything to 'core' so the
-- core/incentive split is an explicit, opt-in signal (V2+V4 safe-to-spend).
-- ============================================================

ALTER TABLE public.income_sources
  ADD COLUMN type TEXT NOT NULL DEFAULT 'core'
  CHECK (type IN ('core', 'incentive'));